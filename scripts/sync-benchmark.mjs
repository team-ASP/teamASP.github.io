import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "../MafiaAgentBenchmark/leaderboard/data/leaderboard_data.json");
const dst = join(root, "public/data/benchmark_leaderboard.json");

if (!existsSync(src)) {
  console.error(`Source benchmark dataset not found: ${src}`);
  process.exit(1);
}

const raw = readFileSync(src, "utf8");
const parsed = JSON.parse(raw);
if (!Array.isArray(parsed.leaderboard)) {
  console.error("Invalid leaderboard_data.json payload.");
  process.exit(1);
}

mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`Synced ${parsed.leaderboard.length} benchmark entries -> public/data/benchmark_leaderboard.json`);
