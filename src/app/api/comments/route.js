import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { aspData } from "@/lib/data";
import { assertKnownTarget, jsonError, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicComment, writeAuditEvent } from "@/lib/db";

const validScopes = new Set(["project", "session", "task", "log", "archive"]);
const validVisibility = new Set(["public", "team-only", "maintainer-only"]);

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
    return NextResponse.json({ configured: false, items: staticComments });
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

  return NextResponse.json({ configured: true, items: [...staticComments, ...rows.map(toPublicComment)] });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "comment")) {
    return jsonError("forbidden", 403);
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

  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [comment] = await sql`
    insert into comments (id, scope, target_id, visibility, body, author_login, author_name)
    values (${id}, ${payload.scope}, ${payload.targetId}, ${visibility}, ${payload.body}, ${session.login}, ${session.name || session.login})
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-comment",
    targetType: payload.scope,
    targetId: payload.targetId,
    summary: `Created ${visibility} comment`,
  });

  return NextResponse.json({ item: toPublicComment(comment) }, { status: 201 });
}
