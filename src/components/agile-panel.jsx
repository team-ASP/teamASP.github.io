"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CheckCircle2, FileText, Kanban, Pin, Send, Trash2 } from "lucide-react";

const AGILE_KINDS = [
  { id: "memo", label: "Quick Memo" },
  { id: "standup", label: "Standup" },
  { id: "idea", label: "Idea" },
  { id: "blocker", label: "Blocker" },
  { id: "meeting", label: "Meeting Scrap" },
];

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function dayBucket(iso) {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(d);
}

export function AgilePanel({
  canEdit,
  notes,
  onCreateNote,
  onTogglePin,
  onToggleResolve,
  onDeleteNote,
  onPromoteToKanban,
  onPromoteToDocs,
}) {
  const [kind, setKind] = useState("memo");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [filterKind, setFilterKind] = useState("all");
  const [showResolved, setShowResolved] = useState(true);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (filterKind !== "all" && n.kind !== filterKind) return false;
      if (!showResolved && n.resolved) return false;
      if (!q) return true;
      return (
        String(n.body || "").toLowerCase().includes(q) ||
        String(n.authorName || n.authorLogin || "").toLowerCase().includes(q) ||
        (n.tags || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [filterKind, notes, query, showResolved]);

  const pinned = useMemo(() => filtered.filter((n) => n.pinned), [filtered]);
  const grouped = useMemo(() => {
    const groups = new Map();
    for (const item of filtered.filter((n) => !n.pinned)) {
      const key = dayBucket(item.createdAt);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    return [...groups.entries()];
  }, [filtered]);

  async function handleSubmit(event) {
    event?.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onCreateNote({ kind, body: body.trim(), tags });
    setSubmitting(false);
    if (ok) {
      setBody("");
      setTags("");
    }
  }

  function renderNoteCard(note) {
    const kindMeta = AGILE_KINDS.find((k) => k.id === note.kind) || AGILE_KINDS[0];
    return (
      <article key={note.id} className={`v2-agile-entry${note.resolved ? " is-resolved" : ""}${note.kind === "blocker" ? " is-blocker" : ""}`}>
        <div className="v2-agile-entry-head">
          <div className="v2-agile-entry-meta">
            <span className={`v2-kind-badge kind-${note.kind}`}>{kindMeta.label}</span>
            <strong className="v2-agile-author">{note.authorName || note.authorLogin}</strong>
            <span className="v2-agile-time mono">{formatDateTime(note.createdAt)}</span>
            {note.pinned && <span className="v2-tag accent">Pinned</span>}
            {(note.tags || []).map((tag) => (
              <span key={tag} className="v2-tag">#{tag}</span>
            ))}
          </div>
          <div className="v2-agile-actions">
            {canEdit && (
              <>
                <button
                  type="button"
                  className="v2-micro-btn"
                  title="Kanban 카드로 승격"
                  onClick={() => onPromoteToKanban(note)}
                >
                  <Kanban size={13} aria-hidden="true" />
                  <span>Kanban</span>
                  <ArrowUpRight size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="v2-micro-btn"
                  title="Docs 문서로 확장"
                  onClick={() => onPromoteToDocs(note)}
                >
                  <FileText size={13} aria-hidden="true" />
                  <span>Docs</span>
                  <ArrowUpRight size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`v2-micro-icon${note.pinned ? " active" : ""}`}
                  title={note.pinned ? "고정 해제" : "상단 고정"}
                  onClick={() => onTogglePin(note)}
                >
                  <Pin size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`v2-micro-icon${note.resolved ? " active" : ""}`}
                  title={note.resolved ? "미완료로 되돌리기" : "해결됨 표시"}
                  onClick={() => onToggleResolve(note)}
                >
                  <CheckCircle2 size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="v2-micro-icon danger"
                  title="삭제"
                  onClick={() => onDeleteNote(note.id)}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
        </div>
        <p className="v2-agile-body">{note.body}</p>
      </article>
    );
  }

  return (
    <div className="v2-agile-layout">
      <section className="v2-composer-box">
        <div className="v2-composer-head">
          <div>
            <span className="v2-eyebrow">AGILE STREAM</span>
            <h2>빠른 작업 메모 · 데일리 스탠드업 · 회의 스크랩</h2>
          </div>
          <span className="v2-muted mono">{notes.length} notes</span>
        </div>

        {canEdit ? (
          <form className="v2-agile-form" onSubmit={handleSubmit}>
            <div className="v2-agile-kind-row">
              {AGILE_KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`v2-pill-tab${kind === item.id ? " active" : ""}`}
                  onClick={() => setKind(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <input
                className="v2-inline-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="태그 (예: sprint-4, gemini)"
                aria-label="메모 태그"
              />
            </div>
            <div className="v2-agile-input-row">
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="지금 떠오른 아이디어, 스터디 논의 요약, 블로커, 오늘 진행한 내용을 가볍게 남기세요. (⌘+Enter로 즉시 기록)"
                required
              />
              <button type="submit" className="v2-btn-primary" disabled={submitting || !body.trim()}>
                <Send size={14} aria-hidden="true" />
                <span>{submitting ? "저장 중" : "기록"}</span>
              </button>
            </div>
          </form>
        ) : (
          <p className="v2-muted" style={{ marginTop: "8px" }}>
            GitHub 로그인한 team-ASP 멤버는 즉시 애자일 메모를 남기고 Kanban 카드나 Docs 문서로 승격할 수 있습니다.
          </p>
        )}
      </section>

      <section className="v2-filter-strip">
        <div className="v2-filter-left">
          <button type="button" className={`v2-pill-tab${filterKind === "all" ? " active" : ""}`} onClick={() => setFilterKind("all")}>
            All ({notes.length})
          </button>
          {AGILE_KINDS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`v2-pill-tab${filterKind === item.id ? " active" : ""}`}
              onClick={() => setFilterKind(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="v2-filter-right">
          <label className="v2-checkbox-inline">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            <span>해결 항목 표시</span>
          </label>
          <input
            type="search"
            className="v2-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="메모 · 작성자 · 태그 검색..."
            aria-label="애자일 메모 검색"
          />
        </div>
      </section>

      {pinned.length > 0 && (
        <section className="v2-agile-group">
          <h3 className="v2-group-heading">Pinned</h3>
          <div className="v2-agile-stream">{pinned.map(renderNoteCard)}</div>
        </section>
      )}

      {grouped.map(([dateLabel, items]) => (
        <section key={dateLabel} className="v2-agile-group">
          <h3 className="v2-group-heading">{dateLabel}</h3>
          <div className="v2-agile-stream">{items.map(renderNoteCard)}</div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="v2-empty-state">
          <strong>기록된 애자일 메모가 아직 없습니다.</strong>
          <p>위 입력창에 오늘 작업 내용이나 스터디 회의 메모를 1줄로 남겨보세요. 필요한 항목은 버튼 한 번으로 Kanban 카드나 Docs 문서로 확장됩니다.</p>
        </div>
      )}
    </div>
  );
}
