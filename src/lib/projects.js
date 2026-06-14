import { aspData } from "@/lib/data";
import { ensureSchema, getSql, isDatabaseConfigured, toPublicProject } from "@/lib/db";

export function staticProjectToPublic(project) {
  return {
    id: project.id,
    title: project.title,
    type: project.type,
    status: project.status,
    summary: project.summary,
    repositoryUrl: project.repositoryUrl,
    ownerId: project.ownerId,
    period: project.period,
    goals: project.goals || [],
    milestones: project.milestones || [],
    source: "static",
  };
}

export function isStaticProjectId(id) {
  return aspData.projects.some((project) => project.id === id);
}

export async function listProjects() {
  const staticProjects = aspData.projects.map(staticProjectToPublic);
  if (!isDatabaseConfigured()) return { configured: false, items: staticProjects };

  await ensureSchema();
  const sql = getSql();
  const rows = await sql`select * from projects where deleted_at is null order by updated_at desc limit 100`;
  return { configured: true, items: [...staticProjects, ...rows.map(toPublicProject)] };
}

export async function getProjectById(id) {
  const staticProject = aspData.projects.find((project) => project.id === id);
  if (staticProject) return staticProjectToPublic(staticProject);
  if (!isDatabaseConfigured()) return null;

  await ensureSchema();
  const sql = getSql();
  const [project] = await sql`select * from projects where id = ${id} and deleted_at is null`;
  return project ? { ...toPublicProject(project), goals: [], milestones: [], source: "database" } : null;
}

export async function projectExists(id) {
  return Boolean(await getProjectById(id));
}
