import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Suspense } from "react";
import { WorkspaceClient } from "@/components/workspace-client";
import { aspData } from "@/lib/data";

export const metadata = {
  title: "Workspace | ASP Study Hub v2",
};

function loadInitialBenchmark() {
  const filePath = join(process.cwd(), "public", "data", "benchmark_leaderboard.json");
  if (!existsSync(filePath)) return { generated_at: "", leaderboard: [] };
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return { generated_at: "", leaderboard: [] };
  }
}

export default function WorkspacePage() {
  const initialBenchmark = loadInitialBenchmark();
  return (
    <Suspense fallback={<div className="v2-loading-shell">ASP Study Hub v2 로딩 중...</div>}>
      <WorkspaceClient data={aspData} initialBenchmark={initialBenchmark} />
    </Suspense>
  );
}
