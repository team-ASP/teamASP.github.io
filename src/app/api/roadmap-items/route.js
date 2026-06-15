import { randomUUID } from "node:crypto";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicRoadmapItem, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validStatuses = new Set(["planned", "in-progress", "blocked", "done"]);

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
    from roadmap_items
    where project_id = ${projectId} and deleted_at is null
    order by start_date nulls last, created_at asc
    limit 100
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicRoadmapItem) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "project")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "roadmap-items"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "title"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!(await projectExists(payload.projectId))) return jsonError("invalid_project", 400);

  const normalized = normalizeRoadmapPayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into roadmap_items (id, project_id, title, timeframe, status, summary, owner_login, author_login, author_name, start_date, end_date)
    values (
      ${randomUUID()},
      ${payload.projectId},
      ${normalized.title},
      ${normalized.timeframe},
      ${normalized.status},
      ${normalized.summary},
      ${session.login},
      ${session.login},
      ${session.name || session.login},
      ${normalized.startDate},
      ${normalized.endDate}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-roadmap-item",
    targetType: "roadmap",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicRoadmapItem(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "project")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "roadmap-items"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from roadmap_items where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeRoadmapPayload({
    title: payload.title ?? existing.title,
    timeframe: payload.timeframe ?? existing.timeframe,
    status: payload.status ?? existing.status,
    summary: payload.summary ?? existing.summary,
    startDate: payload.startDate ?? existing.start_date,
    endDate: payload.endDate ?? existing.end_date,
  });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update roadmap_items
    set title = ${normalized.title},
        timeframe = ${normalized.timeframe},
        status = ${normalized.status},
        summary = ${normalized.summary},
        start_date = ${normalized.startDate},
        end_date = ${normalized.endDate},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-roadmap-item",
    targetType: "roadmap",
    targetId: item.id,
    summary: `${item.title} -> ${item.status}`,
  });

  return jsonResponse({ item: toPublicRoadmapItem(item) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "project")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "roadmap-items"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    update roadmap_items
    set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!item) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-roadmap-item",
    targetType: "roadmap",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicRoadmapItem(item) });
}

function normalizeRoadmapPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const timeframeValue = payload.timeframe || " ";
  const timeframe = normalizeText(timeframeValue, { field: "timeframe", max: 80 });
  if (timeframe.error) timeframe.value = "";

  const summaryValue = payload.summary || " ";
  const summary = normalizeText(summaryValue, { field: "summary", max: 2000 });
  if (summary.error) summary.value = "";

  const status = payload.status || "planned";
  if (!validStatuses.has(status)) return { error: "invalid_status" };

  return {
    title: title.value,
    timeframe: timeframe.value || "",
    status,
    summary: summary.value || "",
    startDate: normalizeDate(payload.startDate),
    endDate: normalizeDate(payload.endDate),
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}
