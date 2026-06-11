import Link from "next/link";
import { aspData } from "@/lib/data";
import { formatDate, getMemberName } from "@/lib/lookups";

export const metadata = {
  title: "Logs | ASP Study Hub",
};

export default function LogsPage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Logs</span>
          <h1>실험, 결정, 회고 기록</h1>
          <p>프로젝트 과정의 지식과 판단 근거를 검색 가능한 기록으로 남깁니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="card-grid">
        {aspData.logs.map((log) => (
          <article key={log.id} className="panel">
            <span className="eyebrow">{log.type} · {formatDate(log.date)}</span>
            <h2>{log.title}</h2>
            <p>{log.summary}</p>
            <div className="meta-row">
              <span>{getMemberName(log.authorId)}</span>
              <span>{log.relatedMilestoneId}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
