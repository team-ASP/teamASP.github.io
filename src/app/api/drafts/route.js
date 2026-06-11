import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicDraft, writeAuditEvent } from "@/lib/db";

const validTypes = new Set(["session-note", "task-update", "experiment-log", "archive-note"]);

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!isDatabaseConfigured()) return NextResponse.json({ configured: false, items: [] });

  await ensureSchema();
  const sql = getSql();
  const rows = can(session.role, "review")
    ? await sql`select * from drafts order by updated_at desc limit 100`
    : await sql`select * from drafts where author_login = ${session.login} order by updated_at desc limit 100`;

  return NextResponse.json({ configured: true, items: rows.map(toPublicDraft) });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["type", "targetId", "title", "body"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (!validTypes.has(payload.type)) return jsonError("invalid_type", 400);

  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [draft] = await sql`
    insert into drafts (id, type, target_id, title, body, author_login, author_name)
    values (${id}, ${payload.type}, ${payload.targetId}, ${payload.title}, ${payload.body}, ${session.login}, ${session.name || session.login})
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-draft",
    targetType: payload.type,
    targetId: id,
    summary: payload.title,
  });

  return NextResponse.json({ item: toPublicDraft(draft) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from drafts where id = ${payload.id}`;
  if (!existing) return jsonError("not_found", 404);
  if (existing.author_login !== session.login && !can(session.role, "review")) return jsonError("forbidden", 403);

  const nextTitle = payload.title || existing.title;
  const nextBody = payload.body || existing.body;
  const nextStatus = payload.status || existing.status;
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

  return NextResponse.json({ item: toPublicDraft(draft) });
}
