import Link from "next/link";
import { AuditLogClient } from "@/components/audit-log-client";

export const metadata = {
  title: "Audit Log | ASP Study Hub",
};

export default function AuditPage() {
  return (
    <main className="route-shell">
      <header className="route-header">
        <div>
          <span className="eyebrow">Admin</span>
          <h1>감사 로그</h1>
          <p>댓글, draft, review, publish 등 주요 변경 이력을 확인합니다.</p>
        </div>
        <Link className="icon-link" href="/governance">
          Governance
        </Link>
      </header>

      <AuditLogClient />
    </main>
  );
}
