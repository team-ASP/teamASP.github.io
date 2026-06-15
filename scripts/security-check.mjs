import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function collectSourceFiles(directory) {
  const entries = readdirSync(join(root, directory));
  return entries.flatMap((entry) => {
    const path = `${directory}/${entry}`;
    if (path.startsWith("src/legacy/")) return [];
    const stat = statSync(join(root, path));
    if (stat.isDirectory()) return collectSourceFiles(path);
    return /\.(js|jsx|mjs)$/.test(path) ? [path] : [];
  });
}

const sourceFiles = collectSourceFiles("src");

for (const file of sourceFiles) {
  const body = read(file);
  assert(!body.includes("dangerouslySetInnerHTML"), `${file}: dangerouslySetInnerHTML is not allowed`);
  assert(!/NEXT_PUBLIC_[A-Z0-9_]*(SECRET|TOKEN|KEY)/.test(body), `${file}: secret-like values must not be public env vars`);
}

for (const file of [
  "src/app/api/comments/route.js",
  "src/app/api/drafts/route.js",
  "src/app/api/review-queue/route.js",
  "src/app/api/backlog-items/route.js",
  "src/app/api/archive-items/route.js",
  "src/app/api/content-overrides/route.js",
  "src/app/api/projects/route.js",
  "src/app/api/task-updates/route.js",
]) {
  const body = read(file);
  assert(body.includes("verifyCsrf"), `${file}: mutating route must verify CSRF token`);
  assert(body.includes("checkRateLimit"), `${file}: mutating route must rate-limit writes`);
  assert(body.includes("normalizeText"), `${file}: mutating route must validate text input`);
}

const meRoute = read("src/app/api/me/route.js");
assert(meRoute.includes("force-dynamic"), "src/app/api/me/route.js: session API must be dynamic");
assert(meRoute.includes("jsonResponse"), "src/app/api/me/route.js: session API must send no-store headers");

const nextConfig = read("next.config.mjs");
for (const header of ["X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]) {
  assert(nextConfig.includes(header), `next.config.mjs: missing security header ${header}`);
}

if (failures.length > 0) {
  console.error("Security checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Security checks passed for ${sourceFiles.length} source files.`);
