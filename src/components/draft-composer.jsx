"use client";

import { useEffect, useState } from "react";

export function DraftComposer({ targetId }) {
  const [session, setSession] = useState(null);
  const [type, setType] = useState("experiment-log");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [drafts, setDrafts] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      const [meResponse, draftsResponse] = await Promise.all([fetch("/api/me"), fetch("/api/drafts")]);
      const [me, draftsPayload] = await Promise.all([meResponse.json(), draftsResponse.json()]);
      if (!alive) return;
      setSession(me);
      setDrafts(draftsPayload.items || []);
      if (me.authenticated && !draftsPayload.configured) setMessage("DB 연결 후 draft 저장이 활성화됩니다.");
    }
    load().catch(() => setMessage("Draft 상태를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, []);

  async function createDraft(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, targetId, title, body }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Draft 저장에 실패했습니다.");
      return;
    }
    setDrafts((items) => [payload.item, ...items]);
    setTitle("");
    setBody("");
    setMessage("Draft가 저장되었습니다.");
  }

  async function submitForReview(id) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit-draft", draftId: id }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "검수 제출에 실패했습니다.");
      return;
    }
    setMessage(`검수 큐에 제출했습니다: ${payload.item.title}`);
  }

  const canDraft = session?.editableScopes?.some((scope) => ["logs", "sessions", "tasks"].includes(scope));

  return (
    <section className="panel">
      <span className="eyebrow">Editor</span>
      <h2>진행 기록 Draft</h2>
      {canDraft ? (
        <form className="editor-form" onSubmit={createDraft}>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="experiment-log">experiment-log</option>
            <option value="session-note">session-note</option>
            <option value="task-update">task-update</option>
            <option value="archive-note">archive-note</option>
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Draft 제목" required />
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="내용을 작성하세요." required />
          <button className="action-button" type="submit">
            Draft 저장
          </button>
        </form>
      ) : (
        <p className="muted">Draft 작성은 GitHub 로그인한 team-ASP 멤버에게 열립니다.</p>
      )}

      <div className="compact-list">
        {drafts.map((draft) => (
          <article key={draft.id}>
            <strong>{draft.title}</strong>
            <span>{draft.type} · {draft.status}</span>
            <button className="mini-action" type="button" onClick={() => submitForReview(draft.id)}>
              검수 제출
            </button>
          </article>
        ))}
      </div>
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
