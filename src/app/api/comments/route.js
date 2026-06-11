import { randomUUID } from "node:crypto";
import { aspData } from "@/lib/data";
import { assertKnownTarget, jsonResponse, jsonError, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicComment, writeAuditEvent } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validScopes = new Set(["project", "session", "task", "log", "archive"]);
const validVisibility = new Set(["public", "team-only", "maintainer-only"]);

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "project";
  const targetId = searchParams.get("targetId");

  if (!validScopes.has(scope) || !targetId) {
    return jsonError("invalid_query", 400);
  }

  const staticComments = (aspData.comments || [])
    .filter((comment) => comment.scope === scope && comment.targetId === targetId)
    .filter((comment) => comment.visibility === "public" || session.authenticated)
    .map((comment) => ({
      id: comment.id,
      scope: comment.scope,
      targetId: comment.targetId,
      visibility: comment.visibility,
      body: comment.body,
      authorLogin: comment.authorId,
      authorName: comment.authorId,
      createdAt: comment.createdAt,
    }));

  if (!isDatabaseConfigured()) {
    return jsonResponse({ configured: false, items: staticComments });
  }

  await ensureSchema();
  const sql = getSql();
  const visibilityFilter = session.authenticated ? ["public", "team-only", "maintainer-only"] : ["public"];
  const rows = await sql`
    select *
    from comments
    where scope = ${scope}
      and target_id = ${targetId}
      and hidden_at is null
      and visibility in ${sql(visibilityFilter)}
    order by created_at asc
  `;

  return jsonResponse({ configured: true, items: [...staticComments, ...rows.map(toPublicComment)] });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "comment")) {
    return jsonError("forbidden", 403);
  }
  if (!verifyCsrf(request)) {
    return jsonError("csrf_failed", 403);
  }

  const limit = checkRateLimit(getRateLimitKey(request, session, "comments"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) {
    return jsonError("database_not_configured", 503);
  }

  const payload = await readJson(request);
  const missing = requireFields(payload, ["scope", "targetId", "body"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!validScopes.has(payload.scope) || !assertKnownTarget(payload.scope, payload.targetId)) {
    return jsonError("invalid_target", 400);
  }

  const visibility = payload.visibility || "team-only";
  if (!validVisibility.has(visibility)) return jsonError("invalid_visibility", 400);
  const body = normalizeText(payload.body, { field: "body", max: 2000 });
  if (body.error) return jsonError(body.error, 400, body.max ? { max: body.max } : {});

  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [comment] = await sql`
    insert into comments (id, scope, target_id, visibility, body, author_login, author_name)
    values (${id}, ${payload.scope}, ${payload.targetId}, ${visibility}, ${body.value}, ${session.login}, ${session.name || session.login})
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-comment",
    targetType: payload.scope,
    targetId: payload.targetId,
    summary: `Created ${visibility} comment`,
  });

  return jsonResponse({ item: toPublicComment(comment) }, { status: 201 });
}
