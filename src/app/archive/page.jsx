import Link from "next/link";
import { aspData } from "@/lib/data";
import { getProject, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Archive | ASP Study Hub",
};

export default function ArchivePage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Archive</span>
          <h1>결과 정리와 장기 보존</h1>
          <p>완료 프로젝트의 발표 자료, 데모, 회고, 후속 아이디어를 정리합니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="card-grid">
        {aspData.archive.map((archive) => {
          const project = getProject(archive.projectId);
          return (
            <article key={archive.id} className="panel">
              <span className="eyebrow">{getStatusLabel(archive.status)}</span>
              <h2>{project?.title}</h2>
              <p>필수 항목: {archive.required.join(", ")}</p>
              <p>남은 항목: {archive.missing.join(", ")}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
