import { randomUUID } from "node:crypto";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields, sanitizeExternalUrl } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicWikiPage, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validSpaces = new Set(["spec", "meeting", "experiment", "decision", "archive", "general"]);
const validStatuses = new Set(["draft", "review", "published"]);

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
    from wiki_pages
    where project_id = ${projectId} and deleted_at is null
    order by updated_at desc
    limit 250
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicWikiPage) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "wiki-pages"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "title"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  const projectId = String(payload.projectId || "").trim();
  if (!projectId || !(await projectExists(projectId))) return jsonError("invalid_project", 400);

  const normalized = normalizeWikiPayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into wiki_pages (
      id, project_id, parent_id, space, title, content, status, reference_url, tags,
      author_login, author_name, updated_by_login
    )
    values (
      ${randomUUID()},
      ${projectId},
      ${normalized.parentId},
      ${normalized.space},
      ${normalized.title},
      ${normalized.content},
      ${normalized.status},
      ${normalized.referenceUrl},
      ${normalized.tags},
      ${session.login},
      ${session.name || session.login},
      ${session.login}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-wiki-page",
    targetType: "wiki-page",
    targetId: item.id,
    summary: `[${item.space}] ${item.title}`,
  });

  return jsonResponse({ item: toPublicWikiPage(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "wiki-pages"), { limit: 40, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from wiki_pages where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeWikiPayload({
    parentId: payload.parentId ?? existing.parent_id,
    space: payload.space ?? existing.space,
    title: payload.title ?? existing.title,
    content: payload.content ?? existing.content,
    status: payload.status ?? existing.status,
    referenceUrl: payload.referenceUrl ?? existing.reference_url,
    tags: payload.tags ?? existing.tags,
  });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update wiki_pages
    set parent_id = ${normalized.parentId},
        space = ${normalized.space},
        title = ${normalized.title},
        content = ${normalized.content},
        status = ${normalized.status},
        reference_url = ${normalized.referenceUrl},
        tags = ${normalized.tags},
        updated_by_login = ${session.login},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-wiki-page",
    targetType: "wiki-page",
    targetId: item.id,
    summary: `[${item.space}] ${item.title}`,
  });

  return jsonResponse({ item: toPublicWikiPage(item) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "wiki-pages"), { limit: 25, windowMs: 60_000 });
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
    update wiki_pages
    set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!item) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-wiki-page",
    targetType: "wiki-page",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicWikiPage(item) });
}

function normalizeWikiPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 160 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const contentVal = payload.content || " ";
  const content = normalizeText(contentVal, { field: "content", max: 32000 });
  if (content.error && content.error !== "empty_content") {
    return { error: content.error, extra: content.max ? { max: content.max } : {} };
  }

  const space = String(payload.space || "general").trim();
  const status = String(payload.status || "draft").trim();
  if (!validSpaces.has(space)) return { error: "invalid_space" };
  if (!validStatuses.has(status)) return { error: "invalid_status" };

  const parentId = String(payload.parentId || "").trim().slice(0, 64);
  const safeRef = sanitizeExternalUrl(payload.referenceUrl);
  if (safeRef.error) return { error: "invalid_reference_url" };

  const rawTags = Array.isArray(payload.tags) ? payload.tags.join(",") : String(payload.tags || "");
  const cleanTags = rawTags
    .split(",")
    .map((item) => item.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 8)
    .join(",");

  return {
    parentId,
    space,
    title: title.value,
    content: content.error === "empty_content" ? "" : content.value,
    status,
    referenceUrl: safeRef.value,
    tags: cleanTags,
  };
}
