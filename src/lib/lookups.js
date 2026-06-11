import { aspData } from "@/lib/data";

export const statusLabels = {
  planning: "Planning",
  planned: "Planned",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
  archived: "Archived",
  "in-progress": "In progress",
  todo: "Todo",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  draft: "Draft",
  hidden: "Hidden",
  "ready-for-review": "Ready for review",
  watching: "Watching",
  open: "Open",
};

export function getStatusLabel(status) {
  return statusLabels[status] || status;
}

export function formatDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(date));
}

export function getMember(id) {
  return aspData.members.find((member) => member.id === id);
}

export function getMemberName(id) {
  return getMember(id)?.name || id;
}

export function getProject(id) {
  return aspData.projects.find((project) => project.id === id);
}

export function getProjectSessions(projectId) {
  return aspData.sessions.filter((session) => session.projectId === projectId);
}

export function getProjectTasks(projectId) {
  return aspData.tasks.filter((task) => task.projectId === projectId);
}

export function getProjectLogs(projectId) {
  return aspData.logs.filter((log) => log.projectId === projectId);
}

export function getProjectArchive(projectId) {
  return aspData.archive.find((archive) => archive.projectId === projectId);
}

export function getProjectProgress(project) {
  if (!project.milestones.length) return 0;
  const done = project.milestones.filter((milestone) => milestone.status === "done").length;
  const active = project.milestones.filter((milestone) => milestone.status === "in-progress").length * 0.5;
  return Math.round(((done + active) / project.milestones.length) * 100);
}
