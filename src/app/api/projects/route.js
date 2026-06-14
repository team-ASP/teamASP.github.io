import { jsonError, jsonResponse, normalizeText, readJson, requireFields } from "@/lib/api";
import { can, getSessionFromRequest, verifyCsrf } from "@/lib/auth";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicProject, writeAuditEvent } from "@/lib/db";
import { isStaticProjectId, listProjects } from "@/lib/projects";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";

const validStatuses = new Set(["planning", "active", "paused", "completed", "archived"]);
const validTypes = new Set(["project", "study", "research", "product"]);

export const dynamic = "force-dynamic";

export async function GET() {
  return jsonResponse(await listProjects());
}

export async function POST(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);

  const limit = checkRateLimit(getRateLimitKey(request, session, "projects"), { limit: 12, windowMs: 60_000 });
  if (!limit.ok) return jsonError("rate_limited", 429, { retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const repoMeta = payload.repositoryUrl ? await fetchGitHubRepoMeta(payload.repositoryUrl).catch(() => ({})) : {};
  const normalized = normalizeProjectPayload({ ...repoMeta, ...payload }, { requireTitle: !repoMeta.title });
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select id from projects where id = ${normalized.id} and deleted_at is null`;
  if (existing) return jsonError("project_id_conflict", 409);

  const [project] = await sql`
    insert into projects (id, title, type, status, summary, repository_url, owner_login, author_login, author_name, period_start, period_end)
    values (
      ${normalized.id},
      ${normalized.title},
      ${normalized.type},
      ${normalized.status},
      ${normalized.summary},
      ${normalized.repositoryUrl},
      ${session.login},
      ${session.login},
      ${session.name || session.login},
      ${normalized.periodStart},
      ${normalized.periodEnd}
    )
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "create-project",
    targetType: "project",
    targetId: project.id,
    summary: project.title,
  });

  return jsonResponse({ item: toPublicProject(project) }, { status: 201 });
}

export async function PATCH(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (isStaticProjectId(payload.id)) return jsonError("static_project_read_only", 409);

  await ensureSchema();
  const sql = getSql();
  const [existing] = await sql`select * from projects where id = ${payload.id} and deleted_at is null`;
  if (!existing) return jsonError("not_found", 404);

  const normalized = normalizeProjectPayload(
    {
      id: existing.id,
      title: payload.title ?? existing.title,
      type: payload.type ?? existing.type,
      status: payload.status ?? existing.status,
      summary: payload.summary ?? existing.summary,
      repositoryUrl: payload.repositoryUrl ?? existing.repository_url,
      periodStart: payload.periodStart ?? existing.period_start,
      periodEnd: payload.periodEnd ?? existing.period_end,
    },
    { requireTitle: true, keepId: true },
  );
  if (normalized.error) return jsonError(normalized.error, 400, normalized.extra || {});

  const [project] = await sql`
    update projects
    set title = ${normalized.title},
        type = ${normalized.type},
        status = ${normalized.status},
        summary = ${normalized.summary},
        repository_url = ${normalized.repositoryUrl},
        period_start = ${normalized.periodStart},
        period_end = ${normalized.periodEnd},
        updated_at = now()
    where id = ${payload.id}
    returning *
  `;

  await writeAuditEvent({
    actorLogin: session.login,
    action: "update-project",
    targetType: "project",
    targetId: project.id,
    summary: project.title,
  });

  return jsonResponse({ item: toPublicProject(project) });
}

export async function DELETE(request) {
  const session = getSessionFromRequest(request);
  if (!can(session.role, "admin")) return jsonError("forbidden", 403);
  if (!verifyCsrf(request)) return jsonError("csrf_failed", 403);
  if (!isDatabaseConfigured()) return jsonError("database_not_configured", 503);

  const payload = await readJson(request);
  const missing = requireFields(payload, ["id"]);
  if (missing.length) return jsonError("missing_fields", 400, { missing });
  if (isStaticProjectId(payload.id)) return jsonError("static_project_read_only", 409);

  await ensureSchema();
  const sql = getSql();
  const [project] = await sql`
    update projects set deleted_at = now(), updated_at = now()
    where id = ${payload.id} and deleted_at is null
    returning *
  `;
  if (!project) return jsonError("not_found", 404);

  await writeAuditEvent({
    actorLogin: session.login,
    action: "delete-project",
    targetType: "project",
    targetId: project.id,
    summary: project.title,
  });

  return jsonResponse({ item: toPublicProject(project) });
}

function normalizeProjectPayload(payload, { requireTitle = true, keepId = false } = {}) {
  const rawTitle = payload.title || "";
  const title = normalizeText(rawTitle, { field: "title", max: 120 });
  if (title.error && requireTitle) return { error: title.error, extra: title.max ? { max: title.max } : {} };

  const summary = normalizeText(payload.summary || "No summary yet.", { field: "summary", max: 1000 });
  if (summary.error) return { error: summary.error, extra: summary.max ? { max: summary.max } : {} };

  const type = payload.type || "project";
  const status = payload.status || "planning";
  if (!validTypes.has(type)) return { error: "invalid_type" };
  if (!validStatuses.has(status)) return { error: "invalid_status" };

  const id = keepId ? payload.id : slugify(payload.id || title.value || payload.repositoryName || "project");
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) return { error: "invalid_id" };
  if (!keepId && isStaticProjectId(id)) return { error: "project_id_conflict" };

  const periodStart = normalizeDate(payload.periodStart || payload.period?.start);
  const periodEnd = normalizeDate(payload.periodEnd || payload.period?.end);

  return {
    id,
    title: title.value,
    type,
    status,
    summary: summary.value,
    repositoryUrl: payload.repositoryUrl || "",
    periodStart,
    periodEnd,
  };
}

function normalizeDate(value) {
  if (!value) return null;
  const normalized = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/https?:\/\/github\.com\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function fetchGitHubRepoMeta(repositoryUrl) {
  const match = String(repositoryUrl).match(/github\.com\/([^/\s]+)\/([^/\s#?]+)/);
  if (!match) return {};
  const [, owner, repoWithSuffix] = match;
  const repo = repoWithSuffix.replace(/\.git$/, "");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "asp-study-hub",
    },
  });
  if (!response.ok) return {};
  const data = await response.json();
  return {
    id: slugify(data.name || repo),
    title: data.name || repo,
    summary: data.description || "No summary yet.",
    repositoryUrl: data.html_url || repositoryUrl,
    repositoryName: data.name,
  };
}
