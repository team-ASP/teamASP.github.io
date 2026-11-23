import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { jsonResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = join(process.cwd(), "public", "data", "benchmark_leaderboard.json");
  if (!existsSync(filePath)) {
    return jsonResponse({ generated_at: "", benchmark_type: "V3 6D Rubric", leaderboard: [] });
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return jsonResponse(parsed);
  } catch {
    return jsonResponse({ generated_at: "", benchmark_type: "V3 6D Rubric", leaderboard: [] });
  }
}
