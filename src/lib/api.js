import { NextResponse } from "next/server";
import { aspData } from "@/lib/data";

export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export function jsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...noStoreHeaders,
      ...(init.headers || {}),
    },
  });
}

export function jsonError(error, status = 400, extra = {}, headers = {}) {
  return jsonResponse({ error, ...extra }, { status, headers });
}

const MAX_JSON_BYTES = 100 * 1024;

export async function readJson(request) {
  try {
    const raw = await request.text();
    if (!raw || Buffer.byteLength(raw, "utf8") > MAX_JSON_BYTES) return {};
    const parsed = JSON.parse(raw, (key, value) => {
      if (key === "__proto__" || key === "constructor" || key === "prototype") return undefined;
      return value;
    });
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function sanitizeExternalUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  if (!trimmed) return { value: "" };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { error: "invalid_url" };
    }
    return { value: parsed.href };
  } catch {
    return { error: "invalid_url" };
  }
}

export function requireFields(payload, fields) {
  const missing = fields.filter((field) => !payload[field]);
  return missing;
}

export function assertKnownTarget(scope, targetId) {
  const targetSets = {
    project: new Set(aspData.projects.map((item) => item.id)),
    session: new Set(aspData.sessions.map((item) => item.id)),
    task: new Set(aspData.tasks.map((item) => item.id)),
    log: new Set(aspData.logs.map((item) => item.id)),
    archive: new Set(aspData.archive.map((item) => item.id)),
  };

  return targetSets[scope]?.has(targetId) || false;
}

export function normalizeText(value, { field = "text", max = 2000 } = {}) {
  if (typeof value !== "string") return { error: `invalid_${field}` };

  const normalized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!normalized) return { error: `empty_${field}` };
  if ([...normalized].length > max) return { error: `${field}_too_long`, max };

  return { value: normalized };
}
