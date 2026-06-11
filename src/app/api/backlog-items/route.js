import { randomUUID } from "node:crypto";
import { assertKnownTarget, jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicBacklogItem, writeAuditEvent } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validStatuses = new Set(["todo", "in-progress", "ready-for-review", "done"]);
const validTypes = new Set(["task", "bug", "research", "decision", "archive"]);
const validPriorities = new Set(["low", "medium", "high"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId || !assertKnownTarget("project", projectId)) return jsonError("invalid_project", 400);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    select *
    from backlog_items
    where project_id = ${projectId}
    order by updated_at desc
    limit 200
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicBacklogItem) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "backlog-items"), { limit: 24, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "title"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!assertKnownTarget("project", payload.projectId)) return jsonError("invalid_project", 400);

  const normalized = normalizeBacklogPayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into backlog_items (id, project_id, title, description, type, status, priority, owner_login, author_login, author_name, due_date)
    values (
      ${randomUUID()},
      ${payload.projectId},
      ${normalized.title},
      ${normalized.description},
      ${normalized.type},
      ${normalized.status},
      ${normalized.priority},
      ${session.login},
      ${session.login},
      ${session.name || session.login},
      ${normalized.due}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-backlog-item",
    targetType: "backlog",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicBacklogItem(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "backlog-items"), { limit: 40, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from backlog_items where id = ${payload.id}`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeBacklogPayload(
    {
      title: payload.title ?? existing.title,
      description: payload.description ?? existing.description,
      type: payload.type ?? existing.type,
      status: payload.status ?? existing.status,
      priority: payload.priority ?? existing.priority,
      due: payload.due ?? existing.due_date,
    },
    { allowEmptyDescription: true },
  );
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update backlog_items
    set title = ${normalized.title},
        description = ${normalized.description},
        type = ${normalized.type},
        status = ${normalized.status},
        priority = ${normalized.priority},
        due_date = ${normalized.due},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-backlog-item",
    targetType: "backlog",
    targetId: item.id,
    summary: `${item.title} -> ${item.status}`,
  });

  return jsonResponse({ item: toPublicBacklogItem(item) });
}

function normalizeBacklogPayload(payload, { allowEmptyDescription = true } = {}) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const descriptionValue = payload.description || (allowEmptyDescription ? " " : "");
  const description = normalizeText(descriptionValue, { field: "description", max: 2000 });
  if (description.error && !allowEmptyDescription) return { error: description.error, extra: description.max ? { max: description.max } : {} };
  if (description.error && allowEmptyDescription) description.value = "";

  const type = payload.type || "task";
  const status = payload.status || "todo";
  const priority = payload.priority || "medium";
  if (!validTypes.has(type)) return { error: "invalid_type" };
  if (!validStatuses.has(status)) return { error: "invalid_status" };
  if (!validPriorities.has(priority)) return { error: "invalid_priority" };

  const due = payload.due ? String(payload.due).slice(0, 10) : null;
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { error: "invalid_due" };

  return {
    title: title.value,
    description: description.value || "",
    type,
    status,
    priority,
    due,
  };
}
