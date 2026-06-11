import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { aspData } from "@/lib/data";
import { can, getSessionFromRequest } from "@/lib/auth";
import { jsonError, readJson, requireFields } from "@/lib/api";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicReview, writeAuditEvent } from "@/lib/db";

function getStaticReviewItems() {
  return aspData.reviewQueue.map((item) => ({
    ...item,
    sourceType: "static",
    sourceId: item.target,
    ownerLogin: item.ownerId,
  }));
}

export async function GET(request) {
  const session = getSessionFromRequest(request);
  const permissions = {
    canReview: can(session.role, "review"),
    canArchive: can(session.role, "archive"),
  };

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false, items: getStaticReviewItems(), permissions });
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`select * from review_items order by created_at desc limit 100`;
  return NextResponse.json({ configured: true, items: [...rows.map(toPublicReview), ...getStaticReviewItems()], permissions });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  if (payload.action === "submit-draft") {
    return submitDraftForReview(payload, session);
  }

  if (payload.action === "approve" || payload.action === "request-changes") {
    return reviewItem(payload, session);
  }

  return jsonError("invalid_action", 400);
}

async function submitDraftForReview(payload, session) {
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  const missing = requireFields(payload, ["draftId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [draft] = await sql`select * from drafts where id = ${payload.draftId}`;
  if (!draft) return jsonError("not_found", 404);
  if (draft.author_login !== session.login && !can(session.role, "review")) return jsonError("forbidden", 403);

  const [review] = await sql`
    insert into review_items (id, source_type, source_id, title, target, owner_login)
    values (${randomUUID()}, ${draft.type}, ${draft.id}, ${draft.title}, ${draft.target_id}, ${draft.author_login})
    returning *
  `;
  await sql`update drafts set status = 'review', updated_at = now() where id = ${draft.id}`;
  await writeAuditEvent({
    actorLogin: session.login,
    action: "submit-draft-review",
    targetType: draft.type,
    targetId: draft.id,
    summary: draft.title,
  });

  return NextResponse.json({ item: toPublicReview(review) }, { status: 201 });
}

async function reviewItem(payload, session) {
  if (!can(session.role, "review")) return jsonError("forbidden", 403);
  const missing = requireFields(payload, ["reviewId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  const nextStatus = payload.action === "approve" ? "published" : "changes-requested";
  await ensureSchema();
  const sql = getSql();
  const [review] = await sql`
    update review_items
    set status = ${nextStatus}, reviewer_login = ${session.login}, review_note = ${payload.note || ""}, reviewed_at = now()
    where id = ${payload.reviewId}
    returning *
  `;
  if (!review) return jsonError("not_found", 404);

  await sql`update drafts set status = ${nextStatus}, updated_at = now() where id = ${review.source_id}`;
  await writeAuditEvent({
    actorLogin: session.login,
    action: payload.action,
    targetType: "review",
    targetId: review.id,
    summary: review.title,
  });

  return NextResponse.json({ item: toPublicReview(review) });
}
