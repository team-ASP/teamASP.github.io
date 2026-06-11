import { aspData } from "@/lib/data";
import { can, getSessionFromRequest } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicAuditEvent } from "@/lib/db";
import { jsonError, jsonResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);

  const staticEvents = (aspData.auditEvents || []).map((event) => ({
    id: event.id,
    actorLogin: event.actorId,
    action: event.action,
    targetType: "static",
    targetId: event.targetId,
    summary: event.summary,
    createdAt: event.createdAt,
  }));

  if (!isDatabaseConfigured()) {
    return jsonResponse({ configured: false, items: staticEvents });
  }

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`select * from audit_events order by created_at desc limit 100`;
  return jsonResponse({ configured: true, items: [...rows.map(toPublicAuditEvent), ...staticEvents] });
}
