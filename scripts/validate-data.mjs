import { aspData } from "../src/lib/data.js";

const validProjectStatuses = new Set(["planning", "active", "paused", "completed", "archived"]);
const validMilestoneStatuses = new Set(["planned", "in-progress", "done"]);
const validTaskStatuses = new Set(["todo", "in-progress", "review", "blocked", "done"]);
const validLogTypes = new Set(["experiment", "decision", "issue", "retrospective", "resource", "presentation"]);
const validReviewStatuses = new Set(["draft", "ready-for-review", "changes-requested", "published", "hidden", "archived"]);
const validCommentScopes = new Set(["project", "session", "task", "log", "archive"]);
const validCommentVisibility = new Set(["public", "team-only", "admin-only"]);
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const errors = [];

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function checkId(id, type) {
  assert(idPattern.test(id), `${type} id must be kebab-case: ${id}`);
}

function checkDate(date, label) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(date), `${label} must use YYYY-MM-DD: ${date}`);
}

const memberIds = new Set(aspData.members.map((member) => member.id));
const projectIds = new Set(aspData.projects.map((project) => project.id));
const milestoneIds = new Set(aspData.projects.flatMap((project) => project.milestones.map((milestone) => milestone.id)));
const sessionIds = new Set(aspData.sessions.map((session) => session.id));
const taskIds = new Set(aspData.tasks.map((task) => task.id));
const logIds = new Set(aspData.logs.map((log) => log.id));
const archiveIds = new Set(aspData.archive.map((archive) => archive.id));

for (const member of aspData.members) {
  checkId(member.id, "member");
  assert(member.github, `member ${member.id} needs github`);
}

for (const project of aspData.projects) {
  checkId(project.id, "project");
  assert(validProjectStatuses.has(project.status), `project ${project.id} has invalid status ${project.status}`);
  checkDate(project.period.start, `project ${project.id} period.start`);
  checkDate(project.period.end, `project ${project.id} period.end`);
  assert(memberIds.has(project.ownerId), `project ${project.id} ownerId missing in members: ${project.ownerId}`);
  assert(project.repositoryUrl.startsWith("https://"), `project ${project.id} repositoryUrl must be https`);

  for (const milestone of project.milestones) {
    checkId(milestone.id, "milestone");
    assert(validMilestoneStatuses.has(milestone.status), `milestone ${milestone.id} has invalid status ${milestone.status}`);
  }
}

for (const session of aspData.sessions) {
  checkId(session.id, "session");
  checkDate(session.date, `session ${session.id} date`);
  assert(projectIds.has(session.projectId), `session ${session.id} projectId missing: ${session.projectId}`);
  assert(memberIds.has(session.ownerId), `session ${session.id} ownerId missing: ${session.ownerId}`);
}

for (const task of aspData.tasks) {
  checkId(task.id, "task");
  checkDate(task.due, `task ${task.id} due`);
  assert(projectIds.has(task.projectId), `task ${task.id} projectId missing: ${task.projectId}`);
  assert(milestoneIds.has(task.milestoneId), `task ${task.id} milestoneId missing: ${task.milestoneId}`);
  assert(memberIds.has(task.ownerId), `task ${task.id} ownerId missing: ${task.ownerId}`);
  assert(validTaskStatuses.has(task.status), `task ${task.id} has invalid status ${task.status}`);
}

for (const log of aspData.logs) {
  checkId(log.id, "log");
  checkDate(log.date, `log ${log.id} date`);
  assert(projectIds.has(log.projectId), `log ${log.id} projectId missing: ${log.projectId}`);
  assert(memberIds.has(log.authorId), `log ${log.id} authorId missing: ${log.authorId}`);
  assert(milestoneIds.has(log.relatedMilestoneId), `log ${log.id} relatedMilestoneId missing: ${log.relatedMilestoneId}`);
  assert(validLogTypes.has(log.type), `log ${log.id} has invalid type ${log.type}`);
}

for (const archive of aspData.archive) {
  checkId(archive.id, "archive");
  assert(projectIds.has(archive.projectId), `archive ${archive.id} projectId missing: ${archive.projectId}`);
  assert(validReviewStatuses.has(archive.status), `archive ${archive.id} has invalid status ${archive.status}`);
  assert(Array.isArray(archive.required) && archive.required.length > 0, `archive ${archive.id} needs required checklist`);
}

for (const review of aspData.reviewQueue) {
  checkId(review.id, "review");
  assert(memberIds.has(review.ownerId), `review ${review.id} ownerId missing: ${review.ownerId}`);
  assert(validReviewStatuses.has(review.status), `review ${review.id} has invalid status ${review.status}`);
  assert(review.target, `review ${review.id} needs target`);
}

const targetSets = {
  project: projectIds,
  session: sessionIds,
  task: taskIds,
  log: logIds,
  archive: archiveIds,
};

for (const comment of aspData.comments || []) {
  checkId(comment.id, "comment");
  checkDate(comment.createdAt, `comment ${comment.id} createdAt`);
  assert(validCommentScopes.has(comment.scope), `comment ${comment.id} has invalid scope ${comment.scope}`);
  assert(validCommentVisibility.has(comment.visibility), `comment ${comment.id} has invalid visibility ${comment.visibility}`);
  assert(memberIds.has(comment.authorId), `comment ${comment.id} authorId missing: ${comment.authorId}`);
  assert(targetSets[comment.scope]?.has(comment.targetId), `comment ${comment.id} targetId missing: ${comment.targetId}`);
}

for (const event of aspData.auditEvents || []) {
  checkId(event.id, "audit event");
  checkDate(event.createdAt, `audit event ${event.id} createdAt`);
  assert(memberIds.has(event.actorId), `audit event ${event.id} actorId missing: ${event.actorId}`);
  assert(event.action, `audit event ${event.id} needs action`);
  assert(event.targetId, `audit event ${event.id} needs targetId`);
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Data validation passed.");
