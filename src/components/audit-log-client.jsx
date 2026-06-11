"use client";

import { useEffect, useState } from "react";

export function AuditLogClient() {
  const [payload, setPayload] = useState({ items: [] });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/audit-events", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json().then((data) => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          setMessage(data.error || "감사 로그 접근 권한이 없습니다.");
          return;
        }
        setPayload(data);
      })
      .catch(() => setMessage("감사 로그를 불러오지 못했습니다."));
  }, []);

  return (
    <section className="panel">
      <span className="eyebrow">Audit log</span>
      <h2>운영 변경 이력</h2>
      <div className="compact-list">
        {payload.items.map((event) => (
          <article key={event.id}>
            <strong>{event.action}</strong>
            <span>{event.actorLogin} · {event.targetType}/{event.targetId}</span>
            <p>{event.summary}</p>
          </article>
        ))}
      </div>
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
