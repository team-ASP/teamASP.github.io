import { randomUUID } from "node:crypto";
import { assertKnownTarget, jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicDraft, writeAuditEvent } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validTypes = new Set(["session-note", "task-update", "experiment-log", "archive-note"]);
const validStatuses = new Set(["draft", "review", "published", "changes-requested"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = can(session.role, "review")
    ? await sql`select * from drafts order by updated_at desc limit 100`
    : await sql`select * from drafts where author_login = ${session.login} order by updated_at desc limit 100`;

  return jsonResponse({ configured: true, items: rows.map(toPublicDraft) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "drafts"), { limit: 12, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["type", "targetId", "title", "body"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!validTypes.has(payload.type)) return jsonError("invalid_type", 400);
  if (!assertKnownTarget("project", payload.targetId)) return jsonError("invalid_target", 400);
  const title = normalizeText(payload.title, { field: "title", max: 120 });
  const body = normalizeText(payload.body, { field: "body", max: 10000 });
  if (title.error) return jsonError(title.error, 400, title.max ? { max: title.max } : {});
  if (body.error) return jsonError(body.error, 400, body.max ? { max: body.max } : {});

  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [draft] = await sql`
    insert into drafts (id, type, target_id, title, body, author_login, author_name)
    values (${id}, ${payload.type}, ${payload.targetId}, ${title.value}, ${body.value}, ${session.login}, ${session.name || session.login})
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-draft",
    targetType: payload.type,
    targetId: id,
    summary: payload.title,
  });

  return jsonResponse({ item: toPublicDraft(draft) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "drafts"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from drafts where id = ${payload.id}`;
  if (!existing) return jsonError("not_found", 404);
  if (existing.author_login !== session.login && !can(session.role, "review")) return jsonError("forbidden", 403);

  const normalizedTitle = payload.title ? normalizeText(payload.title, { field: "title", max: 120 }) : { value: existing.title };
  const normalizedBody = payload.body ? normalizeText(payload.body, { field: "body", max: 10000 }) : { value: existing.body };
  if (normalizedTitle.error) return jsonError(normalizedTitle.error, 400, normalizedTitle.max ? { max: normalizedTitle.max } : {});
  if (normalizedBody.error) return jsonError(normalizedBody.error, 400, normalizedBody.max ? { max: normalizedBody.max } : {});

  const nextTitle = normalizedTitle.value;
  const nextBody = normalizedBody.value;
  const nextStatus = payload.status || existing.status;
  if (!validStatuses.has(nextStatus)) return jsonError("invalid_status", 400);
  const [draft] = await sql`
    update drafts
    set title = ${nextTitle}, body = ${nextBody}, status = ${nextStatus}, updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-draft",
    targetType: draft.type,
    targetId: draft.id,
    summary: draft.title,
  });

  return jsonResponse({ item: toPublicDraft(draft) });
}
