import { randomUUID } from "node:crypto";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicDecisionRecord, writeAuditEvent } from "@/lib/db";
import { projectExists } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validStatuses = new Set(["proposed", "accepted", "superseded"]);

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
    from decision_records
    where project_id = ${projectId} and deleted_at is null
    order by decided_at desc nulls last, updated_at desc
    limit 100
  `;
  return jsonResponse({ configured: true, items: rows.map(toPublicDecisionRecord) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "decision-records"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["projectId", "title", "decision"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!(await projectExists(payload.projectId))) return jsonError("invalid_project", 400);

  const normalized = normalizeDecisionPayload(payload);
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    insert into decision_records (id, project_id, title, status, context, decision, impact, owner_login, author_login, author_name, decided_at)
    values (
      ${randomUUID()},
      ${payload.projectId},
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

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-decision-record",
    targetType: "decision",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicDecisionRecord(item) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "decision-records"), { limit: 30, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from decision_records where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeDecisionPayload({
    title: payload.title ?? existing.title,
    status: payload.status ?? existing.status,
    context: payload.context ?? existing.context,
    decision: payload.decision ?? existing.decision,
    impact: payload.impact ?? existing.impact,
    decidedAt: payload.decidedAt ?? existing.decided_at,
  });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [item] = await sql`
    update decision_records
    set title = ${normalized.title},
        status = ${normalized.status},
        context = ${normalized.context},
        decision = ${normalized.decision},
        impact = ${normalized.impact},
        decided_at = ${normalized.decidedAt},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-decision-record",
    targetType: "decision",
    targetId: item.id,
    summary: `${item.title} -> ${item.status}`,
  });

  return jsonResponse({ item: toPublicDecisionRecord(item) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "decision-records"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [item] = await sql`
    update decision_records
    set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!item) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-decision-record",
    targetType: "decision",
    targetId: item.id,
    summary: item.title,
  });

  return jsonResponse({ item: toPublicDecisionRecord(item) });
}

function normalizeDecisionPayload(payload) {
  const title = normalizeText(payload.title, { field: "title", max: 140 });
  if (title.error) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const decision = normalizeText(payload.decision, { field: "decision", max: 4000 });
  if (decision.error) return { error: decision.error, extra: decision.max ? { max: decision.max } : {} };

  const contextValue = payload.context || " ";
  const context = normalizeText(contextValue, { field: "context", max: 4000 });
  if (context.error) context.value = "";

  const impactValue = payload.impact || " ";
  const impact = normalizeText(impactValue, { field: "impact", max: 4000 });
  if (impact.error) impact.value = "";

  const status = payload.status || "proposed";
  if (!validStatuses.has(status)) return { error: "invalid_status" };

  return {
    title: title.value,
    status,
    context: context.value || "",
    decision: decision.value,
    impact: impact.value || "",
    decidedAt: normalizeDate(payload.decidedAt),
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}
