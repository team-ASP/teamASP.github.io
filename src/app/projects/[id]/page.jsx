import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentThread } from "@/components/comment-thread";
import { DraftComposer } from "@/components/draft-composer";
import {
  formatDate,
  getMemberName,
  getProject,
  getProjectArchive,
  getProjectLogs,
  getProjectSessions,
  getProjectTasks,
  getStatusLabel,
} from "@/lib/lookups";

export function generateStaticParams() {
  return [{ id: "mafia-simulation" }];
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = getProject(id);
  return {
    title: project ? `${project.title} | ASP Study Hub` : "Project | ASP Study Hub",
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  const sessions = getProjectSessions(project.id);
  const tasks = getProjectTasks(project.id);
  const logs = getProjectLogs(project.id);
  const archive = getProjectArchive(project.id);

  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">{getStatusLabel(project.status)}</span>
          <h1>{project.title}</h1>
          <p>{project.summary}</p>
        </div>
        <div className="route-actions">
          <a className="icon-link" href={project.repositoryUrl} target="_blank" rel="noreferrer">
            Repository
          </a>
          <Link className="icon-link" href="/projects">
            Projects
          </Link>
        </div>
      </header>

      <section className="two-column">
        <article className="panel">
          <span className="eyebrow">Goals</span>
          <ul className="clean-list">
            {project.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <span className="eyebrow">Success criteria</span>
          <ul className="clean-list">
            {project.successCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="timeline">
        {project.milestones.map((milestone) => (
          <article key={milestone.id} className="timeline-item">
            <div>
              <span className="eyebrow">Week {milestone.week}</span>
              <h3>{milestone.title}</h3>
              <p>{milestone.deliverables.join(" · ")}</p>
            </div>
            <span className="status-pill">{getStatusLabel(milestone.status)}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Sessions</span>
          <div className="compact-list">
            {sessions.map((session) => (
              <article key={session.id}>
                <strong>{session.title}</strong>
                <span>{formatDate(session.date)} · {getMemberName(session.ownerId)}</span>
              </article>
            ))}
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">Tasks</span>
          <div className="compact-list">
            {tasks.map((task) => (
              <article key={task.id}>
                <strong>{task.title}</strong>
                <span>{getStatusLabel(task.status)} · {formatDate(task.due)}</span>
              </article>
            ))}
          </div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Logs</span>
          <div className="compact-list">
            {logs.map((log) => (
              <article key={log.id}>
                <strong>{log.title}</strong>
                <span>{log.type} · {formatDate(log.date)}</span>
              </article>
            ))}
          </div>
        </article>
        <article className="panel">
          <span className="eyebrow">Archive checklist</span>
          <p>필수 항목: {archive?.required.join(", ")}</p>
          <p>남은 항목: {archive?.missing.join(", ")}</p>
        </article>
      </section>

      <section className="dashboard-grid">
        <CommentThread scope="project" targetId={project.id} />
        <DraftComposer targetId={project.id} />
      </section>
    </main>
  );
}
