import { randomUUID } from "node:crypto";
import { aspData } from "@/lib/data";
import { assertKnownTarget, jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, hideContentTarget, isDatabaseConfigured, listContentOverrides, toPublicTaskUpdate, writeAuditEvent } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validStatuses = new Set(["todo", "in-progress", "ready-for-review", "done"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [], hiddenTaskIds: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    select distinct on (task_id) *
    from task_updates
    order by task_id, created_at desc
  `;

  const items = rows.map(toPublicTaskUpdate).map((item) => ({
    ...item,
    note: session.authenticated ? item.note : "",
  }));
  const hiddenTaskIds = (await listContentOverrides({ targetType: "task" })).map((item) => item.targetId);
  return jsonResponse({ configured: true, items, hiddenTaskIds });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "task-updates"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["taskId", "status"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!assertKnownTarget("task", payload.taskId)) return jsonError("invalid_target", 400);
  if (!validStatuses.has(payload.status)) return jsonError("invalid_status", 400);

  const note = payload.note ? normalizeText(payload.note, { field: "note", max: 1200 }) : { value: "" };
  if (note.error) return jsonError(note.error, 400, note.max ? { max: note.max } : {});

  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [update] = await sql`
    insert into task_updates (id, task_id, status, note, author_login, author_name)
    values (${id}, ${payload.taskId}, ${payload.status}, ${note.value}, ${session.login}, ${session.name || session.login})
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-task-status",
    targetType: "task",
    targetId: payload.taskId,
    summary: `Task status changed to ${payload.status}`,
  });

  return jsonResponse({ item: toPublicTaskUpdate(update) }, { status: 201 });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "task-updates"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["taskId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!assertKnownTarget("task", payload.taskId)) return jsonError("invalid_target", 400);

  const reason = payload.reason ? normalizeText(payload.reason, { field: "reason", max: 500 }) : { value: "" };
  if (reason.error) return jsonError(reason.error, 400, reason.max ? { max: reason.max } : {});

  const task = aspData.tasks.find((item) => item.id === payload.taskId);
  const item = await hideContentTarget({
    projectId: task.projectId,
    targetType: "task",
    targetId: payload.taskId,
    reason: reason.value,
    actorLogin: session.login,
    actorName: session.name || session.login,
  });

  await writeAuditEvent({
    actorLogin: session.login,
    action: "hide-seed-task",
    targetType: "task",
    targetId: payload.taskId,
    summary: task.title,
  });

  return jsonResponse({ item });
}
