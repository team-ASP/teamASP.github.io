import { NextResponse } from "next/server";
import { ensureSchema, getSql, isDatabaseConfigured } from "@/lib/db";

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: false, configured: false, error: "database_not_configured" }, { status: 503 });
  }

  await ensureSchema();
  const sql = getSql();
  const [result] = await sql`select 1 as ok`;
  return NextResponse.json({ ok: result.ok === 1, configured: true });
}
