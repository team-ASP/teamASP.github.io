import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { BenchmarkViewer } from "@/components/benchmark-viewer";

export const metadata = {
  title: "Benchmark | ASP Study Hub",
  description: "Mafia AI Agent 6D Social Deduction Benchmark Leaderboard (V3 Rubric)",
};

function loadBenchmarkPayload() {
  const filePath = join(process.cwd(), "public", "data", "benchmark_leaderboard.json");
  if (!existsSync(filePath)) {
    return { generated_at: "", benchmark_type: "V3 6D Rubric", leaderboard: [] };
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return { generated_at: "", benchmark_type: "V3 6D Rubric", leaderboard: [] };
  }
}

export default function BenchmarkPage() {
  const payload = loadBenchmarkPayload();
  return <BenchmarkViewer initialData={payload} />;
}
