import { jsonResponse } from "@/lib/api";
import { ensureSchema, getSql, isDatabaseConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return jsonResponse({ ok: false, configured: false, error: "database_not_configured" }, { status: 503 });
  }

  await ensureSchema();
  const sql = getSql();
  const [result] = await sql`select 1 as ok`;
  return jsonResponse({ ok: result.ok === 1, configured: true });
}
