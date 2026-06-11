"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Archive, BookOpen, CheckCircle2, ClipboardList, FilePenLine, GitBranch, Inbox, ShieldCheck } from "lucide-react";

const workspaceNav = [
  { id: "overview", label: "Overview", icon: GitBranch },
  { id: "board", label: "Planning board", icon: ClipboardList },
  { id: "editor", label: "Editor", icon: FilePenLine },
  { id: "review", label: "Review", icon: Inbox },
  { id: "archive", label: "Archive", icon: Archive },
];

const boardColumns = [
  { id: "todo", title: "Todo", description: "아직 시작하지 않은 일", statuses: ["todo", "planned"] },
  { id: "in-progress", title: "In progress", description: "현재 진행 중인 일", statuses: ["in-progress", "active"] },
  { id: "ready-for-review", title: "Review", description: "검수나 피드백이 필요한 일", statuses: ["ready-for-review", "review"] },
  { id: "done", title: "Done", description: "완료되어 기록으로 남길 일", statuses: ["done", "published"] },
];

const draftTypes = [
  { value: "session-note", label: "세션 기록" },
  { value: "task-update", label: "태스크 업데이트" },
  { value: "experiment-log", label: "실험 로그" },
  { value: "archive-note", label: "아카이브 노트" },
];

const statusLabels = {
  planning: "Planning",
  planned: "Planned",
  active: "Active",
  "in-progress": "In progress",
  todo: "Todo",
  done: "Done",
  draft: "Draft",
  "ready-for-review": "Ready for review",
  review: "Review",
  published: "Published",
  "changes-requested": "Changes requested",
};

function formatDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(date));
}

function getStatusLabel(status) {
  return statusLabels[status] || status;
}

function memberName(data, id) {
  return data.members.find((member) => member.id === id)?.name || id;
}

function emptyDraft(projectId) {
  return {
    id: "",
    type: "experiment-log",
    targetId: projectId,
    title: "",
    body: "",
    status: "draft",
  };
}

export function WorkspaceClient({ data }) {
  const project = data.projects[0];
  const archive = data.archive.find((item) => item.projectId === project.id);
  const [active, setActive] = useState("overview");
  const [session, setSession] = useState(null);
  const [taskUpdates, setTaskUpdates] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [reviewPayload, setReviewPayload] = useState({ items: data.reviewQueue, permissions: { canReview: false } });
  const [draftForm, setDraftForm] = useState(emptyDraft(project.id));
  const [taskStatuses, setTaskStatuses] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [message, setMessage] = useState("");

  const requestOptions = useMemo(() => ({ cache: "no-store", credentials: "same-origin" }), []);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [meResponse, taskResponse, draftsResponse, reviewResponse] = await Promise.all([
        fetch("/api/me", requestOptions),
        fetch("/api/task-updates", requestOptions),
        fetch("/api/drafts", requestOptions),
        fetch("/api/review-queue", requestOptions),
      ]);
      const [me, taskPayload, draftPayload, reviewData] = await Promise.all([
        meResponse.json(),
        taskResponse.json(),
        draftsResponse.json(),
        reviewResponse.json(),
      ]);
      if (!alive) return;
      setSession(me);
      setTaskUpdates(taskPayload.items || []);
      setTaskStatuses(
        Object.fromEntries(data.tasks.map((task) => [task.id, taskPayload.items?.find((item) => item.taskId === task.id)?.status || task.status])),
      );
      setDrafts(draftPayload.items || []);
      setReviewPayload(reviewData);
      if (me.authenticated && (!taskPayload.configured || !draftPayload.configured)) {
        setMessage("DB 연결이 활성화되어야 편집 내용이 저장됩니다.");
      }
    }
    load().catch(() => setMessage("워크스페이스 데이터를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.tasks, requestOptions]);

  const taskUpdateMap = useMemo(() => new Map(taskUpdates.map((item) => [item.taskId, item])), [taskUpdates]);
  const tasks = useMemo(
    () =>
      data.tasks.map((task) => {
        const latest = taskUpdateMap.get(task.id);
        return { ...task, status: latest?.status || task.status, latestUpdate: latest };
      }),
    [data.tasks, taskUpdateMap],
  );

  const progress = Math.round((tasks.filter((task) => task.status === "done").length / Math.max(tasks.length, 1)) * 100);
  const canEdit = session?.editableScopes?.some((scope) => ["tasks", "logs", "sessions"].includes(scope));
  const canReview = reviewPayload.permissions?.canReview;

  async function updateTask(task) {
    setMessage("");
    const status = taskStatuses[task.id] || task.status;
    const response = await fetch("/api/task-updates", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify({ taskId: task.id, status, note: taskNotes[task.id] || "" }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "태스크 상태 변경에 실패했습니다.");
      return;
    }
    setTaskUpdates((items) => [payload.item, ...items.filter((item) => item.taskId !== payload.item.taskId)]);
    setTaskNotes((items) => ({ ...items, [task.id]: "" }));
    setMessage(`${task.title} 상태를 ${getStatusLabel(status)}로 변경했습니다.`);
  }

  async function saveDraft(event) {
    event.preventDefault();
    setMessage("");
    const isEdit = Boolean(draftForm.id);
    const response = await fetch("/api/drafts", {
      method: isEdit ? "PATCH" : "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify(draftForm),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "Draft 저장에 실패했습니다.");
      return;
    }
    setDrafts((items) => [payload.item, ...items.filter((item) => item.id !== payload.item.id)]);
    setDraftForm(payload.item);
    setMessage("Draft를 저장했습니다.");
  }

  async function submitDraft(id) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify({ action: "submit-draft", draftId: id }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "검수 제출에 실패했습니다.");
      return;
    }
    setReviewPayload((current) => ({ ...current, items: [payload.item, ...current.items] }));
    setDrafts((items) => items.map((draft) => (draft.id === id ? { ...draft, status: "review" } : draft)));
    setMessage(`검수 큐에 제출했습니다: ${payload.item.title}`);
  }

  async function reviewItem(action, reviewId) {
    setMessage("");
    const response = await fetch("/api/review-queue", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify({ action, reviewId }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.error || "검수 처리에 실패했습니다.");
      return;
    }
    setReviewPayload((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === payload.item.id ? payload.item : item)),
    }));
    setMessage(`${payload.item.title} 상태가 변경되었습니다.`);
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <strong>ASP</strong>
          <span>Team Workspace</span>
        </Link>
        <nav className="workspace-nav" aria-label="Workspace sections">
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "active" : ""} type="button" onClick={() => setActive(item.id)}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <section className="workspace-session-card">
          <span className="eyebrow">Session</span>
          <strong>{session?.authenticated ? `${session.name || session.login}` : "Viewer"}</strong>
          <p>{session?.authenticated ? `${session.role} · ${session.organization}` : "로그인 후 편집 기능이 열립니다."}</p>
        </section>
      </aside>

      <section className="workspace-main">
        <header className="workspace-header">
          <div>
            <span className="eyebrow">Multi-Agent Study</span>
            <h1>{project.title}</h1>
            <p>{project.summary}</p>
          </div>
          <div className="workspace-header-actions">
            <Link href={`/projects/${project.id}`}>Project page</Link>
            <Link href="/admin/audit">Audit</Link>
          </div>
        </header>

        {message && <div className="workspace-message">{message}</div>}

        {active === "overview" && (
          <OverviewPanel data={data} project={project} tasks={tasks} archive={archive} progress={progress} />
        )}
        {active === "board" && (
          <BoardPanel
            data={data}
            tasks={tasks}
            canEdit={canEdit}
            taskStatuses={taskStatuses}
            taskNotes={taskNotes}
            setTaskStatuses={setTaskStatuses}
            setTaskNotes={setTaskNotes}
            updateTask={updateTask}
          />
        )}
        {active === "editor" && (
          <EditorPanel
            canEdit={canEdit}
            draftForm={draftForm}
            drafts={drafts}
            projectId={project.id}
            saveDraft={saveDraft}
            setDraftForm={setDraftForm}
            submitDraft={submitDraft}
          />
        )}
        {active === "review" && (
          <ReviewPanel canReview={canReview} items={reviewPayload.items || []} reviewItem={reviewItem} />
        )}
        {active === "archive" && <ArchivePanel data={data} project={project} archive={archive} />}
      </section>
    </main>
  );
}

function OverviewPanel({ data, project, tasks, archive, progress }) {
  const decisions = data.logs.filter((log) => log.type === "decision");
  return (
    <div className="workspace-flow">
      <section className="workspace-summary">
        <article>
          <span>진행률</span>
          <strong>{progress}%</strong>
          <p>{tasks.filter((task) => task.status === "done").length}개 태스크 완료</p>
        </article>
        <article>
          <span>다음 세션</span>
          <strong>{formatDate(data.sessions[0].date)}</strong>
          <p>{data.sessions[0].title}</p>
        </article>
        <article>
          <span>아카이브</span>
          <strong>{archive?.missing.length || 0}</strong>
          <p>남은 필수 항목</p>
        </article>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Roadmap</span>
            <h2>12주 프로젝트 흐름</h2>
          </div>
        </div>
        <div className="milestone-list">
          {project.milestones.map((milestone) => (
            <article key={milestone.id}>
              <span>Week {milestone.week}</span>
              <strong>{milestone.title}</strong>
              <p>{milestone.deliverables.join(" · ")}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Decisions</span>
            <h2>의사결정 로그</h2>
          </div>
        </div>
        <div className="workspace-list">
          {decisions.map((log) => (
            <article key={log.id}>
              <strong>{log.title}</strong>
              <span>{formatDate(log.date)} · {memberName(data, log.authorId)}</span>
              <p>{log.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function BoardPanel({ data, tasks, canEdit, taskStatuses, taskNotes, setTaskStatuses, setTaskNotes, updateTask }) {
  return (
    <section className="workspace-section">
      <div className="workspace-section-head">
        <div>
          <span className="eyebrow">Planning board</span>
          <h2>태스크 상태 관리</h2>
        </div>
        <span className="workspace-hint">{canEdit ? "상태 변경 가능" : "읽기 전용"}</span>
      </div>
      <div className="process-board">
        {boardColumns.map((column) => {
          const columnTasks = tasks.filter((task) => column.statuses.includes(task.status));
          return (
            <article key={column.id} className="process-column">
              <header>
                <h3>{column.title}</h3>
                <p>{column.description}</p>
              </header>
              <div className="process-card-list">
                {columnTasks.map((task) => (
                  <div key={task.id} className="process-card">
                    <span>{task.milestoneId}</span>
                    <strong>{task.title}</strong>
                    <p>{memberName(data, task.ownerId)} · {formatDate(task.due)}</p>
                    {task.latestUpdate?.note && <small>{task.latestUpdate.note}</small>}
                    {canEdit && (
                      <div className="process-edit">
                        <select value={taskStatuses[task.id] || task.status} onChange={(event) => setTaskStatuses((items) => ({ ...items, [task.id]: event.target.value }))}>
                          {boardColumns.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.title}
                            </option>
                          ))}
                        </select>
                        <input
                          value={taskNotes[task.id] || ""}
                          onChange={(event) => setTaskNotes((items) => ({ ...items, [task.id]: event.target.value }))}
                          placeholder="변경 메모"
                        />
                        <button type="button" onClick={() => updateTask(task)}>
                          상태 저장
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {columnTasks.length === 0 && <p className="workspace-empty">아직 항목이 없습니다.</p>}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EditorPanel({ canEdit, draftForm, drafts, projectId, saveDraft, setDraftForm, submitDraft }) {
  return (
    <div className="workspace-editor-grid">
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Editor</span>
            <h2>{draftForm.id ? "Draft 편집" : "새 기록 작성"}</h2>
          </div>
          <button className="subtle-button" type="button" onClick={() => setDraftForm(emptyDraft(projectId))}>
            새 Draft
          </button>
        </div>
        {canEdit ? (
          <form className="workspace-form" onSubmit={saveDraft}>
            <label>
              <span>기록 종류</span>
              <select value={draftForm.type} onChange={(event) => setDraftForm((item) => ({ ...item, type: event.target.value }))}>
                {draftTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>제목</span>
              <input value={draftForm.title} onChange={(event) => setDraftForm((item) => ({ ...item, title: event.target.value }))} required />
            </label>
            <label>
              <span>내용</span>
              <textarea value={draftForm.body} onChange={(event) => setDraftForm((item) => ({ ...item, body: event.target.value }))} required />
            </label>
            <button className="action-button" type="submit">
              저장
            </button>
          </form>
        ) : (
          <p className="muted">GitHub 로그인한 team-ASP 멤버만 기록을 작성할 수 있습니다.</p>
        )}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Drafts</span>
            <h2>내 기록과 검수 제출</h2>
          </div>
          <span className="workspace-hint">{drafts.length} items</span>
        </div>
        <div className="workspace-list">
          {drafts.map((draft) => (
            <article key={draft.id}>
              <strong>{draft.title}</strong>
              <span>{draftTypes.find((item) => item.value === draft.type)?.label || draft.type} · {getStatusLabel(draft.status)}</span>
              <p>{draft.body.slice(0, 140)}{draft.body.length > 140 ? "..." : ""}</p>
              <div className="workspace-row-actions">
                <button type="button" onClick={() => setDraftForm(draft)}>
                  편집
                </button>
                <button type="button" onClick={() => submitDraft(draft.id)} disabled={draft.status === "review" || draft.status === "published"}>
                  검수 제출
                </button>
              </div>
            </article>
          ))}
          {drafts.length === 0 && <p className="workspace-empty">아직 저장된 Draft가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function ReviewPanel({ canReview, items, reviewItem }) {
  return (
    <section className="workspace-section">
      <div className="workspace-section-head">
        <div>
          <span className="eyebrow">Review</span>
          <h2>검수 큐</h2>
        </div>
        <span className="workspace-hint">{canReview ? "승인 권한 있음" : "대기 항목 조회"}</span>
      </div>
      <div className="review-lanes">
        {items.map((item) => (
          <article key={item.id} className="review-item">
            <ShieldCheck aria-hidden="true" />
            <div>
              <strong>{item.title}</strong>
              <span>{item.type || item.sourceType} · {getStatusLabel(item.status)} · {item.target}</span>
            </div>
            {canReview && item.sourceType !== "static" && (
              <div className="workspace-row-actions">
                <button type="button" onClick={() => reviewItem("approve", item.id)}>
                  승인
                </button>
                <button type="button" onClick={() => reviewItem("request-changes", item.id)}>
                  수정 요청
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ArchivePanel({ data, project, archive }) {
  return (
    <div className="workspace-editor-grid">
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Archive</span>
            <h2>최종 결과물 체크리스트</h2>
          </div>
          <CheckCircle2 aria-hidden="true" className="panel-icon" />
        </div>
        <div className="archive-checklist">
          {archive?.required.map((item) => {
            const missing = archive.missing.includes(item);
            return (
              <article key={item} className={missing ? "missing" : "ready"}>
                <strong>{item}</strong>
                <span>{missing ? "필요" : "준비됨"}</span>
              </article>
            );
          })}
        </div>
      </section>

      <section className="workspace-section">
        <span className="eyebrow">Knowledge base</span>
        <h2>발표와 회고로 이어질 기록</h2>
        <div className="workspace-list">
          {data.logs.map((log) => (
            <article key={log.id}>
              <BookOpen aria-hidden="true" />
              <strong>{log.title}</strong>
              <span>{formatDate(log.date)} · {project.title}</span>
              <p>{log.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
