import Link from "next/link";
import { aspData } from "@/lib/data";

export const metadata = {
  title: "Governance | ASP Study Hub",
};

export default function GovernancePage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Governance</span>
          <h1>권한, 보안, 배포 정책</h1>
          <p>{aspData.policies.deployment}</p>
        </div>
        <div className="route-actions">
          <a className="icon-link primary-link" href="/api/auth/start">
            GitHub 로그인
          </a>
          <Link className="icon-link" href="/">
            Dashboard
          </Link>
        </div>
      </header>

      <section className="card-grid">
        {aspData.policies.roles.map((item) => (
          <article key={item.role} className="panel">
            <span className="eyebrow">Role</span>
            <h2>{item.role}</h2>
            <p>{item.permission}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
