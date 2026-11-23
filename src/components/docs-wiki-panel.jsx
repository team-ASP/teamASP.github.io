"use client";

import { useMemo, useRef, useState } from "react";
import { BookOpen, Edit3, ExternalLink, FilePlus2, Folder, Search, Trash2 } from "lucide-react";
import { extractHeadings, MarkdownRenderer, safeMarkdownHref } from "@/components/markdown-renderer";

const WIKI_SPACES = [
  { id: "spec", label: "Spec & Architecture" },
  { id: "meeting", label: "Meeting Minutes" },
  { id: "experiment", label: "Experiment & Paper" },
  { id: "decision", label: "Decision & RFC" },
  { id: "archive", label: "Archive & Links" },
  { id: "general", label: "General Notes" },
];

const DOC_STATUSES = [
  { id: "draft", label: "Draft" },
  { id: "review", label: "In Review" },
  { id: "published", label: "Published" },
];

const STARTER_TEMPLATES = [
  {
    id: "tpl-meeting",
    space: "meeting",
    title: "주간 스터디 회의록 템플릿",
    tags: ["meeting", "weekly"],
    content: `## 회의 개요
- **일시**: YYYY-MM-DD
- **참석자**: 
- **핵심 안건**: 

## 진행 공유 (Agile Sync)
- [ ] 지난 주 액션 아이템 점검
- [ ] 이번 주 주요 변경 사항 공유

## 주요 논의 및 결정사항
> 핵심 의사결정을 인용구로 강조해 두면 나중에 검색하기 쉽습니다.

## Action Items
| 담당자 | 작업 내용 | 목표 기한 |
| --- | --- | --- |
| @member | 내용 입력 | YYYY-MM-DD |`,
  },
  {
    id: "tpl-experiment",
    space: "experiment",
    title: "벤치마크 · 모델 실험 리포트 템플릿",
    tags: ["experiment", "benchmark"],
    content: `## 실험 가설
무엇을 검증하려고 했는가?

## 실험 설정
- **테스트베드**: MafiaSimulation (santamkj 643d3a4 + Option B)
- **대상 모델**: 
- **세팅 프로파일**: \`std_t07\`, \`logic_t02\`, \`mafia_c1_detective\`

## 정량 결과
| 모델 | 세팅 | 종합 점수 | Social | Reasoning | Memory | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| Gemini 3.5 Lite | logic_t02 | 76.7 | 68.9 | 80.1 | 86.6 | 기준선 |

## 정성 분석 및 다음 단계
- [ ] 발견된 한계점 정리
- [ ] 다음 실험 매트릭스 설계`,
  },
  {
    id: "tpl-rfc",
    space: "spec",
    title: "기술 설계 문서 (RFC / Spec) 템플릿",
    tags: ["spec", "architecture"],
    content: `## 배경 및 문제 정의
현재 구조의 한계와 해결하려는 핵심 문제를 작성합니다.

## 제안 아키텍처
\`\`\`text
Client -> API Route (CSRF + RateLimit) -> Neon PostgreSQL
\`\`\`

## 보안 및 운영 체크리스트
- [ ] 입력값 검증 및 URL 화이트리스트
- [ ] 권한 검증 및 감사 로그 기록
- [ ] 롤백/마이그레이션 전략 확인`,
  },
];

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export function DocsWikiPanel({
  canEdit,
  projectId,
  pages,
  archiveItems,
  initialSelectedId = "",
  onSavePage,
  onDeletePage,
}) {
  const [search, setSearch] = useState("");
  const [spaceFilter, setSpaceFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(initialSelectedId || "");
  const [mode, setMode] = useState("read");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  // Merge DB wiki pages + legacy archive items (read-only view or promotable) + starter templates if empty
  const allDocs = useMemo(() => {
    const wikiDocs = pages.map((p) => ({ ...p, source: "wiki" }));
    const legacyArchiveDocs = archiveItems.map((a) => ({
      id: `archive-${a.id}`,
      rawArchiveId: a.id,
      projectId,
      parentId: "",
      space: "archive",
      title: a.title,
      content: a.notes || "",
      status: a.status === "published" ? "published" : a.status === "ready" ? "review" : "draft",
      referenceUrl: a.url || "",
      tags: [a.kind || "archive"],
      authorName: a.authorName || a.authorLogin || "Team",
      updatedAt: a.updatedAt || a.createdAt,
      source: "archive-legacy",
    }));
    const combined = [...wikiDocs, ...legacyArchiveDocs];
    if (combined.length === 0) {
      return STARTER_TEMPLATES.map((t) => ({
        ...t,
        projectId,
        parentId: "",
        status: "published",
        referenceUrl: "",
        authorName: "ASP Template",
        updatedAt: "",
        source: "template",
      }));
    }
    return combined;
  }, [archiveItems, pages, projectId]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allDocs.filter((doc) => {
      if (spaceFilter !== "all" && doc.space !== spaceFilter) return false;
      if (!q) return true;
      return (
        String(doc.title || "").toLowerCase().includes(q) ||
        String(doc.content || "").toLowerCase().includes(q) ||
        (doc.tags || []).join(" ").toLowerCase().includes(q)
      );
    });
  }, [allDocs, search, spaceFilter]);

  const groupedBySpace = useMemo(() => {
    const map = new Map();
    for (const sp of WIKI_SPACES) {
      const docs = filteredDocs.filter((d) => d.space === sp.id);
      if (docs.length > 0) map.set(sp, docs);
    }
    return [...map.entries()];
  }, [filteredDocs]);

  const activeDoc = useMemo(() => {
    if (draft) return draft;
    return allDocs.find((d) => d.id === selectedId) || filteredDocs[0] || allDocs[0] || null;
  }, [allDocs, draft, filteredDocs, selectedId]);

  const headings = useMemo(() => extractHeadings(activeDoc?.content || ""), [activeDoc?.content]);

  function startNewDoc(template = null) {
    setDraft({
      id: "",
      projectId,
      parentId: "",
      space: template?.space || (spaceFilter !== "all" ? spaceFilter : "spec"),
      title: template ? template.title.replace(" 템플릿", "") : "",
      content: template?.content || "## 개요\n\n내용을 작성하세요.\n\n## 체크리스트\n- [ ] 항목 1\n",
      status: "draft",
      referenceUrl: "",
      tagsText: template ? (template.tags || []).join(", ") : "",
      source: "wiki",
    });
    setMode("split");
  }

  function startEditDoc(doc) {
    setDraft({
      id: doc.source === "wiki" ? doc.id : "",
      projectId,
      parentId: doc.parentId || "",
      space: doc.space || "general",
      title: doc.title,
      content: doc.content || "",
      status: doc.status || "draft",
      referenceUrl: doc.referenceUrl || "",
      tagsText: Array.isArray(doc.tags) ? doc.tags.join(", ") : "",
      source: "wiki",
    });
    setMode("split");
  }

  function insertSnippet(snippet) {
    if (!draft) return;
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => ({ ...prev, content: `${prev.content || ""}\n${snippet}` }));
      return;
    }
    const start = el.selectionStart ?? draft.content.length;
    const end = el.selectionEnd ?? start;
    const next = `${draft.content.slice(0, start)}${snippet}${draft.content.slice(end)}`;
    setDraft((prev) => ({ ...prev, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  function toggleChecklistInDraft(lineIndex) {
    if (!draft) return;
    const lines = String(draft.content || "").replace(/\r\n/g, "\n").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*[-*]\s+\[)([ xX])(\]\s+)/,
      (_, pre, mark, post) => `${pre}${mark.toLowerCase() === "x" ? " " : "x"}${post}`,
    );
    setDraft((prev) => ({ ...prev, content: lines.join("\n") }));
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!draft || !draft.title.trim() || saving) return;
    setSaving(true);
    const saved = await onSavePage({
      id: draft.id || undefined,
      projectId,
      parentId: draft.parentId || "",
      space: draft.space,
      title: draft.title.trim(),
      content: draft.content || "",
      status: draft.status,
      referenceUrl: draft.referenceUrl || "",
      tags: draft.tagsText || "",
    });
    setSaving(false);
    if (saved) {
      setDraft(null);
      setSelectedId(saved.id);
      setMode("read");
    }
  }

  async function handleDelete(doc) {
    if (!doc || doc.source !== "wiki") return;
    const ok = await onDeletePage(doc.id);
    if (ok) {
      setDraft(null);
      setSelectedId("");
      setMode("read");
    }
  }

  const isEditing = Boolean(draft);
  const safeRefUrl = safeMarkdownHref(activeDoc?.referenceUrl);

  return (
    <div className="v2-wiki-shell">
      {/* Left Confluence/Notion Document Tree */}
      <aside className="v2-wiki-tree" aria-label="문서 디렉토리">
        <div className="v2-wiki-tree-top">
          <div className="v2-search-wrap">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="문서 검색..."
              aria-label="문서 검색"
            />
          </div>
          {canEdit && (
            <button type="button" className="v2-btn-primary compact" onClick={() => startNewDoc()}>
              <FilePlus2 size={14} aria-hidden="true" />
              <span>새 문서</span>
            </button>
          )}
        </div>

        <div className="v2-space-pills">
          <button type="button" className={`v2-space-pill${spaceFilter === "all" ? " active" : ""}`} onClick={() => setSpaceFilter("all")}>
            All ({allDocs.length})
          </button>
          {WIKI_SPACES.map((sp) => (
            <button
              key={sp.id}
              type="button"
              className={`v2-space-pill${spaceFilter === sp.id ? " active" : ""}`}
              onClick={() => setSpaceFilter(sp.id)}
            >
              {sp.label.split(" ")[0]}
            </button>
          ))}
        </div>

        <div className="v2-wiki-tree-list">
          {groupedBySpace.map(([space, docs]) => (
            <div key={space.id} className="v2-wiki-folder">
              <div className="v2-wiki-folder-title">
                <Folder size={13} aria-hidden="true" />
                <span>{space.label}</span>
                <span className="mono">{docs.length}</span>
              </div>
              <div className="v2-wiki-pages">
                {docs.map((doc) => {
                  const isActive = !isEditing && activeDoc?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      className={`v2-wiki-page-btn${isActive ? " active" : ""}`}
                      onClick={() => {
                        setDraft(null);
                        setSelectedId(doc.id);
                        setMode("read");
                      }}
                    >
                      <span className="v2-wiki-page-title">{doc.title}</span>
                      <span className={`v2-status-dot status-${doc.status}`} title={doc.status} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedBySpace.length === 0 && <p className="v2-muted" style={{ padding: "12px" }}>일치하는 문서가 없습니다.</p>}
        </div>

        {canEdit && (
          <div className="v2-wiki-templates">
            <span className="v2-eyebrow">TEMPLATES</span>
            {STARTER_TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" className="v2-tpl-btn" onClick={() => startNewDoc(tpl)}>
                + {tpl.title.replace(" 템플릿", "")}
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Right Full-Page Notion / Confluence Canvas */}
      <section className="v2-wiki-canvas">
        {isEditing ? (
          <form className="v2-wiki-editor-form" onSubmit={handleSave}>
            <div className="v2-wiki-bar">
              <span className="v2-eyebrow">{draft.id ? "EDIT PAGE" : "NEW PAGE"}</span>
              <div className="v2-wiki-bar-actions">
                <div className="segmented-control">
                  <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>Write</button>
                  <button type="button" className={mode === "split" ? "active" : ""} onClick={() => setMode("split")}>Split</button>
                  <button type="button" className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>Preview</button>
                </div>
                <button type="button" className="v2-btn-ghost" onClick={() => { setDraft(null); setMode("read"); }}>취소</button>
                <button type="submit" className="v2-btn-primary compact" disabled={saving}>
                  {saving ? "저장 중..." : "문서 저장"}
                </button>
              </div>
            </div>

            <input
              className="v2-doc-title-input"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="문서 제목을 입력하세요..."
              required
            />

            <div className="v2-doc-props-grid">
              <label>
                <span>Space</span>
                <select value={draft.space} onChange={(e) => setDraft((prev) => ({ ...prev, space: e.target.value }))}>
                  {WIKI_SPACES.map((sp) => <option key={sp.id} value={sp.id}>{sp.label}</option>)}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select value={draft.status} onChange={(e) => setDraft((prev) => ({ ...prev, status: e.target.value }))}>
                  {DOC_STATUSES.map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}
                </select>
              </label>
              <label>
                <span>Reference URL</span>
                <input
                  value={draft.referenceUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, referenceUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={draft.tagsText}
                  onChange={(e) => setDraft((prev) => ({ ...prev, tagsText: e.target.value }))}
                  placeholder="spec, meeting, v2"
                />
              </label>
            </div>

            {mode !== "read" && (
              <div className="v2-md-toolbar" role="toolbar" aria-label="Markdown 서식 도구">
                <button type="button" onClick={() => insertSnippet("\n## 섹션 제목\n")}>H2</button>
                <button type="button" onClick={() => insertSnippet("\n### 소제목\n")}>H3</button>
                <button type="button" onClick={() => insertSnippet("**강조 텍스트**")}>Bold</button>
                <button type="button" onClick={() => insertSnippet("\n- [ ] 체크리스트 항목\n")}>Checklist</button>
                <button type="button" onClick={() => insertSnippet("\n| 항목 | 내용 |\n| --- | --- |\n| 예시 | 값 |\n")}>Table</button>
                <button type="button" onClick={() => insertSnippet("\n```text\n코드 또는 로그\n```\n")}>Code</button>
                <button type="button" onClick={() => insertSnippet("\n> 핵심 요약 또는 인용\n")}>Quote</button>
              </div>
            )}

            <div className={`v2-wiki-workbench mode-${mode}`}>
              {mode !== "read" && (
                <textarea
                  ref={textareaRef}
                  className="v2-wiki-textarea mono"
                  value={draft.content}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Markdown으로 팀 문서를 작성하세요 (최대 32,000자, 표·체크리스트·코드블록 지원)"
                />
              )}
              {mode !== "edit" && (
                <div className="v2-wiki-preview reader-prose">
                  <MarkdownRenderer value={draft.content} onToggleChecklist={toggleChecklistInDraft} />
                </div>
              )}
            </div>
          </form>
        ) : activeDoc ? (
          <div className="v2-wiki-reader-layout">
            <article className="v2-wiki-article">
              <div className="v2-wiki-bar">
                <div className="v2-wiki-breadcrumb">
                  <span>{WIKI_SPACES.find((s) => s.id === activeDoc.space)?.label || activeDoc.space}</span>
                  <span>/</span>
                  <span className="v2-tag">{DOC_STATUSES.find((s) => s.id === activeDoc.status)?.label || activeDoc.status}</span>
                  {activeDoc.source === "template" && <span className="v2-tag accent">Starter Template</span>}
                  {activeDoc.source === "archive-legacy" && <span className="v2-tag">Legacy Archive</span>}
                </div>
                {canEdit && (
                  <div className="v2-wiki-bar-actions">
                    <button type="button" className="v2-btn-ghost" onClick={() => startEditDoc(activeDoc)}>
                      <Edit3 size={13} aria-hidden="true" />
                      <span>{activeDoc.source === "wiki" ? "편집" : "Docs로 복사 편집"}</span>
                    </button>
                    {activeDoc.source === "wiki" && (
                      <button type="button" className="v2-micro-icon danger" title="문서 삭제" onClick={() => handleDelete(activeDoc)}>
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <h1 className="v2-doc-heading">{activeDoc.title}</h1>

              <div className="v2-doc-meta-bar">
                <span>작성자: <strong>{activeDoc.authorName || "Team"}</strong></span>
                {activeDoc.updatedAt && <span>수정: <span className="mono">{formatDate(activeDoc.updatedAt)}</span></span>}
                {safeRefUrl && (
                  <a href={safeRefUrl} target="_blank" rel="noopener noreferrer" className="v2-ref-link">
                    <ExternalLink size={12} aria-hidden="true" />
                    <span>참고 링크</span>
                  </a>
                )}
                {(activeDoc.tags || []).map((tag) => (
                  <span key={tag} className="v2-tag">#{tag}</span>
                ))}
              </div>

              <div className="v2-doc-prose">
                {activeDoc.content ? (
                  <MarkdownRenderer value={activeDoc.content} />
                ) : (
                  <p className="v2-muted">작성된 문서 본문이 없습니다.</p>
                )}
              </div>
            </article>

            {headings.length > 0 && (
              <aside className="v2-wiki-toc" aria-label="목차">
                <span className="v2-eyebrow">ON THIS PAGE</span>
                <ul>
                  {headings.map((h, i) => (
                    <li key={i} className={`toc-l${h.level}`}>{h.text}</li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        ) : (
          <div className="v2-empty-state">
            <BookOpen size={24} aria-hidden="true" />
            <strong>선택된 문서가 없습니다.</strong>
            <p>좌측에서 문서를 선택하거나 새 문서를 작성해 팀 지식을 체계적으로 기록하세요.</p>
          </div>
        )}
      </section>
    </div>
  );
}
