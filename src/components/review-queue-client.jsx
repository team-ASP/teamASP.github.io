"use client";

import { useEffect, useState } from "react";

export function ReviewQueueClient({ initialItems }) {
  const [payload, setPayload] = useState({ items: initialItems, permissions: { canReview: false } });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/review-queue")
      .then((response) => response.json())
      .then((data) => setPayload(data))
      .catch(() => setMessage("검수 큐를 불러오지 못했습니다."));
  }, []);

  async function mutate(action, reviewId) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "검수 작업에 실패했습니다.");
      return;
    }
    setPayload((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === data.item.id ? data.item : item)),
    }));
    setMessage(`${data.item.title} 상태가 변경되었습니다.`);
  }

  return (
    <section className="card-grid">
      {payload.items.map((item) => (
        <article key={item.id} className="panel">
          <span className="eyebrow">{item.type || item.sourceType}</span>
          <h2>{item.title}</h2>
          <p>Owner: {item.ownerLogin || item.ownerId}</p>
          <div className="meta-row">
            <span>{item.status}</span>
            <span>{item.target}</span>
          </div>
          {payload.permissions?.canReview && item.sourceType !== "static" && (
            <div className="hero-actions">
              <button className="action-button" type="button" onClick={() => mutate("approve", item.id)}>
                승인
              </button>
              <button className="action-button secondary" type="button" onClick={() => mutate("request-changes", item.id)}>
                수정 요청
              </button>
            </div>
          )}
        </article>
      ))}
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
