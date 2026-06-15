import { randomUUID } from "node:crypto";
import { aspData } from "@/lib/data";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { ensureSchema, getSql, hideContentTarget, isDatabaseConfigured, listContentOverrides, toPublicReview, writeAuditEvent } from "@/lib/db";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getStaticReviewItems(hiddenIds = new Set()) {
  return aspData.reviewQueue
    .filter((item) => !hiddenIds.has(item.id))
    .map((item) => ({
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
    canAdmin: can(session.role, "admin"),
  };

  if (!isDatabaseConfigured()) {
    return jsonResponse({ configured: false, items: getStaticReviewItems(), permissions });
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`select * from review_items where deleted_at is null order by created_at desc limit 100`;
  const hiddenStaticReviewIds = new Set((await listContentOverrides({ projectId: "global", targetType: "review" })).map((item) => item.targetId));
  return jsonResponse({ configured: true, items: [...rows.map(toPublicReview), ...getStaticReviewItems(hiddenStaticReviewIds)], permissions });
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "review"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
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

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "review")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "review"), { limit: 20, windowMs: 60_000 });
  if (!limit.ok) {
    return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["reviewId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  const staticReview = aspData.reviewQueue.find((item) => item.id === payload.reviewId);
  if (staticReview) {
    if (!can(session.role, "admin")) return jsonError("forbidden", 403);
    const reason = payload.note ? normalizeText(payload.note, { field: "note", max: 500 }) : { value: "" };
    if (reason.error) return jsonError(reason.error, 400, reason.max ? { max: reason.max } : {});

    const item = await hideContentTarget({
      projectId: "global",
      targetType: "review",
      targetId: staticReview.id,
      reason: reason.value,
      actorLogin: session.login,
      actorName: session.name || session.login,
    });

    await writeAuditEvent({
      actorLogin: session.login,
      action: "hide-static-review",
      targetType: "review",
      targetId: staticReview.id,
      summary: staticReview.title,
    });

    return jsonResponse({
      item: {
        ...staticReview,
        sourceType: "static",
        sourceId: staticReview.target,
        ownerLogin: staticReview.ownerId,
        status: "hidden",
        override: item,
      },
    });
  }

  await ensureSchema();
  const sql = getSql();
  const [review] = await sql`
    update review_items
    set deleted_at = now()
    where id = ${payload.reviewId} and deleted_at is null
    returning *
  `;
  if (!review) return jsonError("not_found", 404);
  await sql`update drafts set status = 'draft', updated_at = now() where id = ${review.source_id} and deleted_at is null`;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-review-item",
    targetType: "review",
    targetId: review.id,
    summary: review.title,
  });

  return jsonResponse({ item: toPublicReview(review) });
}

async function submitDraftForReview(payload, session) {
  if (!can(session.role, "draft")) return jsonError("forbidden", 403);
  const missing = requireFields(payload, ["draftId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });

  await ensureSchema();
  const sql = getSql();
  const [draft] = await sql`select * from drafts where id = ${payload.draftId} and deleted_at is null`;
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

  return jsonResponse({ item: toPublicReview(review) }, { status: 201 });
}

async function reviewItem(payload, session) {
  if (!can(session.role, "review")) return jsonError("forbidden", 403);
  const missing = requireFields(payload, ["reviewId"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  const note = payload.note ? normalizeText(payload.note, { field: "note", max: 2000 }) : { value: "" };
  if (note.error) return jsonError(note.error, 400, note.max ? { max: note.max } : {});

  const nextStatus = payload.action === "approve" ? "published" : "changes-requested";
  await ensureSchema();
  const sql = getSql();
  const [review] = await sql`
    update review_items
    set status = ${nextStatus}, reviewer_login = ${session.login}, review_note = ${note.value}, reviewed_at = now()
    where id = ${payload.reviewId} and deleted_at is null
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

  return jsonResponse({ item: toPublicReview(review) });
}
