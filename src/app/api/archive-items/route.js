import { randomUUID } from "node:crypto";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicArchiveItem, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validKinds = new Set(["artifact", "report", "presentation", "demo", "dataset", "retrospective"]);
const validStatuses = new Set(["needed", "draft", "ready", "published"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId || !(await projectExists(projectId))) return jsonError("invalid_project", 400);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    select *
    from archive_items
    where project_id = ${projectId} and deleted_at is null
    order by updated_at desc
    limit 100
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicArchiveItem) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "archive-items"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "title"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!(await projectExists(payload.projectId))) return jsonError("invalid_project", 400);

  const normalized = normalizeArchivePayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into archive_items (id, project_id, title, kind, status, url, notes, author_login, author_name)
    values (
      ${randomUUID()},
      ${payload.projectId},
      ${normalized.title},
      ${normalized.kind},
      ${normalized.status},
      ${normalized.url},
      ${normalized.notes},
      ${session.login},
      ${session.name || session.login}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-archive-item",
    targetType: "archive",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicArchiveItem(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "archive-items"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from archive_items where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeArchivePayload({
    title: payload.title ?? existing.title,
    kind: payload.kind ?? existing.kind,
    status: payload.status ?? existing.status,
    url: payload.url ?? existing.url,
    notes: payload.notes ?? existing.notes,
  });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update archive_items
    set title = ${normalized.title},
        kind = ${normalized.kind},
        status = ${normalized.status},
        url = ${normalized.url},
        notes = ${normalized.notes},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-archive-item",
    targetType: "archive",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicArchiveItem(item) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "archive-items"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    update archive_items
    set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!item) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-archive-item",
    targetType: "archive",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicArchiveItem(item) });
}

function normalizeArchivePayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const notesValue = payload.notes || " ";
  const notes = normalizeText(notesValue, { field: "notes", max: 4000 });
  if (notes.error) notes.value = "";

  const kind = payload.kind || "artifact";
  const status = payload.status || "needed";
  if (!validKinds.has(kind)) return { error: "invalid_kind" };
  if (!validStatuses.has(status)) return { error: "invalid_status" };

  const url = String(payload.url || "").trim();
  if (url && !/^https?:\/\/[^\s]+$/i.test(url)) return { error: "invalid_url" };

  return {
    title: title.value,
    kind,
    status,
    url,
    notes: notes.value || "",
  };
}
