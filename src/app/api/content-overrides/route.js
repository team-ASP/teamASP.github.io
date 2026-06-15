import { aspData } from "@/lib/data";
import { assertKnownTarget, jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { hideContentTarget, isDatabaseConfigured, listContentOverrides, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validTargetTypes = new Set(["task", "review", "archive-checklist"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId") || "";
  const targetType = searchParams.get("targetType") || "";

  if (targetType && !validTargetTypes.has(targetType)) return jsonError("invalid_target_type", 400);
  if (projectId && !(await projectExists(projectId))) return jsonError("invalid_project", 400);
  if (!isDatabaseConfigured()) return jsonResponse({ configured: false, items: [] });

  const items = await listContentOverrides({ projectId, targetType });
  return jsonResponse({ configured: true, items });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "content-overrides"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "targetType", "targetId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!validTargetTypes.has(payload.targetType)) return jsonError("invalid_target_type", 400);
  if (!(await isValidOverrideTarget(payload))) return jsonError("invalid_target", 400);

  const reason = payload.reason ? normalizeText(payload.reason, { field: "reason", max: 500 }) : { value: "" };
  if (reason.error) return jsonError(reason.error, 400, reason.max ? { max: reason.max } : {});

  const item = await hideContentTarget({
    projectId: payload.projectId,
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: reason.value,
    actorLogin: session.login,
    actorName: session.name || session.login,
  });

  await writeAuditEvent({
    actorLogin: session.login,
    action: "hide-static-content",
    targetType: payload.targetType,
    targetId: payload.targetId,
    summary: reason.value || `Hidden ${payload.targetType}`,
  });

  return jsonResponse({ item }, { status: 201 });
}

async function isValidOverrideTarget(payload) {
  if (payload.targetType === "task") {
    const task = aspData.tasks.find((item) => item.id === payload.targetId);
    return Boolean(task && task.projectId === payload.projectId);
  }

  if (payload.targetType === "review") {
    return payload.projectId === "global" && aspData.reviewQueue.some((item) => item.id === payload.targetId);
  }

  if (payload.targetType === "archive-checklist") {
    if (!(await projectExists(payload.projectId))) return false;
    const archive = aspData.archive.find((item) => item.projectId === payload.projectId);
    const prefix = `${payload.projectId}:`;
    if (!archive || !String(payload.targetId).startsWith(prefix)) return false;
    const label = String(payload.targetId).slice(prefix.length);
    return archive.required.includes(label);
  }

  return assertKnownTarget(payload.targetType, payload.targetId);
}
