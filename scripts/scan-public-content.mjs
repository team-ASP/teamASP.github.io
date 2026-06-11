import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const scanRoots = ["src", "docs", "README.md"];
const secretPatterns = [
  /api[_-]?key\s*[:=]\s*["'][^"']{8,}/i,
  /token\s*[:=]\s*["'][^"']{12,}/i,
  /secret\s*[:=]\s*["'][^"']{12,}/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/,
];

const errors = [];

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      if (["node_modules", ".next", ".git"].includes(entry)) continue;
      walk(join(path, entry));
    }
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(content)) {
      errors.push(`Potential secret pattern in ${path}`);
    }
  }
}

for (const target of scanRoots) {
  walk(join(root, target));
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Public content scan passed.");
