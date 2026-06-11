import Link from "next/link";
import { aspData } from "@/lib/data";
import { formatDate, getMemberName, getStatusLabel } from "@/lib/lookups";

export const metadata = {
  title: "Sessions | ASP Study Hub",
};

export default function SessionsPage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Sessions</span>
          <h1>주차별 세션과 회의 기록</h1>
          <p>스터디 agenda, 결정 사항, 액션 아이템을 세션 단위로 누적합니다.</p>
        </div>
        <Link className="icon-link" href="/">
          Dashboard
        </Link>
      </header>

      <section className="card-grid">
        {aspData.sessions.map((session) => (
          <article key={session.id} className="panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">{formatDate(session.date)}</span>
                <h2>{session.title}</h2>
              </div>
              <span className="status-pill">{getStatusLabel(session.status)}</span>
            </div>
            <p>Owner: {getMemberName(session.ownerId)}</p>
            <ul className="clean-list">
              {session.agenda.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </main>
  );
}
