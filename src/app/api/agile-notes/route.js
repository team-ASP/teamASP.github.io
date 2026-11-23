import { randomUUID } from "node:crypto";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicAgileNote, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validKinds = new Set(["memo", "standup", "idea", "blocker", "meeting"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = String(searchParams.get("projectId") || "").trim();
  if (!projectId || !(await projectExists(projectId))) return jsonError("invalid_project", 400);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    select *
    from agile_notes
    where project_id = ${projectId} and deleted_at is null
    order by pinned desc, created_at desc
    limit 200
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicAgileNote) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "agile-notes"), { limit: 40, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "body"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  const projectId = String(payload.projectId || "").trim();
  if (!projectId || !(await projectExists(projectId))) return jsonError("invalid_project", 400);

  const normalized = normalizeAgilePayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into agile_notes (id, project_id, kind, body, tags, pinned, resolved, author_login, author_name)
    values (
      ${randomUUID()},
      ${projectId},
      ${normalized.kind},
      ${normalized.body},
      ${normalized.tags},
      ${normalized.pinned},
      ${normalized.resolved},
      ${session.login},
      ${session.name || session.login}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-agile-note",
    targetType: "agile-note",
    targetId: item.id,
    summary: `[${item.kind}] ${item.body.slice(0, 80)}`,
  });

  return jsonResponse({ item: toPublicAgileNote(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "agile-notes"), { limit: 40, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from agile_notes where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeAgilePayload({
    kind: payload.kind ?? existing.kind,
    body: payload.body ?? existing.body,
    tags: payload.tags ?? existing.tags,
    pinned: payload.pinned ?? existing.pinned,
    resolved: payload.resolved ?? existing.resolved,
  });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update agile_notes
    set kind = ${normalized.kind},
        body = ${normalized.body},
        tags = ${normalized.tags},
        pinned = ${normalized.pinned},
        resolved = ${normalized.resolved},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-agile-note",
    targetType: "agile-note",
    targetId: item.id,
    summary: `[${item.kind}] ${item.body.slice(0, 80)}`,
  });

  return jsonResponse({ item: toPublicAgileNote(item) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "agile-notes"), { limit: 30, windowMs: 60_000 });
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
    update agile_notes
    set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!item) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-agile-note",
    targetType: "agile-note",
    targetId: item.id,
    summary: item.body.slice(0, 80),
  });

  return jsonResponse({ item: toPublicAgileNote(item) });
}

function normalizeAgilePayload(payload) {
  const body = normalizeText(payload.body, { field: "body", max: 2000 });
  if (body.error) return { error: body.error, extra: body.max ? { max: body.max } : {} };

  const kind = String(payload.kind || "memo").trim();
  if (!validKinds.has(kind)) return { error: "invalid_kind" };

  const rawTags = Array.isArray(payload.tags) ? payload.tags.join(",") : String(payload.tags || "");
  const cleanTags = rawTags
    .split(",")
    .map((item) => item.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 6)
    .join(",");

  return {
    kind,
    body: body.value,
    tags: cleanTags,
    pinned: Boolean(payload.pinned),
    resolved: Boolean(payload.resolved),
  };
}
