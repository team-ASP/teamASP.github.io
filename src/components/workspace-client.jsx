"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FilePenLine,
  GitBranch,
  Inbox,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

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

const itemTypes = [
  { value: "task", label: "Task" },
  { value: "research", label: "Research" },
  { value: "decision", label: "Decision" },
  { value: "bug", label: "Bug" },
  { value: "archive", label: "Archive" },
];

const priorities = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const archiveKinds = [
  { value: "artifact", label: "Artifact" },
  { value: "report", label: "Report" },
  { value: "presentation", label: "Presentation" },
  { value: "demo", label: "Demo" },
  { value: "dataset", label: "Dataset" },
  { value: "retrospective", label: "Retrospective" },
];

const archiveStatuses = [
  { value: "needed", label: "Needed" },
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "published", label: "Published" },
];

const statusLabels = {
  planning: "Planning",
  planned: "Planned",
  active: "Active",
  "in-progress": "In progress",
  todo: "Todo",
  done: "Done",
  draft: "Draft",
  needed: "Needed",
  ready: "Ready",
  "ready-for-review": "Ready for review",
  review: "Review",
  published: "Published",
  "changes-requested": "Changes requested",
};

function formatDate(date) {
  if (!date) return "No due date";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "No due date";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(value);
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

function emptyBacklogItem(projectId) {
  return {
    projectId,
    title: "",
    description: "",
    type: "task",
    status: "todo",
    priority: "medium",
    due: "",
  };
}

function emptyArchiveItem(projectId) {
  return {
    id: "",
    projectId,
    title: "",
    kind: "artifact",
    status: "needed",
    url: "",
    notes: "",
  };
}

export function WorkspaceClient({ data }) {
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get("project") || data.projects[0].id;
  const [projects, setProjects] = useState(data.projects);
  const project = projects.find((item) => item.id === selectedProjectId) || projects[0];
  const archive = data.archive.find((item) => item.projectId === project.id) || {
    required: ["Project brief", "Final report", "Presentation", "Demo link"],
    missing: [],
  };
  const [active, setActive] = useState("overview");
  const [session, setSession] = useState(null);
  const [taskUpdates, setTaskUpdates] = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [reviewPayload, setReviewPayload] = useState({ items: data.reviewQueue, permissions: { canReview: false } });
  const [draftForm, setDraftForm] = useState(emptyDraft(project.id));
  const [backlogForm, setBacklogForm] = useState(emptyBacklogItem(project.id));
  const [archiveForm, setArchiveForm] = useState(emptyArchiveItem(project.id));
  const [taskStatuses, setTaskStatuses] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [itemModal, setItemModal] = useState(null);
  const [message, setMessage] = useState("");

  const requestOptions = useMemo(() => ({ cache: "no-store", credentials: "same-origin" }), []);
  const sessionAuthenticated = session?.authenticated;

  useEffect(() => {
    let alive = true;
    async function loadShell() {
      const [meResponse, projectsResponse] = await Promise.all([
        fetch("/api/me", requestOptions),
        fetch("/api/projects", requestOptions),
      ]);
      const [me, projectPayload] = await Promise.all([meResponse.json(), projectsResponse.json()]);
      if (!alive) return;
      setSession(me);
      setProjects(projectPayload.items?.length ? projectPayload.items : data.projects);
    }
    loadShell().catch(() => setMessage("프로젝트와 세션 정보를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.projects, requestOptions]);

  useEffect(() => {
    if (session === null) return undefined;
    let alive = true;
    async function loadProjectWorkspace() {
      const [backlogResponse, taskResponse, draftsResponse, reviewResponse, archiveResponse] = await Promise.all([
        fetch(`/api/backlog-items?projectId=${project.id}`, requestOptions),
        fetch("/api/task-updates", requestOptions),
        sessionAuthenticated ? fetch("/api/drafts", requestOptions) : Promise.resolve(null),
        fetch("/api/review-queue", requestOptions),
        fetch(`/api/archive-items?projectId=${project.id}`, requestOptions),
      ]);
      const [backlogPayload, taskPayload, draftPayload, reviewData, archivePayload] = await Promise.all([
        backlogResponse.json(),
        taskResponse.json(),
        draftsResponse ? draftsResponse.json() : Promise.resolve({ configured: true, items: [] }),
        reviewResponse.json(),
        archiveResponse.json(),
      ]);
      if (!alive) return;
      const projectBacklog = backlogPayload.items || [];
      setBacklogItems(projectBacklog);
      setTaskUpdates(taskPayload.items || []);
      setTaskStatuses(
        Object.fromEntries([
          ...data.tasks.map((task) => [task.id, taskPayload.items?.find((item) => item.taskId === task.id)?.status || task.status]),
          ...projectBacklog.map((item) => [item.id, item.status]),
        ]),
      );
      setDrafts((draftPayload.items || []).filter((draft) => draft.targetId === project.id));
      setReviewPayload(reviewData);
      setArchiveItems(archivePayload.items || []);
      setDraftForm(emptyDraft(project.id));
      setBacklogForm(emptyBacklogItem(project.id));
      setArchiveForm(emptyArchiveItem(project.id));
      if (sessionAuthenticated && (!backlogPayload.configured || !taskPayload.configured || !draftPayload.configured || !archivePayload.configured)) {
        setMessage("DB 연결이 활성화되어야 편집 내용이 저장됩니다.");
      }
    }
    loadProjectWorkspace().catch(() => setMessage("워크스페이스 데이터를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.tasks, project.id, requestOptions, session, sessionAuthenticated]);

  const taskUpdateMap = useMemo(() => new Map(taskUpdates.map((item) => [item.taskId, item])), [taskUpdates]);
  const tasks = useMemo(
    () =>
      [
        ...data.tasks.filter((task) => task.projectId === project.id).map((task) => {
          const latest = taskUpdateMap.get(task.id);
          return {
            ...task,
            source: "seed",
            type: "task",
            priority: "medium",
            description: "",
            status: latest?.status || task.status,
            latestUpdate: latest,
          };
        }),
        ...backlogItems.map((item) => ({
          ...item,
          ownerId: item.ownerLogin,
          milestoneId: item.type,
          source: "backlog",
          latestUpdate: null,
        })),
      ],
    [backlogItems, data.tasks, project.id, taskUpdateMap],
  );

  const progress = Math.round((tasks.filter((task) => task.status === "done").length / Math.max(tasks.length, 1)) * 100);
  const canEdit = session?.editableScopes?.some((scope) => ["projects", "tasks", "logs", "sessions"].includes(scope));
  const canReview = reviewPayload.permissions?.canReview;

  async function createBacklogItem(event) {
    event.preventDefault();
    setMessage("");
    const response = await mutate("/api/backlog-items", "POST", backlogForm, session);
    if (!response.ok) return setMessage(response.error || "백로그 항목 생성에 실패했습니다.");
    setBacklogItems((items) => [response.item, ...items]);
    setTaskStatuses((items) => ({ ...items, [response.item.id]: response.item.status }));
    setBacklogForm(emptyBacklogItem(project.id));
    setMessage(`백로그에 추가했습니다: ${response.item.title}`);
  }

  async function saveBoardModal(event) {
    event.preventDefault();
    if (!itemModal) return;
    setMessage("");
    const isBacklogItem = itemModal.source === "backlog";
    const payload = isBacklogItem
      ? {
          id: itemModal.id,
          title: itemModal.title,
          description: itemModal.description,
          type: itemModal.type,
          status: itemModal.status,
          priority: itemModal.priority,
          due: itemModal.due || null,
        }
      : { taskId: itemModal.id, status: itemModal.status, note: itemModal.note || "" };
    const response = await mutate(isBacklogItem ? "/api/backlog-items" : "/api/task-updates", isBacklogItem ? "PATCH" : "POST", payload, session);
    if (!response.ok) return setMessage(response.error || "작업 저장에 실패했습니다.");

    if (isBacklogItem) {
      setBacklogItems((items) => items.map((item) => (item.id === response.item.id ? response.item : item)));
    } else {
      setTaskUpdates((items) => [response.item, ...items.filter((item) => item.taskId !== response.item.taskId)]);
      setTaskNotes((items) => ({ ...items, [itemModal.id]: "" }));
    }
    setTaskStatuses((items) => ({ ...items, [itemModal.id]: response.item.status }));
    setItemModal(null);
    setMessage("작업을 저장했습니다.");
  }

  async function deleteBacklogItem(id) {
    setMessage("");
    const response = await mutate("/api/backlog-items", "DELETE", { id }, session);
    if (!response.ok) return setMessage(response.error || "백로그 항목 삭제에 실패했습니다.");
    setBacklogItems((items) => items.filter((item) => item.id !== id));
    setItemModal(null);
    setMessage("백로그 항목을 삭제했습니다.");
  }

  async function saveDraft(event) {
    event.preventDefault();
    setMessage("");
    const isEdit = Boolean(draftForm.id);
    const response = await mutate("/api/drafts", isEdit ? "PATCH" : "POST", draftForm, session);
    if (!response.ok) return setMessage(response.error || "Draft 저장에 실패했습니다.");
    setDrafts((items) => [response.item, ...items.filter((item) => item.id !== response.item.id)]);
    setDraftForm(response.item);
    setMessage("Draft를 저장했습니다.");
  }

  async function deleteDraft(id) {
    setMessage("");
    const response = await mutate("/api/drafts", "DELETE", { id }, session);
    if (!response.ok) return setMessage(response.error || "Draft 삭제에 실패했습니다.");
    setDrafts((items) => items.filter((item) => item.id !== id));
    if (draftForm.id === id) setDraftForm(emptyDraft(project.id));
    setMessage("Draft를 삭제했습니다.");
  }

  async function submitDraft(id) {
    setMessage("");
    const response = await mutate("/api/review-queue", "POST", { action: "submit-draft", draftId: id }, session);
    if (!response.ok) return setMessage(response.error || "검수 제출에 실패했습니다.");
    setReviewPayload((current) => ({ ...current, items: [response.item, ...current.items] }));
    setDrafts((items) => items.map((draft) => (draft.id === id ? { ...draft, status: "review" } : draft)));
    setMessage(`검수 큐에 제출했습니다: ${response.item.title}`);
  }

  async function reviewItem(action, reviewId) {
    setMessage("");
    const response = await mutate("/api/review-queue", "POST", { action, reviewId, note: reviewNotes[reviewId] || "" }, session);
    if (!response.ok) return setMessage(response.error || "검수 처리에 실패했습니다.");
    setReviewPayload((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === response.item.id ? response.item : item)),
    }));
    setReviewNotes((items) => ({ ...items, [reviewId]: "" }));
    setMessage(`${response.item.title} 상태가 변경되었습니다.`);
  }

  async function deleteReviewItem(reviewId) {
    setMessage("");
    const response = await mutate("/api/review-queue", "DELETE", { reviewId }, session);
    if (!response.ok) return setMessage(response.error || "검수 항목 삭제에 실패했습니다.");
    setReviewPayload((current) => ({ ...current, items: current.items.filter((item) => item.id !== reviewId) }));
    setMessage("검수 큐에서 제거했습니다.");
  }

  async function saveArchiveItem(event) {
    event.preventDefault();
    setMessage("");
    const isEdit = Boolean(archiveForm.id);
    const response = await mutate("/api/archive-items", isEdit ? "PATCH" : "POST", archiveForm, session);
    if (!response.ok) return setMessage(response.error || "아카이브 항목 저장에 실패했습니다.");
    setArchiveItems((items) => [response.item, ...items.filter((item) => item.id !== response.item.id)]);
    setArchiveForm(emptyArchiveItem(project.id));
    setMessage("아카이브 항목을 저장했습니다.");
  }

  async function deleteArchiveItem(id) {
    setMessage("");
    const response = await mutate("/api/archive-items", "DELETE", { id }, session);
    if (!response.ok) return setMessage(response.error || "아카이브 항목 삭제에 실패했습니다.");
    setArchiveItems((items) => items.filter((item) => item.id !== id));
    if (archiveForm.id === id) setArchiveForm(emptyArchiveItem(project.id));
    setMessage("아카이브 항목을 삭제했습니다.");
  }

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <strong>ASP</strong>
          <span>Team Workspace</span>
        </Link>
        <div className="workspace-project-switcher">
          <span className="eyebrow">Project</span>
          {projects.map((item) => (
            <Link key={item.id} className={item.id === project.id ? "active" : ""} href={`/workspace?project=${item.id}`}>
              {item.title}
            </Link>
          ))}
        </div>
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
            <span className="eyebrow">{project.status || "Project"}</span>
            <h1>{project.title}</h1>
            <p>{project.summary}</p>
          </div>
          <div className="workspace-header-actions">
            <Link href={`/projects/${project.id}`}>Project page</Link>
            <Link href="/">Project hub</Link>
            <Link href="/admin/audit">Audit</Link>
          </div>
        </header>

        {message && <div className="workspace-message">{message}</div>}

        {active === "overview" && <OverviewPanel data={data} project={project} tasks={tasks} archive={archive} archiveItems={archiveItems} progress={progress} />}
        {active === "board" && (
          <BoardPanel
            data={data}
            tasks={tasks}
            canEdit={canEdit}
            backlogForm={backlogForm}
            taskStatuses={taskStatuses}
            createBacklogItem={createBacklogItem}
            setBacklogForm={setBacklogForm}
            setItemModal={setItemModal}
            setTaskStatuses={setTaskStatuses}
          />
        )}
        {active === "editor" && (
          <EditorPanel
            canEdit={canEdit}
            draftForm={draftForm}
            drafts={drafts}
            projectId={project.id}
            saveDraft={saveDraft}
            deleteDraft={deleteDraft}
            setDraftForm={setDraftForm}
            submitDraft={submitDraft}
          />
        )}
        {active === "review" && (
          <ReviewPanel
            canReview={canReview}
            items={(reviewPayload.items || []).filter((item) => item.target === project.id || item.sourceType === "static")}
            reviewItem={reviewItem}
            deleteReviewItem={deleteReviewItem}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
          />
        )}
        {active === "archive" && (
          <ArchivePanel
            canEdit={canEdit}
            data={data}
            project={project}
            archive={archive}
            archiveForm={archiveForm}
            archiveItems={archiveItems}
            deleteArchiveItem={deleteArchiveItem}
            saveArchiveItem={saveArchiveItem}
            setArchiveForm={setArchiveForm}
          />
        )}
      </section>

      {itemModal && (
        <BoardItemModal
          data={data}
          item={itemModal}
          canDelete={itemModal.source === "backlog"}
          deleteBacklogItem={deleteBacklogItem}
          saveBoardModal={saveBoardModal}
          setItemModal={setItemModal}
          taskNotes={taskNotes}
          setTaskNotes={setTaskNotes}
        />
      )}
    </main>
  );
}

async function mutate(url, method, body, session) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, ...payload };
}

function OverviewPanel({ data, project, tasks, archive, archiveItems, progress }) {
  const decisions = data.logs.filter((log) => log.projectId === project.id && log.type === "decision");
  const milestones = project.milestones || [];
  return (
    <div className="workspace-flow">
      <section className="workspace-summary">
        <article>
          <span>진행률</span>
          <strong>{progress}%</strong>
          <p>{tasks.filter((task) => task.status === "done").length}개 항목 완료</p>
        </article>
        <article>
          <span>활성 백로그</span>
          <strong>{tasks.filter((task) => task.status !== "done").length}</strong>
          <p>진행 중인 계획 항목</p>
        </article>
        <article>
          <span>아카이브</span>
          <strong>{archiveItems.length}</strong>
          <p>{archive?.missing.length || 0}개 필수 항목 점검</p>
        </article>
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Roadmap</span>
            <h2>프로젝트 흐름</h2>
          </div>
        </div>
        <div className="milestone-list">
          {milestones.map((milestone) => (
            <article key={milestone.id}>
              <span>Week {milestone.week}</span>
              <strong>{milestone.title}</strong>
              <p>{milestone.deliverables?.join(" · ")}</p>
            </article>
          ))}
          {milestones.length === 0 && <p className="workspace-empty">보드에서 백로그를 만들며 로드맵을 구체화하세요.</p>}
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
          {decisions.length === 0 && <p className="workspace-empty">Editor에서 결정 사항을 기록으로 남기세요.</p>}
        </div>
      </section>
    </div>
  );
}

function BoardPanel({ data, tasks, canEdit, backlogForm, taskStatuses, createBacklogItem, setBacklogForm, setItemModal, setTaskStatuses }) {
  return (
    <div className="workspace-board-layout">
      <section className="workspace-section backlog-create-panel">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Backlog</span>
            <h2>작업 추가</h2>
          </div>
          <span className="workspace-hint">{canEdit ? "편집 가능" : "읽기 전용"}</span>
        </div>
        {canEdit ? (
          <form className="backlog-create-form" onSubmit={createBacklogItem}>
            <input
              value={backlogForm.title}
              onChange={(event) => setBacklogForm((item) => ({ ...item, title: event.target.value }))}
              placeholder="작업 제목"
              required
            />
            <div className="form-row">
              <select value={backlogForm.type} onChange={(event) => setBacklogForm((item) => ({ ...item, type: event.target.value }))}>
                {itemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={backlogForm.priority} onChange={(event) => setBacklogForm((item) => ({ ...item, priority: event.target.value }))}>
                {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input type="date" value={backlogForm.due} onChange={(event) => setBacklogForm((item) => ({ ...item, due: event.target.value }))} />
            </div>
            <textarea
              value={backlogForm.description}
              onChange={(event) => setBacklogForm((item) => ({ ...item, description: event.target.value }))}
              placeholder="완료 조건, 참고 링크, 논의 맥락"
            />
            <button className="action-button compact" type="submit">
              <Plus aria-hidden="true" />
              추가
            </button>
          </form>
        ) : (
          <p className="muted">GitHub 로그인한 team-ASP 멤버만 백로그를 추가할 수 있습니다.</p>
        )}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Board</span>
            <h2>작업 흐름</h2>
          </div>
          <span className="workspace-hint">{tasks.length} items</span>
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
                    <div key={task.id} className={`process-card priority-${task.priority || "medium"}`}>
                      <div className="process-card-topline">
                        <span>{task.type || task.milestoneId}</span>
                        <span>{getStatusLabel(task.status)}</span>
                      </div>
                      <strong>{task.title}</strong>
                      <p>{task.source === "backlog" ? task.ownerLogin : memberName(data, task.ownerId)} · {formatDate(task.due)}</p>
                      {task.description && <small>{task.description}</small>}
                      {task.latestUpdate?.note && <small>{task.latestUpdate.note}</small>}
                      <div className="process-edit inline">
                        {canEdit && (
                          <select value={taskStatuses[task.id] || task.status} onChange={(event) => setTaskStatuses((items) => ({ ...items, [task.id]: event.target.value }))}>
                            {boardColumns.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
                          </select>
                        )}
                        <button type="button" onClick={() => setItemModal({ ...task, status: taskStatuses[task.id] || task.status, note: "" })}>
                          상세
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnTasks.length === 0 && <p className="workspace-empty">아직 항목이 없습니다.</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function BoardItemModal({ data, item, canDelete, deleteBacklogItem, saveBoardModal, setItemModal, taskNotes, setTaskNotes }) {
  const isBacklog = item.source === "backlog";
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="작업 상세 편집">
        <header className="modal-header">
          <div>
            <span className="eyebrow">{isBacklog ? "Backlog item" : "Seed task"}</span>
            <h2>{item.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setItemModal(null)} aria-label="닫기">
            <X aria-hidden="true" />
          </button>
        </header>
        <form className="workspace-form" onSubmit={saveBoardModal}>
          {isBacklog ? (
            <>
              <label>
                <span>제목</span>
                <input value={item.title} onChange={(event) => setItemModal((current) => ({ ...current, title: event.target.value }))} required />
              </label>
              <label>
                <span>상세 내용</span>
                <textarea value={item.description || ""} onChange={(event) => setItemModal((current) => ({ ...current, description: event.target.value }))} />
              </label>
              <div className="modal-grid">
                <label>
                  <span>종류</span>
                  <select value={item.type} onChange={(event) => setItemModal((current) => ({ ...current, type: event.target.value }))}>
                    {itemTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>우선순위</span>
                  <select value={item.priority} onChange={(event) => setItemModal((current) => ({ ...current, priority: event.target.value }))}>
                    {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                </label>
              </div>
            </>
          ) : (
            <p className="muted">초기 설계 태스크는 제목과 설명을 코드 데이터로 관리합니다. 여기서는 진행 상태와 변경 메모만 저장합니다.</p>
          )}
          <div className="modal-grid">
            <label>
              <span>상태</span>
              <select value={item.status} onChange={(event) => setItemModal((current) => ({ ...current, status: event.target.value }))}>
                {boardColumns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
              </select>
            </label>
            {isBacklog && (
              <label>
                <span>기한</span>
                <input type="date" value={item.due ? String(item.due).slice(0, 10) : ""} onChange={(event) => setItemModal((current) => ({ ...current, due: event.target.value }))} />
              </label>
            )}
          </div>
          {!isBacklog && (
            <label>
              <span>변경 메모</span>
              <input
                value={taskNotes[item.id] || item.note || ""}
                onChange={(event) => {
                  setTaskNotes((items) => ({ ...items, [item.id]: event.target.value }));
                  setItemModal((current) => ({ ...current, note: event.target.value }));
                }}
                placeholder={`${memberName(data, item.ownerId)}에게 공유할 변경 맥락`}
              />
            </label>
          )}
          <div className="modal-actions">
            {canDelete && (
              <button className="danger-button" type="button" onClick={() => deleteBacklogItem(item.id)}>
                <Trash2 aria-hidden="true" />
                삭제
              </button>
            )}
            <button className="action-button compact" type="submit">저장</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditorPanel({ canEdit, draftForm, drafts, projectId, saveDraft, deleteDraft, setDraftForm, submitDraft }) {
  return (
    <div className="workspace-editor-grid">
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Editor</span>
            <h2>{draftForm.id ? "Draft 편집" : "새 기록 작성"}</h2>
          </div>
          <button className="subtle-button" type="button" onClick={() => setDraftForm(emptyDraft(projectId))}>새 Draft</button>
        </div>
        {canEdit ? (
          <form className="workspace-form" onSubmit={saveDraft}>
            <label>
              <span>기록 종류</span>
              <select value={draftForm.type} onChange={(event) => setDraftForm((item) => ({ ...item, type: event.target.value }))}>
                {draftTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
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
            <div className="workspace-row-actions">
              <button className="action-button compact" type="submit">저장</button>
              {draftForm.id && <button className="danger-button" type="button" onClick={() => deleteDraft(draftForm.id)}>삭제</button>}
            </div>
          </form>
        ) : (
          <p className="muted">GitHub 로그인한 team-ASP 멤버만 기록을 작성할 수 있습니다.</p>
        )}
      </section>

      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Drafts</span>
            <h2>기록과 검수 제출</h2>
          </div>
          <span className="workspace-hint">{drafts.length} items</span>
        </div>
        <div className="workspace-list">
          {drafts.map((draft) => (
            <article key={draft.id}>
              <strong>{draft.title}</strong>
              <span>{draftTypes.find((item) => item.value === draft.type)?.label || draft.type} · {getStatusLabel(draft.status)}</span>
              <p>{draft.body.slice(0, 180)}{draft.body.length > 180 ? "..." : ""}</p>
              <div className="workspace-row-actions">
                <button type="button" onClick={() => setDraftForm(draft)}>편집</button>
                <button type="button" onClick={() => submitDraft(draft.id)} disabled={draft.status === "review" || draft.status === "published"}>
                  검수 제출
                </button>
                <button type="button" onClick={() => deleteDraft(draft.id)}>삭제</button>
              </div>
            </article>
          ))}
          {drafts.length === 0 && <p className="workspace-empty">아직 저장된 Draft가 없습니다.</p>}
        </div>
      </section>
    </div>
  );
}

function ReviewPanel({ canReview, items, reviewItem, deleteReviewItem, reviewNotes, setReviewNotes }) {
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
              {item.reviewNote && <p>{item.reviewNote}</p>}
              {canReview && item.sourceType !== "static" && (
                <input
                  value={reviewNotes[item.id] || ""}
                  onChange={(event) => setReviewNotes((notes) => ({ ...notes, [item.id]: event.target.value }))}
                  placeholder="검수 의견"
                />
              )}
            </div>
            {canReview && item.sourceType !== "static" && (
              <div className="workspace-row-actions">
                <button type="button" onClick={() => reviewItem("approve", item.id)}>승인</button>
                <button type="button" onClick={() => reviewItem("request-changes", item.id)}>수정 요청</button>
                <button type="button" onClick={() => deleteReviewItem(item.id)}>제거</button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && <p className="workspace-empty">검수 대기 항목이 없습니다.</p>}
      </div>
    </section>
  );
}

function ArchivePanel({ canEdit, data, project, archive, archiveForm, archiveItems, deleteArchiveItem, saveArchiveItem, setArchiveForm }) {
  const projectLogs = data.logs.filter((log) => log.projectId === project.id);
  return (
    <div className="workspace-editor-grid">
      <section className="workspace-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Archive</span>
            <h2>산출물 관리</h2>
          </div>
          <CheckCircle2 aria-hidden="true" className="panel-icon" />
        </div>
        {canEdit ? (
          <form className="workspace-form" onSubmit={saveArchiveItem}>
            <label>
              <span>제목</span>
              <input value={archiveForm.title} onChange={(event) => setArchiveForm((item) => ({ ...item, title: event.target.value }))} required />
            </label>
            <div className="modal-grid">
              <label>
                <span>종류</span>
                <select value={archiveForm.kind} onChange={(event) => setArchiveForm((item) => ({ ...item, kind: event.target.value }))}>
                  {archiveKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                </select>
              </label>
              <label>
                <span>상태</span>
                <select value={archiveForm.status} onChange={(event) => setArchiveForm((item) => ({ ...item, status: event.target.value }))}>
                  {archiveStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </label>
            </div>
            <label>
              <span>URL</span>
              <input value={archiveForm.url} onChange={(event) => setArchiveForm((item) => ({ ...item, url: event.target.value }))} placeholder="https://..." />
            </label>
            <label>
              <span>노트</span>
              <textarea value={archiveForm.notes} onChange={(event) => setArchiveForm((item) => ({ ...item, notes: event.target.value }))} />
            </label>
            <div className="workspace-row-actions">
              <button className="action-button compact" type="submit">{archiveForm.id ? "수정" : "추가"}</button>
              {archiveForm.id && <button className="subtle-button" type="button" onClick={() => setArchiveForm(emptyArchiveItem(project.id))}>취소</button>}
            </div>
          </form>
        ) : (
          <p className="muted">로그인한 팀 멤버만 아카이브 항목을 관리할 수 있습니다.</p>
        )}
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
        <span className="eyebrow">Artifacts</span>
        <h2>발표와 회고 산출물</h2>
        <div className="workspace-list">
          {archiveItems.map((item) => (
            <article key={item.id}>
              <BookOpen aria-hidden="true" />
              <strong>{item.title}</strong>
              <span>{archiveKinds.find((kind) => kind.value === item.kind)?.label || item.kind} · {getStatusLabel(item.status)}</span>
              {item.url && <a href={item.url} target="_blank" rel="noreferrer">{item.url}</a>}
              {item.notes && <p>{item.notes}</p>}
              {canEdit && (
                <div className="workspace-row-actions">
                  <button type="button" onClick={() => setArchiveForm(item)}>편집</button>
                  <button type="button" onClick={() => deleteArchiveItem(item.id)}>삭제</button>
                </div>
              )}
            </article>
          ))}
          {archiveItems.length === 0 && <p className="workspace-empty">아직 등록된 산출물이 없습니다.</p>}
        </div>
        <div className="workspace-list compact">
          {projectLogs.map((log) => (
            <article key={log.id}>
              <strong>{log.title}</strong>
              <span>{log.type} · {formatDate(log.date)}</span>
              <p>{log.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
