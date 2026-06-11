import Link from "next/link";
import { aspData } from "@/lib/data";
import { getMemberName, getProjectProgress, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Projects | ASP Study Hub",
};

export default function ProjectsPage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Projects</span>
          <h1>스터디와 프로젝트 운영 현황</h1>
          <p>계획, 마일스톤, 성공 기준, 산출물을 프로젝트 단위로 관리합니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="card-grid">
        {aspData.projects.map((project) => (
          <article key={project.id} className="panel">
            <span className="eyebrow">{getStatusLabel(project.status)}</span>
            <h2>{project.title}</h2>
            <p>{project.summary}</p>
            <div className="progress-track" aria-label={`${project.title} progress`}>
              <span style={{ width: `${getProjectProgress(project)}%` }} />
            </div>
            <div className="meta-row">
              <span>Owner: {getMemberName(project.ownerId)}</span>
              <span>{project.period.start} - {project.period.end}</span>
            </div>
            <Link className="icon-link" href={`/projects/${project.id}`}>
              상세 보기
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
