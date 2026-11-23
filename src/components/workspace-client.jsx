"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Command,
  FileText,
  FolderPlus,
  Inbox,
  LayoutDashboard,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { AgilePanel } from "@/components/agile-panel";
import { BenchmarkViewer } from "@/components/benchmark-viewer";
import { DocsWikiPanel } from "@/components/docs-wiki-panel";
import { countChecklist, MarkdownRenderer, stripMarkdownSnippet } from "@/components/markdown-renderer";

const WORKSPACE_TABS = [
  { id: "overview", label: "Overview", desc: "프로젝트 현황 · 로드맵 · 의사결정", icon: LayoutDashboard },
  { id: "agile", label: "Agile", desc: "빠른 메모 · 스탠드업 · 회의 스크랩", icon: Zap },
  { id: "kanban", label: "Kanban", desc: "작업 보드 · 진행 상태 · 상세 문서", icon: ClipboardList },
  { id: "docs", label: "Docs", desc: "Confluence/Notion 팀 위키 · 아카이브", icon: BookOpen },
  { id: "benchmark", label: "Benchmark", desc: "6D AI 에이전트 성능 리더보드", icon: BarChart3 },
  { id: "review", label: "Review", desc: "검수 큐 · 거버넌스", icon: Inbox },
];

const VALID_TABS = new Set(WORKSPACE_TABS.map((t) => t.id));

const BOARD_COLUMNS = [
  { id: "todo", title: "Todo", description: "예정된 작업", statuses: ["todo", "planned"] },
  { id: "in-progress", title: "In progress", description: "진행 중", statuses: ["in-progress", "active"] },
  { id: "ready-for-review", title: "Review", description: "검수 · 피드백", statuses: ["ready-for-review", "review"] },
  { id: "done", title: "Done", description: "완료", statuses: ["done", "published"] },
];

const ITEM_TYPES = [
  { value: "task", label: "Task" },
  { value: "research", label: "Research" },
  { value: "decision", label: "Decision" },
  { value: "bug", label: "Bug" },
  { value: "archive", label: "Archive" },
];

const PRIORITIES = [
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const ROADMAP_STATUSES = [
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const DECISION_STATUSES = [
  { value: "proposed", label: "Proposed" },
  { value: "accepted", label: "Accepted" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_LABELS = {
  planning: "Planning",
  planned: "Planned",
  active: "Active",
  "in-progress": "In progress",
  blocked: "Blocked",
  todo: "Todo",
  done: "Done",
  draft: "Draft",
  needed: "Needed",
  ready: "Ready",
  proposed: "Proposed",
  accepted: "Accepted",
  superseded: "Superseded",
  "ready-for-review": "Review",
  review: "Review",
  published: "Published",
  "changes-requested": "Changes requested",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function formatDate(date) {
  if (!date) return "No due";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "No due";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(value);
}

function memberName(data, id) {
  return data.members.find((m) => m.id === id)?.name || id;
}

function emptyBacklogItem(projectId) {
  return { projectId, title: "", description: "", type: "task", status: "todo", priority: "medium", tags: "", due: "" };
}

function emptyRoadmapItem(projectId) {
  return { id: "", projectId, source: "database", templateId: "", title: "", timeframe: "", status: "planned", summary: "", startDate: "", endDate: "" };
}

function emptyDecisionRecord(projectId) {
  return { id: "", projectId, source: "database", templateId: "", title: "", status: "proposed", context: "", decision: "", impact: "", decidedAt: "" };
}

function emptyProjectForm() {
  return { repositoryUrl: "", title: "", summary: "", type: "project", status: "active", periodStart: "", periodEnd: "" };
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
  return { ok: response.ok, status: response.status, ...payload };
}

export function WorkspaceClient({ data, initialBenchmark = null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get("project") || data.projects[0].id;
  const tabParam = searchParams.get("tab") || "overview";
  const activeTab = VALID_TABS.has(tabParam) ? tabParam : "overview";

  const [projects, setProjects] = useState(data.projects);
  const project = projects.find((item) => item.id === selectedProjectId) || projects[0];

  const [session, setSession] = useState(null);
  const [agileNotes, setAgileNotes] = useState([]);
  const [wikiPages, setWikiPages] = useState([]);
  const [backlogItems, setBacklogItems] = useState([]);
  const [taskUpdates, setTaskUpdates] = useState([]);
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [decisionRecords, setDecisionRecords] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [reviewPayload, setReviewPayload] = useState({ items: data.reviewQueue, permissions: { canReview: false } });
  const [contentOverrides, setContentOverrides] = useState([]);
  const [taskStatuses, setTaskStatuses] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [selectedDocId, setSelectedDocId] = useState("");

  const [backlogForm, setBacklogForm] = useState(emptyBacklogItem(project.id));
  const [roadmapForm, setRoadmapForm] = useState(emptyRoadmapItem(project.id));
  const [decisionForm, setDecisionForm] = useState(emptyDecisionRecord(project.id));
  const [projectForm, setProjectForm] = useState(emptyProjectForm());
  const [itemModal, setItemModal] = useState(null);
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState("");
  const [toast, setToast] = useState("");

  const requestOptions = useMemo(() => ({ cache: "no-store", credentials: "same-origin" }), []);

  function navigateWorkspace(nextTab, nextProjectId = project.id) {
    const params = new URLSearchParams();
    if (nextProjectId && nextProjectId !== data.projects[0].id) params.set("project", nextProjectId);
    if (nextTab && nextTab !== "overview") params.set("tab", nextTab);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/", { scroll: false });
  }

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadShell() {
      const [meRes, projRes] = await Promise.all([
        fetch("/api/me", requestOptions),
        fetch("/api/projects", requestOptions),
      ]);
      const [me, projPayload] = await Promise.all([meRes.json(), projRes.json()]);
      if (!alive) return;
      setSession(me);
      if (projPayload.items?.length) setProjects(projPayload.items);
    }
    loadShell().catch(() => setToast("세션 또는 프로젝트 정보를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [requestOptions]);

  useEffect(() => {
    if (session === null) return undefined;
    let alive = true;
    async function loadProjectData() {
      const pid = encodeURIComponent(project.id);
      const responses = await Promise.all([
        fetch(`/api/agile-notes?projectId=${pid}`, requestOptions),
        fetch(`/api/wiki-pages?projectId=${pid}`, requestOptions),
        fetch(`/api/backlog-items?projectId=${pid}`, requestOptions),
        fetch("/api/task-updates", requestOptions),
        fetch(`/api/roadmap-items?projectId=${pid}`, requestOptions),
        fetch(`/api/decision-records?projectId=${pid}`, requestOptions),
        fetch(`/api/archive-items?projectId=${pid}`, requestOptions),
        fetch("/api/review-queue", requestOptions),
        fetch(`/api/content-overrides?projectId=${pid}`, requestOptions),
      ]);
      const [agileP, wikiP, backlogP, taskP, roadmapP, decisionP, archiveP, reviewP, overrideP] = await Promise.all(
        responses.map((r) => r.json().catch(() => ({}))),
      );
      if (!alive) return;
      const projBacklog = backlogP.items || [];
      setAgileNotes(agileP.items || []);
      setWikiPages(wikiP.items || []);
      setBacklogItems(projBacklog);
      setTaskUpdates(taskP.items || []);
      setTaskStatuses(
        Object.fromEntries([
          ...data.tasks.map((t) => [t.id, taskP.items?.find((i) => i.taskId === t.id)?.status || t.status]),
          ...projBacklog.map((i) => [i.id, i.status]),
        ]),
      );
      setRoadmapItems(roadmapP.items || []);
      setDecisionRecords(decisionP.items || []);
      setArchiveItems(archiveP.items || []);
      setReviewPayload(reviewP.items ? reviewP : { items: data.reviewQueue, permissions: { canReview: false } });
      setContentOverrides([
        ...(overrideP.items || []),
        ...((taskP.hiddenTaskIds || []).map((taskId) => ({
          projectId: project.id,
          targetType: "task",
          targetId: taskId,
          action: "hidden",
        }))),
      ]);
    }
    loadProjectData().catch(() => setToast("워크스페이스 데이터를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.reviewQueue, data.tasks, project.id, requestOptions, session]);

  const canEdit = session?.editableScopes?.some((s) => ["projects", "tasks", "logs", "sessions"].includes(s));
  const canReview = reviewPayload.permissions?.canReview;
  const canAdmin = session?.editableScopes?.includes("admin");

  const taskUpdateMap = useMemo(() => new Map(taskUpdates.map((item) => [item.taskId, item])), [taskUpdates]);
  const hiddenTaskIds = useMemo(
    () => new Set(contentOverrides.filter((i) => i.targetType === "task").map((i) => i.targetId)),
    [contentOverrides],
  );
  const hiddenRoadmapIds = useMemo(
    () => new Set(contentOverrides.filter((i) => i.targetType === "roadmap").map((i) => i.targetId)),
    [contentOverrides],
  );
  const hiddenDecisionIds = useMemo(
    () => new Set(contentOverrides.filter((i) => i.targetType === "decision").map((i) => i.targetId)),
    [contentOverrides],
  );

  const tasks = useMemo(
    () => [
      ...data.tasks
        .filter((t) => t.projectId === project.id && !hiddenTaskIds.has(t.id))
        .map((t) => {
          const latest = taskUpdateMap.get(t.id);
          return {
            ...t,
            source: "seed",
            type: "task",
            priority: "medium",
            tags: [],
            description: t.description || "",
            status: latest?.status || t.status,
            latestUpdate: latest,
          };
        }),
      ...backlogItems.map((item) => ({
        ...item,
        ownerId: item.ownerLogin,
        source: "backlog",
        latestUpdate: null,
      })),
    ],
    [backlogItems, data.tasks, hiddenTaskIds, project.id, taskUpdateMap],
  );

  const progress = Math.round((tasks.filter((t) => (taskStatuses[t.id] || t.status) === "done").length / Math.max(tasks.length, 1)) * 100);
  const benchmarkTop3 = useMemo(() => (initialBenchmark?.leaderboard || []).slice(0, 3), [initialBenchmark]);

  // ---- Project CRUD ----
  async function createProject(event) {
    event.preventDefault();
    setToast("");
    const payload = Object.fromEntries(Object.entries(projectForm).filter(([, v]) => v !== ""));
    const res = await mutate("/api/projects", "POST", payload, session);
    if (!res.ok) return setToast(res.error || "프로젝트 생성에 실패했습니다.");
    setProjects((prev) => [res.item, ...prev]);
    setProjectForm(emptyProjectForm());
    setProjectModalOpen(false);
    setToast(`새 프로젝트를 생성했습니다: ${res.item.title}`);
    navigateWorkspace("overview", res.item.id);
  }

  // ---- Agile Notes CRUD & Promotions ----
  async function createAgileNote(payload) {
    setToast("");
    const res = await mutate("/api/agile-notes", "POST", { ...payload, projectId: project.id }, session);
    if (!res.ok) {
      setToast(res.error || "애자일 메모 저장에 실패했습니다.");
      return false;
    }
    setAgileNotes((prev) => [res.item, ...prev]);
    setToast("애자일 메모를 기록했습니다.");
    return true;
  }

  async function toggleAgilePin(note) {
    const res = await mutate("/api/agile-notes", "PATCH", { id: note.id, pinned: !note.pinned }, session);
    if (!res.ok) return setToast(res.error || "고정 변경 실패");
    setAgileNotes((prev) => prev.map((n) => (n.id === res.item.id ? res.item : n)));
  }

  async function toggleAgileResolve(note) {
    const res = await mutate("/api/agile-notes", "PATCH", { id: note.id, resolved: !note.resolved }, session);
    if (!res.ok) return setToast(res.error || "상태 변경 실패");
    setAgileNotes((prev) => prev.map((n) => (n.id === res.item.id ? res.item : n)));
  }

  async function deleteAgileNote(id) {
    const res = await mutate("/api/agile-notes", "DELETE", { id }, session);
    if (!res.ok) return setToast(res.error || "삭제 실패");
    setAgileNotes((prev) => prev.filter((n) => n.id !== id));
    setToast("애자일 메모를 삭제했습니다.");
  }

  async function promoteAgileToKanban(note) {
    const firstLine = String(note.body || "").split("\n")[0].slice(0, 90);
    const res = await mutate(
      "/api/backlog-items",
      "POST",
      {
        projectId: project.id,
        title: firstLine,
        description: `## Agile 메모에서 승격됨\n\n${note.body}`,
        type: note.kind === "blocker" ? "bug" : note.kind === "idea" ? "research" : "task",
        status: "todo",
        priority: note.kind === "blocker" ? "high" : "medium",
        tags: (note.tags || []).join(","),
      },
      session,
    );
    if (!res.ok) return setToast(res.error || "Kanban 승격 실패");
    setBacklogItems((prev) => [res.item, ...prev]);
    setTaskStatuses((prev) => ({ ...prev, [res.item.id]: res.item.status }));
    setToast(`Kanban Todo로 승격했습니다: ${res.item.title}`);
    navigateWorkspace("kanban");
  }

  async function promoteAgileToDocs(note) {
    const firstLine = String(note.body || "").split("\n")[0].slice(0, 90);
    const res = await mutate(
      "/api/wiki-pages",
      "POST",
      {
        projectId: project.id,
        space: note.kind === "meeting" ? "meeting" : "general",
        title: firstLine,
        content: `## 배경 (Agile 메모 확장)\n\n${note.body}\n\n## 상세 정리\n- [ ] 추가 맥락 정리\n`,
        status: "draft",
        tags: (note.tags || []).join(","),
      },
      session,
    );
    if (!res.ok) return setToast(res.error || "Docs 확장 실패");
    setWikiPages((prev) => [res.item, ...prev]);
    setSelectedDocId(res.item.id);
    setToast(`Docs 페이지로 확장했습니다: ${res.item.title}`);
    navigateWorkspace("docs");
  }

  // ---- Wiki Docs CRUD ----
  async function saveWikiPage(payload) {
    setToast("");
    const isEdit = Boolean(payload.id);
    const res = await mutate("/api/wiki-pages", isEdit ? "PATCH" : "POST", payload, session);
    if (!res.ok) {
      setToast(res.error || "문서 저장에 실패했습니다.");
      return null;
    }
    setWikiPages((prev) => [res.item, ...prev.filter((p) => p.id !== res.item.id)]);
    setToast(`문서를 저장했습니다: ${res.item.title}`);
    return res.item;
  }

  async function deleteWikiPage(id) {
    const res = await mutate("/api/wiki-pages", "DELETE", { id }, session);
    if (!res.ok) {
      setToast(res.error || "문서 삭제에 실패했습니다.");
      return false;
    }
    setWikiPages((prev) => prev.filter((p) => p.id !== id));
    setToast("문서를 삭제했습니다.");
    return true;
  }

  // ---- Kanban CRUD ----
  async function createBacklogItem(event) {
    event.preventDefault();
    const res = await mutate("/api/backlog-items", "POST", { ...backlogForm, projectId: project.id }, session);
    if (!res.ok) return setToast(res.error || "작업 생성에 실패했습니다.");
    setBacklogItems((prev) => [res.item, ...prev]);
    setTaskStatuses((prev) => ({ ...prev, [res.item.id]: res.item.status }));
    setBacklogForm(emptyBacklogItem(project.id));
    setToast(`Kanban에 추가했습니다: ${res.item.title}`);
  }

  async function quickCreateBacklogItem(status, title) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return false;
    const res = await mutate(
      "/api/backlog-items",
      "POST",
      { projectId: project.id, title: cleanTitle, description: "", type: "task", status, priority: "medium" },
      session,
    );
    if (!res.ok) {
      setToast(res.error || "빠른 추가 실패");
      return false;
    }
    setBacklogItems((prev) => [res.item, ...prev]);
    setTaskStatuses((prev) => ({ ...prev, [res.item.id]: res.item.status }));
    setToast(`추가됨: ${res.item.title}`);
    return true;
  }

  async function quickMoveTask(task, nextStatus) {
    if (!canEdit || !nextStatus || nextStatus === task.status) return;
    const prevStatus = taskStatuses[task.id] || task.status;
    setTaskStatuses((prev) => ({ ...prev, [task.id]: nextStatus }));
    const isBacklog = task.source === "backlog";
    const res = await mutate(
      isBacklog ? "/api/backlog-items" : "/api/task-updates",
      isBacklog ? "PATCH" : "POST",
      isBacklog ? { id: task.id, status: nextStatus } : { taskId: task.id, status: nextStatus, note: "" },
      session,
    );
    if (!res.ok) {
      setTaskStatuses((prev) => ({ ...prev, [task.id]: prevStatus }));
      return setToast(res.error || "상태 변경 실패");
    }
    if (isBacklog) {
      setBacklogItems((prev) => prev.map((i) => (i.id === res.item.id ? res.item : i)));
    } else {
      setTaskUpdates((prev) => [res.item, ...prev.filter((i) => i.taskId !== res.item.taskId)]);
    }
  }

  async function saveBoardModal(event) {
    event.preventDefault();
    if (!itemModal) return;
    const isBacklog = itemModal.source === "backlog";
    const payload = isBacklog
      ? {
          id: itemModal.id,
          title: itemModal.title,
          description: itemModal.description,
          type: itemModal.type,
          status: itemModal.status,
          priority: itemModal.priority,
          tags: itemModal.tagsText !== undefined ? itemModal.tagsText : (itemModal.tags || []),
          due: itemModal.due || null,
        }
      : { taskId: itemModal.id, status: itemModal.status, note: itemModal.note || "" };
    const res = await mutate(isBacklog ? "/api/backlog-items" : "/api/task-updates", isBacklog ? "PATCH" : "POST", payload, session);
    if (!res.ok) return setToast(res.error || "저장 실패");
    if (isBacklog) {
      setBacklogItems((prev) => prev.map((i) => (i.id === res.item.id ? res.item : i)));
    } else {
      setTaskUpdates((prev) => [res.item, ...prev.filter((i) => i.taskId !== res.item.taskId)]);
      setTaskNotes((prev) => ({ ...prev, [itemModal.id]: "" }));
    }
    setTaskStatuses((prev) => ({ ...prev, [itemModal.id]: res.item.status }));
    setItemModal(null);
    setToast("작업을 저장했습니다.");
  }

  async function deleteTask(item) {
    if (item.source === "backlog") {
      const res = await mutate("/api/backlog-items", "DELETE", { id: item.id }, session);
      if (!res.ok) return setToast(res.error || "삭제 실패");
      setBacklogItems((prev) => prev.filter((c) => c.id !== item.id));
    } else {
      const res = await mutate("/api/task-updates", "DELETE", { taskId: item.id, reason: "Removed from board" }, session);
      if (!res.ok) return setToast(res.error || "제외 실패");
      setContentOverrides((prev) => [res.item, ...prev]);
    }
    setItemModal(null);
    setToast("항목을 제거했습니다.");
  }

  async function promoteTaskToDocs(item) {
    const res = await mutate(
      "/api/wiki-pages",
      "POST",
      {
        projectId: project.id,
        space: item.type === "research" ? "experiment" : "archive",
        title: item.title,
        content: item.description || `## ${item.title}\n\nKanban 작업에서 문서화됨.`,
        status: "published",
        tags: Array.isArray(item.tags) ? item.tags.join(",") : "",
      },
      session,
    );
    if (!res.ok) return setToast(res.error || "Docs 승격 실패");
    setWikiPages((prev) => [res.item, ...prev]);
    setItemModal(null);
    setSelectedDocId(res.item.id);
    setToast(`Docs로 문서화했습니다: ${res.item.title}`);
    navigateWorkspace("docs");
  }

  // ---- Roadmap & Decision CRUD ----
  async function saveRoadmapItem(event) {
    event.preventDefault();
    const isTpl = roadmapForm.source === "seed";
    const isEdit = Boolean(roadmapForm.id) && !isTpl;
    const payload = { ...roadmapForm, projectId: project.id };
    const res = isTpl
      ? await mutate("/api/static-content/promote", "POST", { projectId: project.id, targetType: "roadmap", targetId: roadmapForm.templateId || roadmapForm.id, item: payload }, session)
      : await mutate("/api/roadmap-items", isEdit ? "PATCH" : "POST", payload, session);
    if (!res.ok) return setToast(res.error || "로드맵 저장 실패");
    setRoadmapItems((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)]);
    if (res.override) setContentOverrides((prev) => [res.override, ...prev]);
    setRoadmapModalOpen(false);
    setToast("로드맵을 저장했습니다.");
  }

  async function deleteRoadmapItem(item) {
    if (item.source === "seed") {
      const res = await mutate("/api/content-overrides", "POST", { projectId: project.id, targetType: "roadmap", targetId: item.id, reason: "Hidden template" }, session);
      if (res.ok) setContentOverrides((prev) => [res.item, ...prev]);
      return;
    }
    const res = await mutate("/api/roadmap-items", "DELETE", { id: item.id }, session);
    if (res.ok) setRoadmapItems((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function saveDecisionRecord(event) {
    event.preventDefault();
    const isTpl = decisionForm.source === "seed";
    const isEdit = Boolean(decisionForm.id) && !isTpl;
    const payload = { ...decisionForm, projectId: project.id };
    const res = isTpl
      ? await mutate("/api/static-content/promote", "POST", { projectId: project.id, targetType: "decision", targetId: decisionForm.templateId || decisionForm.id, item: payload }, session)
      : await mutate("/api/decision-records", isEdit ? "PATCH" : "POST", payload, session);
    if (!res.ok) return setToast(res.error || "의사결정 저장 실패");
    setDecisionRecords((prev) => [res.item, ...prev.filter((i) => i.id !== res.item.id)]);
    if (res.override) setContentOverrides((prev) => [res.override, ...prev]);
    setDecisionModalOpen(false);
    setToast("의사결정을 기록했습니다.");
  }

  async function deleteDecisionRecord(item) {
    if (item.source === "seed") {
      const res = await mutate("/api/content-overrides", "POST", { projectId: project.id, targetType: "decision", targetId: item.id, reason: "Hidden template" }, session);
      if (res.ok) setContentOverrides((prev) => [res.item, ...prev]);
      return;
    }
    const res = await mutate("/api/decision-records", "DELETE", { id: item.id }, session);
    if (res.ok) setDecisionRecords((prev) => prev.filter((i) => i.id !== item.id));
  }

  async function handleReviewAction(action, reviewId) {
    const res = await mutate("/api/review-queue", "POST", { action, reviewId, note: reviewNotes[reviewId] || "" }, session);
    if (!res.ok) return setToast(res.error || "검수 처리 실패");
    setReviewPayload((cur) => ({ ...cur, items: cur.items.map((i) => (i.id === res.item.id ? res.item : i)) }));
    setToast("검수 상태를 업데이트했습니다.");
  }

  // ---- Command Palette Cross-Tab Search ----
  const cmdResults = useMemo(() => {
    const q = cmdQuery.trim().toLowerCase();
    const results = [];
    for (const tab of WORKSPACE_TABS) {
      if (!q || tab.label.toLowerCase().includes(q) || tab.desc.toLowerCase().includes(q)) {
        results.push({ type: "Tab", title: tab.label, sub: tab.desc, action: () => navigateWorkspace(tab.id) });
      }
    }
    if (q) {
      for (const n of agileNotes.filter((x) => x.body.toLowerCase().includes(q)).slice(0, 4)) {
        results.push({ type: "Agile", title: n.body.slice(0, 64), sub: n.authorName, action: () => navigateWorkspace("agile") });
      }
      for (const t of tasks.filter((x) => x.title.toLowerCase().includes(q)).slice(0, 4)) {
        results.push({
          type: "Kanban",
          title: t.title,
          sub: getStatusLabel(taskStatuses[t.id] || t.status),
          action: () => {
            navigateWorkspace("kanban");
            setItemModal({ ...t, status: taskStatuses[t.id] || t.status, tagsText: (t.tags || []).join(", "), note: "" });
          },
        });
      }
      for (const p of wikiPages.filter((x) => `${x.title} ${x.content}`.toLowerCase().includes(q)).slice(0, 4)) {
        results.push({
          type: "Docs",
          title: p.title,
          sub: p.space,
          action: () => {
            setSelectedDocId(p.id);
            navigateWorkspace("docs");
          },
        });
      }
    }
    return results.slice(0, 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agileNotes, cmdQuery, taskStatuses, tasks, wikiPages]);

  const activeTabMeta = WORKSPACE_TABS.find((t) => t.id === activeTab) || WORKSPACE_TABS[0];

  return (
    <div className="v2-app-shell">
      {/* Unified Left Product Rail */}
      <aside className="v2-rail">
        <button type="button" className="v2-cmd-trigger" onClick={() => setCmdOpen(true)}>
          <Search size={13} aria-hidden="true" />
          <span>Quick Search…</span>
          <kbd className="mono">⌘K</kbd>
        </button>

        <div className="v2-rail-section">
          <div className="v2-rail-head">
            <span>PROJECT</span>
            {canEdit && (
              <button type="button" className="v2-rail-add" title="새 프로젝트" onClick={() => setProjectModalOpen(true)}>
                <FolderPlus size={13} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="v2-project-list">
            {projects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`v2-project-btn${item.id === project.id ? " active" : ""}`}
                onClick={() => navigateWorkspace(activeTab, item.id)}
              >
                <span className="v2-project-dot" />
                <span className="v2-project-label">{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        <nav className="v2-rail-section" aria-label="Workspace tabs">
          <div className="v2-rail-head">
            <span>WORKSPACE</span>
          </div>
          <div className="v2-nav-list">
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              const badge =
                tab.id === "agile"
                  ? agileNotes.length
                  : tab.id === "kanban"
                    ? tasks.length
                    : tab.id === "docs"
                      ? wikiPages.length + archiveItems.length
                      : tab.id === "benchmark"
                        ? (initialBenchmark?.leaderboard || []).length
                        : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`v2-nav-item${activeTab === tab.id ? " active" : ""}`}
                  onClick={() => navigateWorkspace(tab.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  <span>{tab.label}</span>
                  {badge !== null && badge > 0 && <span className="v2-nav-badge mono">{badge}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="v2-rail-footer">
          <div className="v2-rail-links">
            <Link href={`/projects/${project.id}`}>Project Brief</Link>
            <Link href="/governance">Governance</Link>
            <Link href="/admin/audit">Audit</Link>
          </div>
        </div>
      </aside>

      {/* Main Unified Workspace Canvas */}
      <main className="v2-canvas">
        <header className="v2-canvas-header">
          <div>
            <div className="v2-canvas-crumb">
              <span>{project.title}</span>
              <span>/</span>
              <strong>{activeTabMeta.label}</strong>
            </div>
            <h1 className="v2-canvas-title">{activeTab === "overview" ? project.title : activeTabMeta.label}</h1>
            <p className="v2-canvas-sub">{activeTab === "overview" ? project.summary : activeTabMeta.desc}</p>
          </div>
          <div className="v2-canvas-actions">
            {canEdit && activeTab === "overview" && (
              <>
                <button type="button" className="v2-btn-ghost" onClick={() => navigateWorkspace("agile")}>
                  <Zap size={13} aria-hidden="true" />
                  <span>Agile 메모</span>
                </button>
                <button type="button" className="v2-btn-primary compact" onClick={() => navigateWorkspace("docs")}>
                  <FileText size={13} aria-hidden="true" />
                  <span>새 Docs</span>
                </button>
              </>
            )}
          </div>
        </header>

        {toast && (
          <div className="v2-toast" role="status">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast("")} aria-label="닫기">×</button>
          </div>
        )}

        {activeTab === "overview" && (
          <OverviewTab
            agileNotes={agileNotes}
            benchmarkTop3={benchmarkTop3}
            canAdmin={canAdmin}
            canEdit={canEdit}
            data={data}
            decisionRecords={decisionRecords}
            deleteDecisionRecord={deleteDecisionRecord}
            deleteRoadmapItem={deleteRoadmapItem}
            hiddenDecisionIds={hiddenDecisionIds}
            hiddenRoadmapIds={hiddenRoadmapIds}
            navigateWorkspace={navigateWorkspace}
            progress={progress}
            project={project}
            roadmapItems={roadmapItems}
            setDecisionForm={setDecisionForm}
            setDecisionModalOpen={setDecisionModalOpen}
            setRoadmapForm={setRoadmapForm}
            setRoadmapModalOpen={setRoadmapModalOpen}
            taskStatuses={taskStatuses}
            tasks={tasks}
            wikiCount={wikiPages.length + archiveItems.length}
          />
        )}

        {activeTab === "agile" && (
          <AgilePanel
            canEdit={canEdit}
            notes={agileNotes}
            onCreateNote={createAgileNote}
            onDeleteNote={deleteAgileNote}
            onPromoteToDocs={promoteAgileToDocs}
            onPromoteToKanban={promoteAgileToKanban}
            onTogglePin={toggleAgilePin}
            onToggleResolve={toggleAgileResolve}
          />
        )}

        {activeTab === "kanban" && (
          <KanbanTab
            backlogForm={backlogForm}
            canEdit={canEdit}
            createBacklogItem={createBacklogItem}
            data={data}
            projectId={project.id}
            quickCreateBacklogItem={quickCreateBacklogItem}
            quickMoveTask={quickMoveTask}
            setBacklogForm={setBacklogForm}
            setItemModal={setItemModal}
            taskStatuses={taskStatuses}
            tasks={tasks}
          />
        )}

        {activeTab === "docs" && (
          <DocsWikiPanel
            archiveItems={archiveItems}
            canEdit={canEdit}
            initialSelectedId={selectedDocId}
            onDeletePage={deleteWikiPage}
            onSavePage={saveWikiPage}
            pages={wikiPages}
            projectId={project.id}
          />
        )}

        {activeTab === "benchmark" && (
          <BenchmarkViewer initialData={initialBenchmark} embedded />
        )}

        {activeTab === "review" && (
          <ReviewTab
            canReview={canReview}
            items={(reviewPayload.items || []).filter((i) => i.target === project.id || i.sourceType === "static")}
            onAction={handleReviewAction}
            reviewNotes={reviewNotes}
            setReviewNotes={setReviewNotes}
          />
        )}
      </main>

      {/* Kanban Slide-Over Detail Drawer */}
      {itemModal && (
        <KanbanDetailDrawer
          canDelete={itemModal.source === "backlog" || (itemModal.source === "seed" && canAdmin)}
          canEdit={canEdit}
          data={data}
          deleteTask={deleteTask}
          item={itemModal}
          promoteTaskToDocs={promoteTaskToDocs}
          saveBoardModal={saveBoardModal}
          setItemModal={setItemModal}
          setTaskNotes={setTaskNotes}
          taskNotes={taskNotes}
        />
      )}

      {/* Roadmap Modal */}
      {roadmapModalOpen && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setRoadmapModalOpen(false); }}>
          <aside className="v2-drawer" role="dialog" aria-modal="true" aria-label="로드맵 편집">
            <header className="v2-drawer-head">
              <div>
                <span className="v2-eyebrow">ROADMAP</span>
                <h2>{roadmapForm.id ? "로드맵 수정" : "로드맵 추가"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setRoadmapModalOpen(false)} aria-label="닫기"><X size={16} /></button>
            </header>
            <form className="v2-drawer-body workspace-form" onSubmit={saveRoadmapItem}>
              <label><span>제목</span><input value={roadmapForm.title} onChange={(e) => setRoadmapForm((p) => ({ ...p, title: e.target.value, projectId: project.id }))} required /></label>
              <div className="modal-grid">
                <label><span>기간</span><input value={roadmapForm.timeframe} onChange={(e) => setRoadmapForm((p) => ({ ...p, timeframe: e.target.value, projectId: project.id }))} placeholder="Week 4 / 11월 3주" /></label>
                <label><span>상태</span><select value={roadmapForm.status} onChange={(e) => setRoadmapForm((p) => ({ ...p, status: e.target.value, projectId: project.id }))}>{ROADMAP_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
              </div>
              <label><span>핵심 산출물 요약</span><textarea rows={4} value={roadmapForm.summary} onChange={(e) => setRoadmapForm((p) => ({ ...p, summary: e.target.value, projectId: project.id }))} /></label>
              <div className="v2-drawer-actions">
                <button type="button" className="v2-btn-ghost" onClick={() => setRoadmapModalOpen(false)}>취소</button>
                <button type="submit" className="v2-btn-primary compact">저장</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* Decision Modal */}
      {decisionModalOpen && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setDecisionModalOpen(false); }}>
          <aside className="v2-drawer" role="dialog" aria-modal="true" aria-label="의사결정 기록">
            <header className="v2-drawer-head">
              <div>
                <span className="v2-eyebrow">DECISION LOG</span>
                <h2>{decisionForm.id ? "의사결정 수정" : "의사결정 기록"}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setDecisionModalOpen(false)} aria-label="닫기"><X size={16} /></button>
            </header>
            <form className="v2-drawer-body workspace-form" onSubmit={saveDecisionRecord}>
              <label><span>제목</span><input value={decisionForm.title} onChange={(e) => setDecisionForm((p) => ({ ...p, title: e.target.value, projectId: project.id }))} required /></label>
              <div className="modal-grid">
                <label><span>상태</span><select value={decisionForm.status} onChange={(e) => setDecisionForm((p) => ({ ...p, status: e.target.value, projectId: project.id }))}>{DECISION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></label>
                <label><span>결정일</span><input type="date" value={decisionForm.decidedAt || ""} onChange={(e) => setDecisionForm((p) => ({ ...p, decidedAt: e.target.value, projectId: project.id }))} /></label>
              </div>
              <label><span>배경</span><textarea rows={3} value={decisionForm.context} onChange={(e) => setDecisionForm((p) => ({ ...p, context: e.target.value, projectId: project.id }))} /></label>
              <label><span>결정 내용</span><textarea rows={4} value={decisionForm.decision} onChange={(e) => setDecisionForm((p) => ({ ...p, decision: e.target.value, projectId: project.id }))} required /></label>
              <label><span>영향 / 후속 조치</span><textarea rows={3} value={decisionForm.impact} onChange={(e) => setDecisionForm((p) => ({ ...p, impact: e.target.value, projectId: project.id }))} /></label>
              <div className="v2-drawer-actions">
                <button type="button" className="v2-btn-ghost" onClick={() => setDecisionModalOpen(false)}>취소</button>
                <button type="submit" className="v2-btn-primary compact">저장</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* New Project Modal */}
      {projectModalOpen && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setProjectModalOpen(false); }}>
          <aside className="v2-drawer" role="dialog" aria-modal="true" aria-label="새 프로젝트 생성">
            <header className="v2-drawer-head">
              <div>
                <span className="v2-eyebrow">NEW PROJECT</span>
                <h2>새 프로젝트 등록</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setProjectModalOpen(false)} aria-label="닫기"><X size={16} /></button>
            </header>
            <form className="v2-drawer-body workspace-form" onSubmit={createProject}>
              <label><span>프로젝트 제목</span><input value={projectForm.title} onChange={(e) => setProjectForm((p) => ({ ...p, title: e.target.value }))} required /></label>
              <label><span>GitHub Repository URL</span><input value={projectForm.repositoryUrl} onChange={(e) => setProjectForm((p) => ({ ...p, repositoryUrl: e.target.value }))} placeholder="https://github.com/team-ASP/..." /></label>
              <label><span>요약</span><textarea rows={4} value={projectForm.summary} onChange={(e) => setProjectForm((p) => ({ ...p, summary: e.target.value }))} required /></label>
              <div className="v2-drawer-actions">
                <button type="button" className="v2-btn-ghost" onClick={() => setProjectModalOpen(false)}>취소</button>
                <button type="submit" className="v2-btn-primary compact">생성</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {/* Global Command Palette (Cmd+K) */}
      {cmdOpen && (
        <div className="v2-cmd-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setCmdOpen(false); }}>
          <div className="v2-cmd-modal" role="dialog" aria-modal="true" aria-label="통합 검색">
            <div className="v2-cmd-input-row">
              <Command size={15} aria-hidden="true" />
              <input
                autoFocus
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder="탭 이동 · Agile 메모 · Kanban 작업 · Docs 문서 통합 검색…"
              />
              <kbd className="mono">ESC</kbd>
            </div>
            <div className="v2-cmd-list">
              {cmdResults.map((res, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="v2-cmd-item"
                  onClick={() => {
                    res.action();
                    setCmdOpen(false);
                    setCmdQuery("");
                  }}
                >
                  <span className="v2-tag">{res.type}</span>
                  <strong>{res.title}</strong>
                  <span className="v2-cmd-sub">{res.sub}</span>
                </button>
              ))}
              {cmdResults.length === 0 && <p className="v2-muted" style={{ padding: "16px" }}>검색 결과가 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewTab({
  agileNotes,
  benchmarkTop3,
  canAdmin,
  canEdit,
  data,
  decisionRecords,
  deleteDecisionRecord,
  deleteRoadmapItem,
  hiddenDecisionIds,
  hiddenRoadmapIds,
  navigateWorkspace,
  progress,
  project,
  roadmapItems,
  setDecisionForm,
  setDecisionModalOpen,
  setRoadmapForm,
  setRoadmapModalOpen,
  taskStatuses,
  tasks,
  wikiCount,
}) {
  const counts = useMemo(() => {
    const map = { todo: 0, "in-progress": 0, "ready-for-review": 0, done: 0 };
    for (const t of tasks) {
      const st = taskStatuses[t.id] || t.status;
      const col = BOARD_COLUMNS.find((c) => c.statuses.includes(st))?.id || "todo";
      map[col] += 1;
    }
    return map;
  }, [taskStatuses, tasks]);

  const seedRoadmap = (project.milestones || [])
    .filter((m) => !hiddenRoadmapIds.has(m.id))
    .map((m) => ({ id: m.id, projectId: project.id, title: m.title, timeframe: `Week ${m.week}`, status: m.status || "planned", summary: m.deliverables?.join(" · ") || "", source: "seed" }));
  const roadmap = [...seedRoadmap, ...roadmapItems];

  const seedDecisions = data.logs
    .filter((l) => l.projectId === project.id && l.type === "decision" && !hiddenDecisionIds.has(l.id))
    .map((l) => ({ id: l.id, projectId: project.id, title: l.title, status: "accepted", context: "", decision: l.summary, impact: "", decidedAt: l.date, source: "seed" }));
  const decisions = [...decisionRecords, ...seedDecisions];

  const topBench = benchmarkTop3[0];

  return (
    <div className="v2-overview-stack">
      {/* 4 Executive KPI Cards */}
      <section className="v2-kpi-grid">
        <button type="button" className="v2-kpi-card" onClick={() => navigateWorkspace("kanban")}>
          <span>Kanban Progress</span>
          <strong className="mono">{progress}%</strong>
          <small>{counts.done} done · {counts["in-progress"]} active · {counts.todo} todo</small>
        </button>
        <button type="button" className="v2-kpi-card" onClick={() => navigateWorkspace("agile")}>
          <span>Agile Stream</span>
          <strong className="mono">{agileNotes.length}</strong>
          <small>{agileNotes.filter((n) => n.kind === "blocker" && !n.resolved).length} open blockers · 빠른 기록</small>
        </button>
        <button type="button" className="v2-kpi-card" onClick={() => navigateWorkspace("docs")}>
          <span>Docs &amp; Wiki</span>
          <strong className="mono">{wikiCount}</strong>
          <small>팀 설계 문서 · 회의록 · 아카이브</small>
        </button>
        <button type="button" className="v2-kpi-card" onClick={() => navigateWorkspace("benchmark")}>
          <span>Benchmark Leader</span>
          <strong className="mono">{topBench ? `${topBench.score_mean} pts` : "-"}</strong>
          <small>{topBench ? `${topBench.model_raw} (${topBench.setting_label || "default"})` : "6D 리더보드 보기"}</small>
        </button>
      </section>

      {/* Live Pulse Grid: Agile + Kanban Distribution + Benchmark Top 3 */}
      <section className="v2-overview-row-3">
        <article className="v2-card-panel">
          <div className="v2-panel-head">
            <div>
              <span className="v2-eyebrow">AGILE PULSE</span>
              <h3>최근 빠른 메모</h3>
            </div>
            <button type="button" className="v2-link-btn" onClick={() => navigateWorkspace("agile")}>전체 보기 →</button>
          </div>
          <div className="v2-mini-list">
            {agileNotes.slice(0, 4).map((note) => (
              <div key={note.id} className="v2-mini-row">
                <span className={`v2-kind-badge kind-${note.kind}`}>{note.kind}</span>
                <p>{note.body.slice(0, 90)}</p>
                <span className="v2-muted mono">{note.authorName || note.authorLogin}</span>
              </div>
            ))}
            {agileNotes.length === 0 && <p className="v2-muted">Agile 탭에서 첫 스탠드업이나 회의 메모를 남겨보세요.</p>}
          </div>
        </article>

        <article className="v2-card-panel">
          <div className="v2-panel-head">
            <div>
              <span className="v2-eyebrow">BENCHMARK 6D</span>
              <h3>Top 3 에이전트 설정</h3>
            </div>
            <button type="button" className="v2-link-btn" onClick={() => navigateWorkspace("benchmark")}>대시보드 →</button>
          </div>
          <div className="v2-mini-list">
            {benchmarkTop3.map((entry, idx) => (
              <div key={entry.id} className="v2-mini-row">
                <span className="mono v2-rank-mini">#{idx + 1}</span>
                <p><strong>{entry.archetype_name}</strong> · <span className="mono">{entry.model_raw}</span></p>
                <strong className="mono">{entry.score_mean}</strong>
              </div>
            ))}
            {benchmarkTop3.length === 0 && <p className="v2-muted">동기화된 벤치마크 결과가 없습니다.</p>}
          </div>
        </article>
      </section>

      {/* Roadmap & Decisions */}
      <section className="v2-overview-row-2">
        <article className="v2-card-panel">
          <div className="v2-panel-head">
            <div>
              <span className="v2-eyebrow">ROADMAP</span>
              <h3>마일스톤 흐름</h3>
            </div>
            {canEdit && (
              <button
                type="button"
                className="v2-btn-ghost"
                onClick={() => {
                  setRoadmapForm(emptyRoadmapItem(project.id));
                  setRoadmapModalOpen(true);
                }}
              >
                <Plus size={13} aria-hidden="true" />
                <span>추가</span>
              </button>
            )}
          </div>
          <div className="v2-roadmap-list">
            {roadmap.map((item, idx) => (
              <div key={`${item.source}-${item.id}`} className="v2-roadmap-row">
                <span className="v2-roadmap-idx mono">{String(idx + 1).padStart(2, "0")}</span>
                <div className="v2-roadmap-body">
                  <div className="v2-card-top">
                    <span className="v2-tag">{item.timeframe || "TBD"}</span>
                    <span className="v2-tag accent">{getStatusLabel(item.status)}</span>
                  </div>
                  <strong>{item.title}</strong>
                  {item.summary && <p>{item.summary}</p>}
                  {(canEdit && item.source !== "seed") || (canAdmin && item.source === "seed") ? (
                    <div className="v2-inline-actions">
                      <button type="button" onClick={() => { setRoadmapForm({ ...item, templateId: item.source === "seed" ? item.id : "" }); setRoadmapModalOpen(true); }}>수정</button>
                      <button type="button" onClick={() => deleteRoadmapItem(item)}>삭제</button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {roadmap.length === 0 && <p className="v2-muted">등록된 로드맵이 없습니다.</p>}
          </div>
        </article>

        <article className="v2-card-panel">
          <div className="v2-panel-head">
            <div>
              <span className="v2-eyebrow">DECISIONS</span>
              <h3>의사결정 로그</h3>
            </div>
            {canEdit && (
              <button
                type="button"
                className="v2-btn-ghost"
                onClick={() => {
                  setDecisionForm(emptyDecisionRecord(project.id));
                  setDecisionModalOpen(true);
                }}
              >
                <Plus size={13} aria-hidden="true" />
                <span>기록</span>
              </button>
            )}
          </div>
          <div className="v2-decision-list">
            {decisions.map((item) => (
              <div key={`${item.source}-${item.id}`} className="v2-decision-row">
                <div className="v2-card-top">
                  <span className="v2-tag accent">{getStatusLabel(item.status)}</span>
                  <span className="v2-muted mono">{formatDate(item.decidedAt || item.updatedAt)}</span>
                </div>
                <strong>{item.title}</strong>
                <p>{item.decision}</p>
                {(canEdit && item.source !== "seed") || (canAdmin && item.source === "seed") ? (
                  <div className="v2-inline-actions">
                    <button type="button" onClick={() => { setDecisionForm({ ...item, templateId: item.source === "seed" ? item.id : "" }); setDecisionModalOpen(true); }}>수정</button>
                    <button type="button" onClick={() => deleteDecisionRecord(item)}>삭제</button>
                  </div>
                ) : null}
              </div>
            ))}
            {decisions.length === 0 && <p className="v2-muted">기록된 의사결정이 없습니다.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}

function KanbanTab({
  backlogForm,
  canEdit,
  createBacklogItem,
  data,
  projectId,
  quickCreateBacklogItem,
  quickMoveTask,
  setBacklogForm,
  setItemModal,
  taskStatuses,
  tasks,
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(false);
  const [quickTitles, setQuickTitles] = useState({});

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (typeFilter !== "all" && (t.type || "task") !== typeFilter) return false;
      if (priorityFilter !== "all" && (t.priority || "medium") !== priorityFilter) return false;
      if (!q) return true;
      return `${t.title} ${t.description || ""} ${(t.tags || []).join(" ")}`.toLowerCase().includes(q);
    });
  }, [priorityFilter, search, tasks, typeFilter]);

  async function onQuickAdd(event, colId) {
    event.preventDefault();
    const ok = await quickCreateBacklogItem(colId, quickTitles[colId] || "");
    if (ok) setQuickTitles((prev) => ({ ...prev, [colId]: "" }));
  }

  return (
    <div className="v2-board-stack">
      <section className="v2-board-toolbar">
        <div className="v2-board-filters">
          <input type="search" className="compact-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="작업 · 태그 검색…" aria-label="칸반 검색" />
          <select className="compact-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="유형">
            <option value="all">모든 유형</option>
            {ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="compact-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="우선순위">
            <option value="all">모든 우선순위</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <span className="v2-muted mono">{filtered.length} / {tasks.length}</span>
        </div>
        {canEdit && (
          <button type="button" className="v2-btn-primary compact" onClick={() => setShowComposer((v) => !v)}>
            <Plus size={14} aria-hidden="true" />
            <span>{showComposer ? "닫기" : "상세 카드 생성"}</span>
          </button>
        )}
      </section>

      {canEdit && showComposer && (
        <section className="v2-card-panel">
          <form
            className="backlog-create-form"
            onSubmit={async (e) => {
              await createBacklogItem(e);
              setShowComposer(false);
            }}
          >
            <input value={backlogForm.title} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, title: e.target.value }))} placeholder="작업 제목" required />
            <div className="v2-meta-row-4">
              <select value={backlogForm.type} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, type: e.target.value }))}>{ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
              <select value={backlogForm.priority} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, priority: e.target.value }))}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
              <input type="date" value={backlogForm.due} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, due: e.target.value }))} />
              <input value={backlogForm.tags || ""} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, tags: e.target.value }))} placeholder="태그 (쉼표 구분)" />
            </div>
            <textarea rows={4} value={backlogForm.description} onChange={(e) => setBacklogForm((p) => ({ ...p, projectId, description: e.target.value }))} placeholder={"## 완료 조건\n- [ ] 항목 1"} />
            <div className="v2-drawer-actions">
              <button type="button" className="v2-btn-ghost" onClick={() => setShowComposer(false)}>취소</button>
              <button type="submit" className="v2-btn-primary compact">카드 추가</button>
            </div>
          </form>
        </section>
      )}

      <div className="v2-kanban-grid">
        {BOARD_COLUMNS.map((col) => {
          const colTasks = filtered.filter((t) => col.statuses.includes(taskStatuses[t.id] || t.status));
          return (
            <article key={col.id} className="v2-kanban-col">
              <header className="v2-kanban-col-head">
                <div>
                  <h3>{col.title}</h3>
                  <p>{col.description}</p>
                </div>
                <span className="v2-col-count mono">{colTasks.length}</span>
              </header>
              <div className="v2-kanban-cards">
                {colTasks.map((task) => {
                  const chk = countChecklist(task.description);
                  const snippet = stripMarkdownSnippet(task.description, 84);
                  const curStatus = taskStatuses[task.id] || task.status;
                  const tags = Array.isArray(task.tags) ? task.tags : [];
                  return (
                    <div
                      key={task.id}
                      className="v2-agile-card"
                      role="button"
                      tabIndex={0}
                      onClick={() => setItemModal({ ...task, status: curStatus, tagsText: tags.join(", "), note: "" })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setItemModal({ ...task, status: curStatus, tagsText: tags.join(", "), note: "" });
                        }
                      }}
                    >
                      <div className="v2-card-top">
                        <span className={`v2-priority-dot ${task.priority || "medium"}`} />
                        <span className="v2-tag">{task.type || "task"}</span>
                        {tags.slice(0, 2).map((tag) => <span key={tag} className="v2-tag accent">#{tag}</span>)}
                      </div>
                      <strong className="v2-card-title">{task.title}</strong>
                      {snippet && <p className="v2-card-snippet">{snippet}</p>}
                      <div className="v2-card-foot" onClick={(e) => e.stopPropagation()}>
                        <span className="v2-card-meta">
                          {task.source === "backlog" ? task.ownerLogin : memberName(data, task.ownerId)} · {formatDate(task.due)}
                          {chk.total > 0 && <span className="v2-checklist-badge mono"> · {chk.checked}/{chk.total}</span>}
                        </span>
                        {canEdit && (
                          <select className="v2-status-select" value={curStatus} aria-label={`${task.title} 상태`} onChange={(e) => quickMoveTask(task, e.target.value)}>
                            {BOARD_COLUMNS.map((opt) => <option key={opt.id} value={opt.id}>{opt.title}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
                {colTasks.length === 0 && <p className="v2-muted" style={{ fontSize: "0.78rem", padding: "6px 2px" }}>항목 없음</p>}
              </div>
              {canEdit && (
                <form className="v2-quick-add" onSubmit={(e) => onQuickAdd(e, col.id)}>
                  <input
                    value={quickTitles[col.id] || ""}
                    onChange={(e) => setQuickTitles((prev) => ({ ...prev, [col.id]: e.target.value }))}
                    placeholder={`+ ${col.title} 빠른 추가 (Enter)`}
                    aria-label={`${col.title} 빠른 추가`}
                  />
                </form>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function KanbanDetailDrawer({ canDelete, canEdit, data, deleteTask, item, promoteTaskToDocs, saveBoardModal, setItemModal, setTaskNotes, taskNotes }) {
  const isBacklog = item.source === "backlog";
  const [editorMode, setEditorMode] = useState(isBacklog && canEdit ? "split" : "preview");

  function toggleChecklist(lineIndex) {
    if (!isBacklog || !canEdit) return;
    const lines = String(item.description || "").replace(/\r\n/g, "\n").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    lines[lineIndex] = lines[lineIndex].replace(/^(\s*[-*]\s+\[)([ xX])(\]\s+)/, (_, a, m, b) => `${a}${m.toLowerCase() === "x" ? " " : "x"}${b}`);
    setItemModal((cur) => ({ ...cur, description: lines.join("\n") }));
  }

  return (
    <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setItemModal(null); }}>
      <aside className="v2-drawer wide" role="dialog" aria-modal="true" aria-label="Kanban 작업 상세">
        <header className="v2-drawer-head">
          <div>
            <span className="v2-eyebrow">{isBacklog ? "KANBAN CARD" : "TEMPLATE TASK"}</span>
            <h2>{item.title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={() => setItemModal(null)} aria-label="닫기"><X size={16} /></button>
        </header>
        <form className="v2-drawer-body workspace-form" onSubmit={saveBoardModal}>
          {isBacklog ? (
            <>
              <label><span>제목</span><input value={item.title} readOnly={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, title: e.target.value }))} required /></label>
              <div className="v2-meta-row-4">
                <label><span>상태</span><select value={item.status} disabled={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, status: e.target.value }))}>{BOARD_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}</select></label>
                <label><span>유형</span><select value={item.type} disabled={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, type: e.target.value }))}>{ITEM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
                <label><span>우선순위</span><select value={item.priority} disabled={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, priority: e.target.value }))}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
                <label><span>기한</span><input type="date" disabled={!canEdit} value={item.due ? String(item.due).slice(0, 10) : ""} onChange={(e) => setItemModal((c) => ({ ...c, due: e.target.value }))} /></label>
              </div>
              <label><span>태그</span><input value={item.tagsText ?? ""} readOnly={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, tagsText: e.target.value }))} placeholder="쉼표 구분" /></label>
              <div className="v2-doc-head">
                <span>상세 Markdown 문서 (표 · 체크리스트)</span>
                {canEdit && (
                  <div className="segmented-control">
                    <button type="button" className={editorMode === "write" ? "active" : ""} onClick={() => setEditorMode("write")}>Write</button>
                    <button type="button" className={editorMode === "split" ? "active" : ""} onClick={() => setEditorMode("split")}>Split</button>
                    <button type="button" className={editorMode === "preview" ? "active" : ""} onClick={() => setEditorMode("preview")}>Preview</button>
                  </div>
                )}
              </div>
              <div className={`v2-md-workbench mode-${editorMode}`}>
                {canEdit && editorMode !== "preview" && (
                  <textarea className="v2-md-textarea mono" rows={12} value={item.description || ""} onChange={(e) => setItemModal((c) => ({ ...c, description: e.target.value }))} />
                )}
                {editorMode !== "write" && (
                  <div className="v2-md-reader">
                    {item.description ? <MarkdownRenderer value={item.description} onToggleChecklist={canEdit ? toggleChecklist : null} /> : <p className="v2-muted">상세 설명이 없습니다.</p>}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {item.description && <div className="v2-md-reader"><MarkdownRenderer value={item.description} /></div>}
              <label><span>상태</span><select value={item.status} disabled={!canEdit} onChange={(e) => setItemModal((c) => ({ ...c, status: e.target.value }))}>{BOARD_COLUMNS.map((col) => <option key={col.id} value={col.id}>{col.title}</option>)}</select></label>
              <label><span>변경 메모</span><input value={taskNotes[item.id] || item.note || ""} readOnly={!canEdit} onChange={(e) => { setTaskNotes((p) => ({ ...p, [item.id]: e.target.value })); setItemModal((c) => ({ ...c, note: e.target.value })); }} placeholder={`${memberName(data, item.ownerId)}에게 공유할 변경 맥락`} /></label>
            </>
          )}
          <div className="v2-drawer-actions">
            <div className="v2-drawer-actions-left">
              {canDelete && (
                <button type="button" className="v2-btn-danger" onClick={() => deleteTask(item)}>
                  <Trash2 size={13} aria-hidden="true" />
                  <span>삭제</span>
                </button>
              )}
              {canEdit && (
                <button type="button" className="v2-btn-ghost" onClick={() => promoteTaskToDocs(item)}>
                  <BookOpen size={13} aria-hidden="true" />
                  <span>Docs로 문서화</span>
                </button>
              )}
            </div>
            {canEdit && <button type="submit" className="v2-btn-primary compact">저장</button>}
          </div>
        </form>
      </aside>
    </div>
  );
}

function ReviewTab({ canReview, items, onAction, reviewNotes, setReviewNotes }) {
  return (
    <section className="v2-card-panel">
      <div className="v2-panel-head">
        <div>
          <span className="v2-eyebrow">GOVERNANCE &amp; REVIEW</span>
          <h3>검수 대기 큐</h3>
        </div>
        <Link href="/admin/audit" className="v2-link-btn">Audit Log →</Link>
      </div>
      <div className="v2-review-list">
        {items.map((item) => (
          <article key={item.id} className="v2-review-row">
            <ShieldCheck size={16} aria-hidden="true" />
            <div className="v2-review-body">
              <strong>{item.title}</strong>
              <span className="v2-muted">{item.type || item.sourceType} · {getStatusLabel(item.status)}</span>
              {item.reviewNote && <p>{item.reviewNote}</p>}
              {canReview && item.sourceType !== "static" && (
                <input value={reviewNotes[item.id] || ""} onChange={(e) => setReviewNotes((p) => ({ ...p, [item.id]: e.target.value }))} placeholder="검수 의견 입력" />
              )}
            </div>
            {canReview && item.sourceType !== "static" && (
              <div className="v2-inline-actions">
                <button type="button" onClick={() => onAction("approve", item.id)}>승인</button>
                <button type="button" onClick={() => onAction("request-changes", item.id)}>수정 요청</button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && <p className="v2-muted">검수 대기 중인 항목이 없습니다.</p>}
      </div>
    </section>
  );
}
