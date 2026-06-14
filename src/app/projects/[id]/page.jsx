import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatDate,
  getMemberName,
  getProjectArchive,
  getProjectLogs,
  getProjectSessions,
  getProjectTasks,
  getStatusLabel,
} from "@/lib/lookups";
import { getProjectById } from "@/lib/projects";

export function generateStaticParams() {
  return [{ id: "mafia-simulation" }];
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = await getProjectById(id);
  return {
    title: project ? `${project.title} | ASP Study Hub` : "Project | ASP Study Hub",
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) notFound();

  const sessions = getProjectSessions(project.id);
  const tasks = getProjectTasks(project.id);
  const logs = getProjectLogs(project.id);
  const archive = getProjectArchive(project.id) || { required: ["Project brief", "Final report", "Presentation", "Demo link"], missing: [] };
  const doneCount = tasks.filter((task) => task.status === "done").length;
  const milestones = project.milestones || [];
  const goals = project.goals || [];
  const periodLabel = project.period?.start && project.period?.end
    ? `${formatDate(project.period.start)} - ${formatDate(project.period.end)}`
    : "기간 미정";

  return (
    <main className="project-detail-shell">
      <header className="project-detail-hero">
        <div>
          <span className="project-status">{getStatusLabel(project.status)}</span>
          <h1>{project.title}</h1>
          <p>{project.summary}</p>
        </div>
        <div className="project-detail-actions">
          <Link className="primary" href={`/workspace?project=${project.id}`}>
            Workspace
          </Link>
          <a href={project.repositoryUrl} target="_blank" rel="noreferrer">
            Repository
          </a>
          <Link href="/projects">Projects</Link>
        </div>
      </header>

      <section className="project-stat-strip">
        <article>
          <span>기간</span>
          <strong>{periodLabel}</strong>
        </article>
        <article>
          <span>백로그</span>
          <strong>{tasks.length} items</strong>
        </article>
        <article>
          <span>완료</span>
          <strong>{doneCount} items</strong>
        </article>
        <article>
          <span>아카이브</span>
          <strong>{archive?.missing.length || 0} remaining</strong>
        </article>
      </section>

      <section className="project-detail-grid">
        <article className="project-detail-panel">
          <span className="eyebrow">Goals</span>
          <div className="chip-list">
            {goals.map((goal) => (
              <span key={goal}>{goal}</span>
            ))}
            {goals.length === 0 && <span>Workspace에서 목표와 백로그를 쌓아가세요.</span>}
          </div>
        </article>
        <article className="project-detail-panel">
          <span className="eyebrow">Upcoming</span>
          <div className="project-mini-list">
            {sessions.slice(0, 2).map((session) => (
              <div key={session.id}>
                <strong>{session.title}</strong>
                <span>{formatDate(session.date)} · {getMemberName(session.ownerId)}</span>
              </div>
            ))}
            {sessions.length === 0 && <div><strong>아직 예정 세션이 없습니다.</strong><span>Workspace에서 기록을 먼저 작성하세요.</span></div>}
          </div>
        </article>
      </section>

      <section className="project-detail-panel">
        <div className="project-section-title">
          <div>
            <span className="eyebrow">Roadmap</span>
            <h2>마일스톤</h2>
          </div>
          <Link href={`/workspace?project=${project.id}`}>작업 관리로 이동</Link>
        </div>
        <div className="project-milestone-strip">
          {milestones.map((milestone) => (
            <article key={milestone.id}>
              <span>Week {milestone.week}</span>
              <strong>{milestone.title}</strong>
            </article>
          ))}
          {milestones.length === 0 && (
            <article>
              <span>Planning</span>
              <strong>Workspace 보드에서 마일스톤을 백로그로 구체화하세요.</strong>
            </article>
          )}
        </div>
      </section>

      <section className="project-detail-grid">
        <article className="project-detail-panel">
          <span className="eyebrow">Latest logs</span>
          <div className="project-mini-list">
            {logs.slice(0, 3).map((log) => (
              <div key={log.id}>
                <strong>{log.title}</strong>
                <span>{log.type} · {formatDate(log.date)}</span>
              </div>
            ))}
            {logs.length === 0 && <div><strong>아직 기록이 없습니다.</strong><span>Editor에서 회의록과 실험 로그를 작성하세요.</span></div>}
          </div>
        </article>
        <article className="project-detail-panel">
          <span className="eyebrow">Archive checklist</span>
          <div className="chip-list compact">
            {archive?.required.map((item) => (
              <span key={item} className={archive.missing.includes(item) ? "missing" : "ready"}>
                {item}
              </span>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
