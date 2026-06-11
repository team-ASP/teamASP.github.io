import Link from "next/link";
import { aspData } from "@/lib/data";
import { getMemberName, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Review Queue | ASP Study Hub",
};

export default function ReviewQueuePage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Review Queue</span>
          <h1>검수 대기 변경 사항</h1>
          <p>Project Maintainer와 Admin이 공식 publish 전 변경 사항을 검수하는 작업 큐입니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="card-grid">
        {aspData.reviewQueue.map((item) => (
          <article key={item.id} className="panel">
            <span className="eyebrow">{item.type}</span>
            <h2>{item.title}</h2>
            <p>Owner: {getMemberName(item.ownerId)}</p>
            <div className="meta-row">
              <span>{getStatusLabel(item.status)}</span>
              <span>{item.target}</span>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
