import Link from "next/link";
import { AuthStatus } from "@/components/auth-status";
import { DraftComposer } from "@/components/draft-composer";
import { ReviewQueueClient } from "@/components/review-queue-client";
import { aspData } from "@/lib/data";
import { formatDate, getMemberName, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Workspace | ASP Study Hub",
};

const columns = [
  { id: "todo", title: "Todo", statuses: ["todo", "planned"] },
  { id: "in-progress", title: "In progress", statuses: ["in-progress", "active"] },
  { id: "review", title: "Review", statuses: ["ready-for-review", "review"] },
  { id: "done", title: "Done", statuses: ["done", "published"] },
];

export default function WorkspacePage() {
  const project = aspData.projects[0];
  const nextSessions = aspData.sessions.slice(0, 4);
  const decisions = aspData.logs.filter((log) => log.type === "decision");
  const archive = aspData.archive.find((item) => item.projectId === project.id);

  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Team workspace</span>
          <h1>계획, 진행, 검수, 아카이브</h1>
          <p>
            Jira식 작업 흐름과 Confluence식 지식 정리를 한 화면에 묶어, Multi-Agent Mafia Simulation의 12주 진행을 팀
            운영 데이터로 남깁니다.
          </p>
        </div>
        <div className="route-actions">
          <Link className="icon-link" href={`/projects/${project.id}`}>
            Project
          </Link>
          <Link className="icon-link" href="/review">
            Review
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <AuthStatus />
        <article className="panel">
          <span className="eyebrow">Current focus</span>
          <h2>{project.title}</h2>
          <p>{project.summary}</p>
          <div className="meta-row">
            <span>{formatDate(project.period.start)} 시작</span>
            <span>{formatDate(project.period.end)} 종료 목표</span>
            <span>{getStatusLabel(project.status)}</span>
          </div>
        </article>
      </section>

      <section className="board-grid" aria-label="Project task board">
        {columns.map((column) => {
          const tasks = aspData.tasks.filter((task) => column.statuses.includes(task.status));
          return (
            <article key={column.id} className="board-column">
              <h2>{column.title}</h2>
              {tasks.map((task) => (
                <div key={task.id} className="board-card">
                  <span className="eyebrow">{task.milestoneId}</span>
                  <strong>{task.title}</strong>
                  <p className="muted">
                    {getMemberName(task.ownerId)} · {formatDate(task.due)}
                  </p>
                </div>
              ))}
              {tasks.length === 0 && <p className="muted">아직 항목이 없습니다.</p>}
            </article>
          );
        })}
      </section>

      <section className="knowledge-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Study calendar</span>
              <h2>다가오는 세션</h2>
            </div>
            <span className="status-pill">{nextSessions.length} items</span>
          </div>
          <div className="compact-list">
            {nextSessions.map((session) => (
              <article key={session.id}>
                <strong>{session.title}</strong>
                <span>
                  {formatDate(session.date)} · {getMemberName(session.ownerId)}
                </span>
                <p>{session.agenda.join(" · ")}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <span className="eyebrow">Archive readiness</span>
          <h2>결과 정리 체크리스트</h2>
          <p>필수 항목: {archive?.required.join(", ")}</p>
          <p>남은 항목: {archive?.missing.join(", ")}</p>
        </article>
      </section>

      <section className="knowledge-grid">
        <article className="panel">
          <span className="eyebrow">Decision log</span>
          <h2>프로젝트 의사결정</h2>
          <div className="compact-list">
            {decisions.map((log) => (
              <article key={log.id}>
                <strong>{log.title}</strong>
                <span>{formatDate(log.date)} · {getMemberName(log.authorId)}</span>
                <p>{log.summary}</p>
              </article>
            ))}
          </div>
        </article>
        <DraftComposer targetId={project.id} />
      </section>

      <ReviewQueueClient initialItems={aspData.reviewQueue} />
    </main>
  );
}
