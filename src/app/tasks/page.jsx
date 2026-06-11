import Link from "next/link";
import { aspData } from "@/lib/data";
import { formatDate, getMemberName, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Tasks | ASP Study Hub",
};

export default function TasksPage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Tasks</span>
          <h1>프로젝트 실행 Backlog</h1>
          <p>마일스톤별 태스크, 담당자, 마감일, 상태를 추적합니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="task-table">
        {aspData.tasks.map((task) => (
          <article key={task.id} className="task-row">
            <div>
              <span className="eyebrow">{task.milestoneId}</span>
              <h3>{task.title}</h3>
              <p>Owner: {getMemberName(task.ownerId)} · Due {formatDate(task.due)}</p>
            </div>
            <span className={`status-pill ${task.status}`}>{getStatusLabel(task.status)}</span>
          </article>
        ))}
      </section>
    </main>
  );
}
