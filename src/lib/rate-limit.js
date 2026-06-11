const buckets = new Map();

export function getRateLimitKey(request, session, scope) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const actor = session?.login || forwardedFor || "anonymous";
  return `${scope}:${actor}`;
}

export function checkRateLimit(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { ok: true };
}
