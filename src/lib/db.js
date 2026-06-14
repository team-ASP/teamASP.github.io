import postgres from "postgres";
import { randomUUID } from "node:crypto";

let sqlClient;
let schemaReady;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || "";
}

export function isDatabaseConfigured() {
  return Boolean(getDatabaseUrl());
}

export function getSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required.");
  }

  if (!sqlClient) {
    sqlClient = postgres(databaseUrl, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }

  return sqlClient;
}

export async function ensureSchema() {
  if (!isDatabaseConfigured()) return false;
  if (schemaReady) return true;

  const sql = getSql();
  await sql`
    create table if not exists projects (
      id text primary key,
      title text not null,
      type text not null default 'project',
      status text not null default 'planning',
      summary text not null default '',
      repository_url text not null default '',
      owner_login text not null,
      author_login text not null,
      author_name text not null,
      period_start date,
      period_end date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;
  await sql`create index if not exists projects_status_idx on projects (status, updated_at desc)`;

  await sql`
    create table if not exists comments (
      id text primary key,
      scope text not null,
      target_id text not null,
      visibility text not null default 'team-only',
      body text not null,
      author_login text not null,
      author_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      hidden_at timestamptz
    )
  `;
  await sql`create index if not exists comments_target_idx on comments (scope, target_id, created_at desc)`;

  await sql`
    create table if not exists drafts (
      id text primary key,
      type text not null,
      target_id text not null,
      title text not null,
      body text not null,
      status text not null default 'draft',
      author_login text not null,
      author_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;
  await sql`alter table drafts add column if not exists deleted_at timestamptz`;
  await sql`create index if not exists drafts_author_idx on drafts (author_login, updated_at desc)`;

  await sql`
    create table if not exists review_items (
      id text primary key,
      source_type text not null,
      source_id text not null,
      title text not null,
      target text not null,
      status text not null default 'ready-for-review',
      owner_login text not null,
      reviewer_login text,
      review_note text,
      created_at timestamptz not null default now(),
      reviewed_at timestamptz,
      deleted_at timestamptz
    )
  `;
  await sql`alter table review_items add column if not exists deleted_at timestamptz`;
  await sql`create index if not exists review_items_status_idx on review_items (status, created_at desc)`;

  await sql`
    create table if not exists task_updates (
      id text primary key,
      task_id text not null,
      status text not null,
      note text not null default '',
      author_login text not null,
      author_name text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists task_updates_task_idx on task_updates (task_id, created_at desc)`;

  await sql`
    create table if not exists backlog_items (
      id text primary key,
      project_id text not null,
      title text not null,
      description text not null default '',
      type text not null default 'task',
      status text not null default 'todo',
      priority text not null default 'medium',
      owner_login text not null,
      author_login text not null,
      author_name text not null,
      due_date date,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;
  await sql`alter table backlog_items add column if not exists deleted_at timestamptz`;
  await sql`create index if not exists backlog_items_project_idx on backlog_items (project_id, status, updated_at desc)`;

  await sql`
    create table if not exists archive_items (
      id text primary key,
      project_id text not null,
      title text not null,
      kind text not null default 'artifact',
      status text not null default 'needed',
      url text not null default '',
      notes text not null default '',
      author_login text not null,
      author_name text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      deleted_at timestamptz
    )
  `;
  await sql`create index if not exists archive_items_project_idx on archive_items (project_id, status, updated_at desc)`;

  await sql`
    create table if not exists audit_events (
      id text primary key,
      actor_login text not null,
      action text not null,
      target_type text not null,
      target_id text not null,
      summary text not null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists audit_events_created_idx on audit_events (created_at desc)`;

  schemaReady = true;
  return true;
}

export async function writeAuditEvent({ actorLogin, action, targetType, targetId, summary }) {
  if (!isDatabaseConfigured()) return null;
  await ensureSchema();
  const sql = getSql();
  const id = randomUUID();
  const [event] = await sql`
    insert into audit_events (id, actor_login, action, target_type, target_id, summary)
    values (${id}, ${actorLogin}, ${action}, ${targetType}, ${targetId}, ${summary})
    returning id, actor_login, action, target_type, target_id, summary, created_at
  `;
  return event;
}

export function toPublicComment(row) {
  return {
    id: row.id,
    scope: row.scope,
    targetId: row.target_id,
    visibility: row.visibility,
    body: row.body,
    authorLogin: row.author_login,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicProject(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    summary: row.summary,
    repositoryUrl: row.repository_url,
    ownerLogin: row.owner_login,
    authorLogin: row.author_login,
    authorName: row.author_name,
    period: {
      start: row.period_start,
      end: row.period_end,
    },
    source: "database",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicDraft(row) {
  return {
    id: row.id,
    type: row.type,
    targetId: row.target_id,
    title: row.title,
    body: row.body,
    status: row.status,
    authorLogin: row.author_login,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicReview(row) {
  return {
    id: row.id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    title: row.title,
    target: row.target,
    status: row.status,
    ownerLogin: row.owner_login,
    reviewerLogin: row.reviewer_login,
    reviewNote: row.review_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

export function toPublicTaskUpdate(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    note: row.note,
    authorLogin: row.author_login,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export function toPublicBacklogItem(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    priority: row.priority,
    ownerLogin: row.owner_login,
    authorLogin: row.author_login,
    authorName: row.author_name,
    due: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicArchiveItem(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    url: row.url,
    notes: row.notes,
    authorLogin: row.author_login,
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPublicAuditEvent(row) {
  return {
    id: row.id,
    actorLogin: row.actor_login,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}
