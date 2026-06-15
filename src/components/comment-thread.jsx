"use client";

import { useEffect, useMemo, useState } from "react";

export function CommentThread({ scope, targetId }) {
  const [session, setSession] = useState(null);
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("team-only");
  const [message, setMessage] = useState("");

  const query = useMemo(() => new URLSearchParams({ scope, targetId }).toString(), [scope, targetId]);

  useEffect(() => {
    let alive = true;
    async function load() {
      const requestOptions = { cache: "no-store", credentials: "same-origin" };
      const [meResponse, commentsResponse] = await Promise.all([
        fetch("/api/me", requestOptions),
        fetch(`/api/comments?${query}`, requestOptions),
      ]);
      const [me, commentsPayload] = await Promise.all([meResponse.json(), commentsResponse.json()]);
      if (!alive) return;
      setSession(me);
      setComments(commentsPayload.items || []);
      if (!commentsPayload.configured) setMessage("DB 연결 전에는 정적 댓글만 표시됩니다.");
    }
    load().catch(() => setMessage("댓글을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [query]);

  async function submitComment(event) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/comments", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify({ scope, targetId, visibility, body }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "댓글 저장에 실패했습니다.");
      return;
    }
    setComments((items) => [...items, payload.item]);
    setBody("");
    setMessage("댓글이 저장되었습니다.");
  }

  const canComment = session?.editableScopes?.includes("comments");

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Comments</span>
          <h2>프로젝트 의견</h2>
        </div>
        <span className="status-pill">{comments.length} items</span>
      </div>
      <div className="compact-list">
        {comments.map((comment) => (
          <article key={comment.id}>
            <strong>{comment.authorName || comment.authorLogin}</strong>
            <span>{comment.visibility} · {new Date(comment.createdAt).toLocaleDateString("ko-KR")}</span>
            <p>{comment.body}</p>
          </article>
        ))}
      </div>

      {canComment ? (
        <form className="editor-form" onSubmit={submitComment}>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="프로젝트 의견이나 질문을 남기세요." required />
          <select value={visibility} onChange={(event) => setVisibility(event.target.value)}>
            <option value="team-only">team-only</option>
            <option value="public">public</option>
            {session?.role === "admin" && <option value="admin-only">admin-only</option>}
          </select>
          <button className="action-button" type="submit">
            댓글 저장
          </button>
        </form>
      ) : (
        <p className="muted">댓글 작성은 GitHub 로그인한 team-ASP 멤버에게 열립니다.</p>
      )}
      {message && <p className="muted">{message}</p>}
    </section>
  );
}
