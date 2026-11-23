import { randomUUID } from "node:crypto";
import { aspData } from "@/lib/data";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import {
  ensureSchema,
  getSql,
  isDatabaseConfigured,
  toPublicBacklogItem,
  toPublicContentOverride,
  toPublicDecisionRecord,
  toPublicRoadmapItem,
  writeAuditEvent,
} from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validTargetTypes = new Set(["roadmap", "decision", "task"]);
const roadmapStatuses = new Set(["planned", "in-progress", "blocked", "done"]);
const decisionStatuses = new Set(["proposed", "accepted", "superseded"]);
const taskStatuses = new Set(["todo", "in-progress", "ready-for-review", "done"]);
const taskTypes = new Set(["task", "bug", "research", "decision", "archive"]);
const taskPriorities = new Set(["low", "medium", "high"]);

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!session.authenticated) return jsonError("auth_required", 401);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "static-content-promote"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "targetType", "targetId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!validTargetTypes.has(payload.targetType)) return jsonError("invalid_target_type", 400);
  const requiredAction = payload.targetType === "task" ? "draft" : "admin";
  if (!can(session.role, requiredAction)) return jsonError("forbidden", 403);
  if (!(await projectExists(payload.projectId))) return jsonError("invalid_project", 400);

  const target = findStaticTarget(payload.projectId, payload.targetType, payload.targetId);
  if (!target) return jsonError("invalid_target", 400);

  const itemPayload = payload.item && typeof payload.item === "object" ? payload.item : {};
  const normalized =
    payload.targetType === "roadmap"
      ? normalizeRoadmapPayload({ ...target.defaults, ...itemPayload })
      : payload.targetType === "decision"
        ? normalizeDecisionPayload({ ...target.defaults, ...itemPayload })
        : normalizeTaskPayload({ ...target.defaults, ...itemPayload });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const result = await sql.begin(async (tx) => {
    const item =
      payload.targetType === "roadmap"
        ? await insertRoadmapItem(tx, payload.projectId, normalized, session)
        : payload.targetType === "decision"
          ? await insertDecisionRecord(tx, payload.projectId, normalized, session)
          : await insertBacklogItem(tx, payload.projectId, normalized, session);
    const override = await ensureReplacementOverride(tx, {
      projectId: payload.projectId,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: `Template promoted to editable ${payload.targetType}: ${normalized.title}`,
      actorLogin: session.login,
      actorName: session.name || session.login,
    });
    return { item, override };
  });

  await writeAuditEvent({
    actorLogin: session.login,
    action: `promote-static-${payload.targetType}`,
    targetType: payload.targetType,
    targetId: result.item.id,
    summary: `Template ${payload.targetId} -> ${normalized.title}`,
  });

  return jsonResponse(
    {
      item:
        payload.targetType === "roadmap"
          ? toPublicRoadmapItem(result.item)
          : payload.targetType === "decision"
            ? toPublicDecisionRecord(result.item)
            : toPublicBacklogItem(result.item),
      override: toPublicContentOverride(result.override),
    },
    { status: 201 },
  );
}

function findStaticTarget(projectId, targetType, targetId) {
  if (targetType === "roadmap") {
    const project = aspData.projects.find((item) => item.id === projectId);
    const milestone = project?.milestones?.find((item) => item.id === targetId);
    if (!milestone) return null;
    return {
      defaults: {
        title: milestone.title,
        timeframe: milestone.week ? `Week ${milestone.week}` : "",
        status: milestone.status || "planned",
        summary: milestone.deliverables?.join(" · ") || "",
        startDate: "",
        endDate: "",
      },
    };
  }

  if (targetType === "task") {
    const task = aspData.tasks.find((item) => item.id === targetId && item.projectId === projectId);
    if (!task) return null;
    return {
      defaults: {
        title: task.title,
        description: task.description || "",
        type: task.type || "task",
        status: task.status || "todo",
        priority: task.priority || "medium",
        tags: Array.isArray(task.tags) ? task.tags.join(",") : "",
        due: task.due || null,
      },
    };
  }

  const log = aspData.logs.find((item) => item.id === targetId);
  if (!log || log.projectId !== projectId || log.type !== "decision") return null;
  return {
    defaults: {
      title: log.title,
      status: "accepted",
      context: "",
      decision: log.summary,
      impact: "",
      decidedAt: log.date || "",
    },
  };
}

async function insertBacklogItem(tx, projectId, normalized, session) {
  const [item] = await tx`
    insert into backlog_items (id, project_id, title, description, type, status, priority, tags, owner_login, author_login, author_name, due_date)
    values (
      ${randomUUID()},
      ${projectId},
      ${normalized.title},
      ${normalized.description},
      ${normalized.type},
      ${normalized.status},
      ${normalized.priority},
      ${normalized.tags},
      ${session.login},
      ${session.login},
      ${session.name || session.login},
      ${normalized.due}
    )
    returning *
  `;
  return item;
}

async function insertRoadmapItem(tx, projectId, normalized, session) {
  const [item] = await tx`
    insert into roadmap_items (id, project_id, title, timeframe, status, summary, owner_login, author_login, author_name, start_date, end_date)
    values (
      ${randomUUID()},
      ${projectId},
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
  return item;
}

async function insertDecisionRecord(tx, projectId, normalized, session) {
  const [item] = await tx`
    insert into decision_records (id, project_id, title, status, context, decision, impact, owner_login, author_login, author_name, decided_at)
    values (
      ${randomUUID()},
      ${projectId},
      ${normalized.title},
      ${normalized.status},
      ${normalized.context},
      ${normalized.decision},
      ${normalized.impact},
      ${session.login},
      ${session.login},
      ${session.name || session.login},
      ${normalized.decidedAt}
    )
    returning *
  `;
  return item;
}

async function ensureReplacementOverride(tx, { projectId, targetType, targetId, reason, actorLogin, actorName }) {
  const [existing] = await tx`
    select *
    from content_overrides
    where project_id = ${projectId}
      and target_type = ${targetType}
      and target_id = ${targetId}
      and action = 'hidden'
      and revoked_at is null
    limit 1
  `;
  if (existing) return existing;

  const [override] = await tx`
    insert into content_overrides (id, project_id, target_type, target_id, action, reason, actor_login, actor_name)
    values (${randomUUID()}, ${projectId}, ${targetType}, ${targetId}, 'hidden', ${reason}, ${actorLogin}, ${actorName})
    returning *
  `;
  return override;
}

function normalizeRoadmapPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const timeframe = normalizeOptionalText(payload.timeframe, "timeframe", 80);
  if (timeframe.error) return timeframe;

  const summary = normalizeOptionalText(payload.summary, "summary", 2000);
  if (summary.error) return summary;

  const status = payload.status || "planned";
  if (!roadmapStatuses.has(status)) return { error: "invalid_status" };

  return {
    title: title.value,
    timeframe: timeframe.value,
    status,
    summary: summary.value,
    startDate: normalizeDate(payload.startDate),
    endDate: normalizeDate(payload.endDate),
  };
}

function normalizeDecisionPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const decision = normalizeText(payload.decision, { field: "decision", max: 4000 });
  if (decision.error) return { error: decision.error, extra: decision.max ? { max: decision.max } : {} };

  const context = normalizeOptionalText(payload.context, "context", 4000);
  if (context.error) return context;

  const impact = normalizeOptionalText(payload.impact, "impact", 4000);
  if (impact.error) return impact;

  const status = payload.status || "proposed";
  if (!decisionStatuses.has(status)) return { error: "invalid_status" };

  return {
    title: title.value,
    status,
    context: context.value,
    decision: decision.value,
    impact: impact.value,
    decidedAt: normalizeDate(payload.decidedAt),
  };
}

function normalizeOptionalText(value, field, max) {
  if (!value) return { value: "" };
  const normalized = normalizeText(String(value), { field, max });
  if (normalized.error && normalized.error === `empty_${field}`) return { value: "" };
  if (normalized.error) return { error: normalized.error, extra: normalized.max ? { max: normalized.max } : {} };
  return normalized;
}

function normalizeDate(value) {
  if (!value) return null;
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizeTaskPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const description = normalizeOptionalText(payload.description, "description", 8000);
  if (description.error) return description;

  const type = payload.type || "task";
  const status = payload.status || "todo";
  const priority = payload.priority || "medium";
  if (!taskTypes.has(type)) return { error: "invalid_type" };
  if (!taskStatuses.has(status)) return { error: "invalid_status" };
  if (!taskPriorities.has(priority)) return { error: "invalid_priority" };

  const rawTags = Array.isArray(payload.tags) ? payload.tags.join(",") : String(payload.tags || "");
  const cleanTags = rawTags
    .split(",")
    .map((item) => item.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 6)
    .join(",");

  return {
    title: title.value,
    description: description.value || "",
    type,
    status,
    priority,
    tags: cleanTags,
    due: normalizeDate(payload.due),
  };
}
