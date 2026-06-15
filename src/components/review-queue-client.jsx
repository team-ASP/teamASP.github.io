"use client";

import { useEffect, useState } from "react";

export function ReviewQueueClient({ initialItems }) {
  const [payload, setPayload] = useState({ items: initialItems, permissions: { canReview: false } });
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const requestOptions = { cache: "no-store", credentials: "same-origin" };
    Promise.all([fetch("/api/review-queue", requestOptions), fetch("/api/me", requestOptions)])
      .then(async ([queueResponse, meResponse]) => {
        const [queue, me] = await Promise.all([queueResponse.json(), meResponse.json()]);
        return { queue, me };
      })
      .then(({ queue, me }) => {
        setPayload(queue);
        setSession(me);
      })
      .catch(() => setMessage("검수 큐를 불러오지 못했습니다."));
  }, []);

  async function mutate(action, reviewId) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
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

  async function remove(reviewId) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify({ reviewId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "검수 항목 제거에 실패했습니다.");
      return;
    }
    setPayload((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== reviewId),
    }));
    setMessage("검수 큐에서 제거했습니다.");
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
              <button className="action-button secondary" type="button" onClick={() => remove(item.id)}>
                제거
              </button>
            </div>
          )}
          {payload.permissions?.canAdmin && item.sourceType === "static" && (
            <div className="hero-actions">
              <button className="action-button secondary" type="button" onClick={() => remove(item.id)}>
                Seed 항목 제거
              </button>
            </div>
          )}
        </article>
      ))}
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
