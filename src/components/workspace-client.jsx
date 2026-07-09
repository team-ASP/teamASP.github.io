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

const roadmapStatuses = [
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
];

const decisionStatuses = [
  { value: "proposed", label: "Proposed" },
  { value: "accepted", label: "Accepted" },
  { value: "superseded", label: "Superseded" },
];

const statusLabels = {
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

function safeMarkdownHref(rawHref) {
  const href = String(rawHref || "").trim();
  if (!href) return "";
  if (href.startsWith("/") || href.startsWith("#")) return href;

  try {
    const url = new URL(href);
    if (["http:", "https:", "mailto:"].includes(url.protocol)) return url.href;
  } catch {
    return "";
  }

  return "";
}

function renderInlineMarkdown(value, keyPrefix) {
  const text = String(value || "");
  const pattern = /(`[^`]+`|\*\*[^*]+?\*\*|\*[^*]+?\*|\[[^\]]+?\]\([^)]+?\))/g;
  const nodes = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(<strong key={key}>{renderInlineMarkdown(token.slice(2, -2), `${key}-strong`)}</strong>);
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(<em key={key}>{renderInlineMarkdown(token.slice(1, -1), `${key}-em`)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+?)\]\(([^)]+?)\)$/);
      const href = safeMarkdownHref(linkMatch?.[2]);
      nodes.push(
        href ? (
          <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined}>
            {renderInlineMarkdown(linkMatch[1], `${key}-link`)}
          </a>
        ) : (
          linkMatch?.[1] || token
        ),
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isMarkdownBlockStart(line) {
  return /^(```|#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s+)/.test(line.trim());
}

function MarkdownText({ value, compact = false }) {
  const normalized = String(value || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return null;

  const lines = normalized.split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const key = `md-${blocks.length}`;

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <pre key={key}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = compact ? "p" : `h${Math.min(heading[1].length + 3, 6)}`;
      blocks.push(
        <Tag key={key} className={compact ? "markdown-heading" : undefined}>
          {renderInlineMarkdown(heading[2], key)}
        </Tag>,
      );
      index += 1;
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push(
        <ul key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^\d+\.\s+(.+)$/);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push(
        <ol key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>{renderInlineMarkdown(item, `${key}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const quote = trimmed.match(/^>\s+(.+)$/);
    if (quote) {
      const quotes = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^>\s+(.+)$/);
        if (!item) break;
        quotes.push(item[1]);
        index += 1;
      }
      blocks.push(<blockquote key={key}>{renderInlineMarkdown(quotes.join(" "), key)}</blockquote>);
      continue;
    }

    const paragraph = [trimmed];
    index += 1;
    while (index < lines.length && lines[index].trim() && !isMarkdownBlockStart(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={key}>{renderInlineMarkdown(paragraph.join(" "), key)}</p>);
  }

  return <div className={`markdown-text${compact ? " compact" : ""}`}>{blocks}</div>;
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

function emptyRoadmapItem(projectId) {
  return {
    id: "",
    projectId,
    source: "database",
    templateId: "",
    title: "",
    timeframe: "",
    status: "planned",
    summary: "",
    startDate: "",
    endDate: "",
  };
}

function emptyDecisionRecord(projectId) {
  return {
    id: "",
    projectId,
    source: "database",
    templateId: "",
    title: "",
    status: "proposed",
    context: "",
    decision: "",
    impact: "",
    decidedAt: "",
  };
}

function archiveChecklistTargetId(projectId, label) {
  return `${projectId}:${label}`;
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
  const [roadmapItems, setRoadmapItems] = useState([]);
  const [decisionRecords, setDecisionRecords] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [reviewPayload, setReviewPayload] = useState({ items: data.reviewQueue, permissions: { canReview: false } });
  const [draftForm, setDraftForm] = useState(emptyDraft(project.id));
  const [backlogForm, setBacklogForm] = useState(emptyBacklogItem(project.id));
  const [roadmapForm, setRoadmapForm] = useState(emptyRoadmapItem(project.id));
  const [decisionForm, setDecisionForm] = useState(emptyDecisionRecord(project.id));
  const [archiveForm, setArchiveForm] = useState(emptyArchiveItem(project.id));
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [taskStatuses, setTaskStatuses] = useState({});
  const [taskNotes, setTaskNotes] = useState({});
  const [reviewNotes, setReviewNotes] = useState({});
  const [itemModal, setItemModal] = useState(null);
  const [contentOverrides, setContentOverrides] = useState([]);
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
      const [
        backlogResponse,
        taskResponse,
        draftsResponse,
        reviewResponse,
        archiveResponse,
        overridesResponse,
        roadmapResponse,
        decisionResponse,
      ] = await Promise.all([
        fetch(`/api/backlog-items?projectId=${encodeURIComponent(project.id)}`, requestOptions),
        fetch("/api/task-updates", requestOptions),
        sessionAuthenticated ? fetch("/api/drafts", requestOptions) : Promise.resolve(null),
        fetch("/api/review-queue", requestOptions),
        fetch(`/api/archive-items?projectId=${encodeURIComponent(project.id)}`, requestOptions),
        fetch(`/api/content-overrides?projectId=${encodeURIComponent(project.id)}`, requestOptions),
        fetch(`/api/roadmap-items?projectId=${encodeURIComponent(project.id)}`, requestOptions),
        fetch(`/api/decision-records?projectId=${encodeURIComponent(project.id)}`, requestOptions),
      ]);
      const [backlogPayload, taskPayload, draftPayload, reviewData, archivePayload, overridesPayload, roadmapPayload, decisionPayload] = await Promise.all([
        backlogResponse.json(),
        taskResponse.json(),
        draftsResponse ? draftsResponse.json() : Promise.resolve({ configured: true, items: [] }),
        reviewResponse.json(),
        archiveResponse.json(),
        overridesResponse.json(),
        roadmapResponse.json(),
        decisionResponse.json(),
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
      setRoadmapItems(roadmapPayload.items || []);
      setDecisionRecords(decisionPayload.items || []);
      setContentOverrides([...(overridesPayload.items || []), ...((taskPayload.hiddenTaskIds || []).map((taskId) => ({
        projectId: project.id,
        targetType: "task",
        targetId: taskId,
        action: "hidden",
      })))]);
      if (
        sessionAuthenticated &&
        (!backlogPayload.configured ||
          !taskPayload.configured ||
          !draftPayload.configured ||
          !archivePayload.configured ||
          !roadmapPayload.configured ||
          !decisionPayload.configured)
      ) {
        setMessage("DB 연결이 활성화되어야 편집 내용이 저장됩니다.");
      }
    }
    loadProjectWorkspace().catch(() => setMessage("워크스페이스 데이터를 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.tasks, project.id, requestOptions, session, sessionAuthenticated]);

  const taskUpdateMap = useMemo(() => new Map(taskUpdates.map((item) => [item.taskId, item])), [taskUpdates]);
  const hiddenTaskIds = useMemo(
    () => new Set(contentOverrides.filter((item) => item.targetType === "task").map((item) => item.targetId)),
    [contentOverrides],
  );
  const hiddenArchiveChecklistIds = useMemo(
    () => new Set(contentOverrides.filter((item) => item.targetType === "archive-checklist").map((item) => item.targetId)),
    [contentOverrides],
  );
  const hiddenRoadmapIds = useMemo(
    () => new Set(contentOverrides.filter((item) => item.targetType === "roadmap").map((item) => item.targetId)),
    [contentOverrides],
  );
  const hiddenDecisionIds = useMemo(
    () => new Set(contentOverrides.filter((item) => item.targetType === "decision").map((item) => item.targetId)),
    [contentOverrides],
  );
  const tasks = useMemo(
    () =>
      [
        ...data.tasks.filter((task) => task.projectId === project.id && !hiddenTaskIds.has(task.id)).map((task) => {
          const latest = taskUpdateMap.get(task.id);
          return {
            ...task,
            source: "seed",
            type: "task",
            priority: "medium",
            description: task.description || "",
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
    [backlogItems, data.tasks, hiddenTaskIds, project.id, taskUpdateMap],
  );

  const progress = Math.round((tasks.filter((task) => task.status === "done").length / Math.max(tasks.length, 1)) * 100);
  const canEdit = session?.editableScopes?.some((scope) => ["projects", "tasks", "logs", "sessions"].includes(scope));
  const canReview = reviewPayload.permissions?.canReview;
  const canAdmin = session?.editableScopes?.includes("admin");

  function resetProjectForms(nextProjectId) {
    setDraftForm(emptyDraft(nextProjectId));
    setBacklogForm(emptyBacklogItem(nextProjectId));
    setRoadmapForm(emptyRoadmapItem(nextProjectId));
    setDecisionForm(emptyDecisionRecord(nextProjectId));
    setArchiveForm(emptyArchiveItem(nextProjectId));
    setRoadmapModalOpen(false);
    setDecisionModalOpen(false);
    setItemModal(null);
  }

  async function createBacklogItem(event) {
    event.preventDefault();
    setMessage("");
    const response = await mutate("/api/backlog-items", "POST", { ...backlogForm, projectId: project.id }, session);
    if (!response.ok) return setMessage(response.error || "백로그 항목 생성에 실패했습니다.");
    setBacklogItems((items) => [response.item, ...items]);
    setTaskStatuses((items) => ({ ...items, [response.item.id]: response.item.status }));
    setBacklogForm(emptyBacklogItem(project.id));
    setMessage(`백로그에 추가했습니다: ${response.item.title}`);
  }

  async function saveRoadmapItem(event) {
    event.preventDefault();
    setMessage("");
    const isTemplateEdit = roadmapForm.source === "seed";
    const isEdit = Boolean(roadmapForm.id) && !isTemplateEdit;
    const roadmapPayload = { ...roadmapForm, projectId: project.id };
    const response = isTemplateEdit
      ? await mutate(
          "/api/static-content/promote",
          "POST",
          { projectId: project.id, targetType: "roadmap", targetId: roadmapForm.templateId || roadmapForm.id, item: roadmapPayload },
          session,
        )
      : await mutate("/api/roadmap-items", isEdit ? "PATCH" : "POST", roadmapPayload, session);
    if (!response.ok) return setMessage(response.error || "로드맵 항목 저장에 실패했습니다.");
    setRoadmapItems((items) => [response.item, ...items.filter((item) => item.id !== response.item.id)]);
    if (response.override) {
      setContentOverrides((items) => [
        response.override,
        ...items.filter((item) => !(item.targetType === "roadmap" && item.targetId === response.override.targetId)),
      ]);
    }
    setRoadmapForm(emptyRoadmapItem(project.id));
    setRoadmapModalOpen(false);
    setMessage(isTemplateEdit ? `템플릿을 실제 로드맵으로 전환했습니다: ${response.item.title}` : `로드맵을 저장했습니다: ${response.item.title}`);
  }

  async function deleteRoadmapItem(item) {
    setMessage("");
    if (item.source === "seed") {
      const response = await mutate(
        "/api/content-overrides",
        "POST",
        { projectId: project.id, targetType: "roadmap", targetId: item.id, reason: `Removed roadmap template: ${item.title}` },
        session,
      );
      if (!response.ok) return setMessage(response.error || "템플릿 로드맵 항목 제외에 실패했습니다.");
      setContentOverrides((items) => [response.item, ...items.filter((candidate) => !(candidate.targetType === "roadmap" && candidate.targetId === item.id))]);
      setMessage("기본 템플릿 로드맵을 이 프로젝트에서 제외했습니다.");
      return;
    }

    const response = await mutate("/api/roadmap-items", "DELETE", { id: item.id }, session);
    if (!response.ok) return setMessage(response.error || "로드맵 항목 삭제에 실패했습니다.");
    setRoadmapItems((items) => items.filter((candidate) => candidate.id !== item.id));
    if (roadmapForm.id === item.id) setRoadmapForm(emptyRoadmapItem(project.id));
    setMessage("로드맵 항목을 삭제했습니다.");
  }

  async function saveDecisionRecord(event) {
    event.preventDefault();
    setMessage("");
    const isTemplateEdit = decisionForm.source === "seed";
    const isEdit = Boolean(decisionForm.id) && !isTemplateEdit;
    const decisionPayload = { ...decisionForm, projectId: project.id };
    const response = isTemplateEdit
      ? await mutate(
          "/api/static-content/promote",
          "POST",
          { projectId: project.id, targetType: "decision", targetId: decisionForm.templateId || decisionForm.id, item: decisionPayload },
          session,
        )
      : await mutate("/api/decision-records", isEdit ? "PATCH" : "POST", decisionPayload, session);
    if (!response.ok) return setMessage(response.error || "의사결정 저장에 실패했습니다.");
    setDecisionRecords((items) => [response.item, ...items.filter((item) => item.id !== response.item.id)]);
    if (response.override) {
      setContentOverrides((items) => [
        response.override,
        ...items.filter((item) => !(item.targetType === "decision" && item.targetId === response.override.targetId)),
      ]);
    }
    setDecisionForm(emptyDecisionRecord(project.id));
    setDecisionModalOpen(false);
    setMessage(isTemplateEdit ? `템플릿을 실제 의사결정으로 전환했습니다: ${response.item.title}` : `의사결정을 저장했습니다: ${response.item.title}`);
  }

  async function deleteDecisionRecord(item) {
    setMessage("");
    if (item.source === "seed") {
      const response = await mutate(
        "/api/content-overrides",
        "POST",
        { projectId: project.id, targetType: "decision", targetId: item.id, reason: `Removed decision template: ${item.title}` },
        session,
      );
      if (!response.ok) return setMessage(response.error || "템플릿 의사결정 제외에 실패했습니다.");
      setContentOverrides((items) => [response.item, ...items.filter((candidate) => !(candidate.targetType === "decision" && candidate.targetId === item.id))]);
      setMessage("기본 템플릿 의사결정을 이 프로젝트에서 제외했습니다.");
      return;
    }

    const response = await mutate("/api/decision-records", "DELETE", { id: item.id }, session);
    if (!response.ok) return setMessage(response.error || "의사결정 삭제에 실패했습니다.");
    setDecisionRecords((items) => items.filter((candidate) => candidate.id !== item.id));
    if (decisionForm.id === item.id) setDecisionForm(emptyDecisionRecord(project.id));
    setMessage("의사결정을 삭제했습니다.");
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

  async function deleteTask(item) {
    setMessage("");
    if (item.source === "backlog") {
      const response = await mutate("/api/backlog-items", "DELETE", { id: item.id }, session);
      if (!response.ok) return setMessage(response.error || "백로그 항목 삭제에 실패했습니다.");
      setBacklogItems((items) => items.filter((candidate) => candidate.id !== item.id));
      setItemModal(null);
      setMessage("백로그 항목을 삭제했습니다.");
      return;
    }

    const response = await mutate("/api/task-updates", "DELETE", { taskId: item.id, reason: "Removed from workspace board" }, session);
    if (!response.ok) return setMessage(response.error || "템플릿 task 제외에 실패했습니다.");
    setContentOverrides((items) => [response.item, ...items.filter((candidate) => !(candidate.targetType === "task" && candidate.targetId === item.id))]);
    setItemModal(null);
    setMessage("기본 템플릿 task를 이 프로젝트에서 제외했습니다.");
  }

  async function saveDraft(event) {
    event.preventDefault();
    setMessage("");
    const isEdit = Boolean(draftForm.id);
    const response = await mutate("/api/drafts", isEdit ? "PATCH" : "POST", { ...draftForm, targetId: project.id }, session);
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
    const response = await mutate("/api/review-queue", "DELETE", { reviewId, note: reviewNotes[reviewId] || "" }, session);
    if (!response.ok) return setMessage(response.error || "검수 항목 삭제에 실패했습니다.");
    setReviewPayload((current) => ({ ...current, items: current.items.filter((item) => item.id !== reviewId) }));
    setMessage("검수 큐에서 제거했습니다.");
  }

  async function deleteArchiveChecklistItem(label) {
    setMessage("");
    const targetId = archiveChecklistTargetId(project.id, label);
    const response = await mutate(
      "/api/content-overrides",
      "POST",
      { projectId: project.id, targetType: "archive-checklist", targetId, reason: `Removed archive checklist item: ${label}` },
      session,
    );
    if (!response.ok) return setMessage(response.error || "아카이브 체크리스트 항목 삭제에 실패했습니다.");
    setContentOverrides((items) => [response.item, ...items.filter((item) => item.targetId !== targetId)]);
    setMessage(`아카이브 체크리스트에서 제거했습니다: ${label}`);
  }

  async function saveArchiveItem(event) {
    event.preventDefault();
    setMessage("");
    const isEdit = Boolean(archiveForm.id);
    const response = await mutate("/api/archive-items", isEdit ? "PATCH" : "POST", { ...archiveForm, projectId: project.id }, session);
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
            <Link key={item.id} className={item.id === project.id ? "active" : ""} href={`/workspace?project=${item.id}`} onClick={() => resetProjectForms(item.id)}>
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

        {active === "overview" && (
          <OverviewPanel
            archive={archive}
            archiveItems={archiveItems}
            canAdmin={canAdmin}
            canEdit={canEdit}
            data={data}
            decisionRecords={decisionRecords}
            deleteDecisionRecord={deleteDecisionRecord}
            deleteRoadmapItem={deleteRoadmapItem}
            hiddenDecisionIds={hiddenDecisionIds}
            hiddenRoadmapIds={hiddenRoadmapIds}
            project={project}
            roadmapItems={roadmapItems}
            setDecisionForm={setDecisionForm}
            setDecisionModalOpen={setDecisionModalOpen}
            setRoadmapForm={setRoadmapForm}
            setRoadmapModalOpen={setRoadmapModalOpen}
            tasks={tasks}
            progress={progress}
          />
        )}
        {active === "board" && (
          <BoardPanel
            data={data}
            tasks={tasks}
            canEdit={canEdit}
            projectId={project.id}
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
            canAdmin={canAdmin}
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
            canAdmin={canAdmin}
            deleteArchiveItem={deleteArchiveItem}
            deleteArchiveChecklistItem={deleteArchiveChecklistItem}
            hiddenArchiveChecklistIds={hiddenArchiveChecklistIds}
            saveArchiveItem={saveArchiveItem}
            setArchiveForm={setArchiveForm}
          />
        )}
      </section>

      {itemModal && (
        <BoardItemModal
          data={data}
          item={itemModal}
          canDelete={itemModal.source === "backlog" || (itemModal.source === "seed" && canAdmin)}
          deleteTask={deleteTask}
          saveBoardModal={saveBoardModal}
          setItemModal={setItemModal}
          taskNotes={taskNotes}
          setTaskNotes={setTaskNotes}
        />
      )}

      {roadmapModalOpen && (
        <RoadmapModal
          form={roadmapForm}
          saveRoadmapItem={saveRoadmapItem}
          setForm={setRoadmapForm}
          setOpen={setRoadmapModalOpen}
          projectId={project.id}
        />
      )}

      {decisionModalOpen && (
        <DecisionModal
          form={decisionForm}
          saveDecisionRecord={saveDecisionRecord}
          setForm={setDecisionForm}
          setOpen={setDecisionModalOpen}
          projectId={project.id}
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
  return { ok: response.ok, status: response.status, ...payload };
}

function OverviewPanel({
  archive,
  archiveItems,
  canAdmin,
  canEdit,
  data,
  decisionRecords,
  deleteDecisionRecord,
  deleteRoadmapItem,
  hiddenDecisionIds,
  hiddenRoadmapIds,
  project,
  roadmapItems,
  setDecisionForm,
  setDecisionModalOpen,
  setRoadmapForm,
  setRoadmapModalOpen,
  tasks,
  progress,
}) {
  const seedRoadmap = (project.milestones || [])
    .filter((milestone) => !hiddenRoadmapIds.has(milestone.id))
    .map((milestone) => ({
      id: milestone.id,
      projectId: project.id,
      title: milestone.title,
      timeframe: `Week ${milestone.week}`,
      status: milestone.status || "planned",
      summary: milestone.deliverables?.join(" · ") || "",
      source: "seed",
      sourceLabel: "Template",
    }));
  const roadmap = [...seedRoadmap, ...roadmapItems].sort((a, b) => {
    const aDate = a.startDate || a.timeframe || a.createdAt || "";
    const bDate = b.startDate || b.timeframe || b.createdAt || "";
    return String(aDate).localeCompare(String(bDate));
  });
  const seedDecisions = data.logs
    .filter((log) => log.projectId === project.id && log.type === "decision" && !hiddenDecisionIds.has(log.id))
    .map((log) => ({
      id: log.id,
      projectId: project.id,
      title: log.title,
      status: "accepted",
      context: "",
      decision: log.summary,
      impact: "",
      decidedAt: log.date,
      authorName: memberName(data, log.authorId),
      source: "seed",
      sourceLabel: "Template",
    }));
  const decisions = [...decisionRecords, ...seedDecisions].sort((a, b) => {
    const aDate = a.decidedAt || a.updatedAt || a.createdAt || "";
    const bDate = b.decidedAt || b.updatedAt || b.createdAt || "";
    return String(bDate).localeCompare(String(aDate));
  });

  function editRoadmap(item) {
    setRoadmapForm({
      id: item.id,
      projectId: project.id,
      source: item.source || "database",
      templateId: item.source === "seed" ? item.id : "",
      title: item.title,
      timeframe: item.timeframe || "",
      status: item.status || "planned",
      summary: item.summary || "",
      startDate: item.startDate ? String(item.startDate).slice(0, 10) : "",
      endDate: item.endDate ? String(item.endDate).slice(0, 10) : "",
    });
    setRoadmapModalOpen(true);
  }

  function editDecision(item) {
    setDecisionForm({
      id: item.id,
      projectId: project.id,
      source: item.source || "database",
      templateId: item.source === "seed" ? item.id : "",
      title: item.title,
      status: item.status || "proposed",
      context: item.context || "",
      decision: item.decision || "",
      impact: item.impact || "",
      decidedAt: item.decidedAt ? String(item.decidedAt).slice(0, 10) : "",
    });
    setDecisionModalOpen(true);
  }

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

      <div className="workspace-overview-grid">
      <section className="workspace-section roadmap-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Roadmap</span>
            <h2>프로젝트 흐름</h2>
          </div>
          {canEdit && (
            <button className="action-button compact" type="button" onClick={() => {
              setRoadmapForm(emptyRoadmapItem(project.id));
              setRoadmapModalOpen(true);
            }}>
              <Plus aria-hidden="true" />
              항목 추가
            </button>
          )}
        </div>
        <div className="roadmap-timeline">
          {roadmap.map((item, index) => (
            <article key={`${item.source}-${item.id}`} className={`roadmap-card ${item.status} ${item.source === "seed" ? "template" : ""}`}>
              <div className="roadmap-marker" aria-hidden="true">
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <div className="roadmap-content">
                <div className="card-kicker">
                  <span>{item.timeframe || "No timeframe"}</span>
                  <span>{getStatusLabel(item.status)}</span>
                  {item.source === "seed" && <span>Template</span>}
                </div>
                <strong>{item.title}</strong>
                {item.summary && <p>{item.summary}</p>}
                <div className="workspace-row-actions inline-left">
                  {canEdit && item.source !== "seed" && <button type="button" onClick={() => editRoadmap(item)}>수정</button>}
                  {canEdit && item.source !== "seed" && (
                    <button type="button" onClick={() => deleteRoadmapItem(item)}>
                      삭제
                    </button>
                  )}
                  {canAdmin && item.source === "seed" && <button type="button" onClick={() => editRoadmap(item)}>템플릿 편집</button>}
                  {canAdmin && item.source === "seed" && (
                    <button type="button" onClick={() => deleteRoadmapItem(item)}>
                      템플릿 제외
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {roadmap.length === 0 && <p className="workspace-empty">프로젝트 흐름을 기간, 상태, 산출물 기준으로 추가하세요.</p>}
        </div>
      </section>

      <section className="workspace-section decision-section">
        <div className="workspace-section-head">
          <div>
            <span className="eyebrow">Decisions</span>
            <h2>의사결정 로그</h2>
          </div>
          {canEdit && (
            <button className="action-button compact" type="button" onClick={() => {
              setDecisionForm(emptyDecisionRecord(project.id));
              setDecisionModalOpen(true);
            }}>
              <Plus aria-hidden="true" />
              결정 기록
            </button>
          )}
        </div>
        <div className="decision-ledger">
          {decisions.map((item) => (
            <article key={`${item.source}-${item.id}`} className={`decision-card ${item.source === "seed" ? "template" : ""}`}>
              <div className="decision-meta">
                <span>{getStatusLabel(item.status)}</span>
                <time>{formatDate(item.decidedAt || item.updatedAt || item.createdAt)}</time>
                {item.source === "seed" && <small>Template</small>}
              </div>
              <div className="decision-body">
                <strong>{item.title}</strong>
                {item.context && <p>{item.context}</p>}
                <p>{item.decision}</p>
                {item.impact && <small>{item.impact}</small>}
                <div className="workspace-row-actions inline-left">
                  {canEdit && item.source !== "seed" && <button type="button" onClick={() => editDecision(item)}>수정</button>}
                  {canEdit && item.source !== "seed" && (
                    <button type="button" onClick={() => deleteDecisionRecord(item)}>
                      삭제
                    </button>
                  )}
                  {canAdmin && item.source === "seed" && <button type="button" onClick={() => editDecision(item)}>템플릿 편집</button>}
                  {canAdmin && item.source === "seed" && (
                    <button type="button" onClick={() => deleteDecisionRecord(item)}>
                      템플릿 제외
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {decisions.length === 0 && <p className="workspace-empty">배경, 결정 내용, 영향을 남겨 나중에 맥락을 잃지 않게 하세요.</p>}
        </div>
      </section>
      </div>
    </div>
  );
}

function RoadmapModal({ form, projectId, saveRoadmapItem, setForm, setOpen }) {
  const isTemplate = form.source === "seed";
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="로드맵 항목 편집">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Roadmap</span>
            <h2>{isTemplate ? "로드맵 템플릿 편집" : form.id ? "로드맵 항목 수정" : "로드맵 항목 추가"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="닫기">
            <X aria-hidden="true" />
          </button>
        </header>
        <form className="workspace-form" onSubmit={saveRoadmapItem}>
          <label>
            <span>제목</span>
            <input value={form.title} onChange={(event) => setForm((item) => ({ ...item, title: event.target.value, projectId }))} required />
          </label>
          <div className="modal-grid">
            <label>
              <span>기간 표시</span>
              <input value={form.timeframe} onChange={(event) => setForm((item) => ({ ...item, timeframe: event.target.value, projectId }))} placeholder="Week 3-4, 7월 1주" />
            </label>
            <label>
              <span>상태</span>
              <select value={form.status} onChange={(event) => setForm((item) => ({ ...item, status: event.target.value, projectId }))}>
                {roadmapStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
          </div>
          <div className="modal-grid">
            <label>
              <span>시작일</span>
              <input type="date" value={form.startDate || ""} onChange={(event) => setForm((item) => ({ ...item, startDate: event.target.value, projectId }))} />
            </label>
            <label>
              <span>종료일</span>
              <input type="date" value={form.endDate || ""} onChange={(event) => setForm((item) => ({ ...item, endDate: event.target.value, projectId }))} />
            </label>
          </div>
          <label>
            <span>산출물과 범위</span>
            <textarea value={form.summary} onChange={(event) => setForm((item) => ({ ...item, summary: event.target.value, projectId }))} />
          </label>
          <div className="modal-actions">
            <button className="subtle-button" type="button" onClick={() => setOpen(false)}>취소</button>
            <button className="action-button compact" type="submit">{isTemplate ? "전환 저장" : "저장"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DecisionModal({ form, projectId, saveDecisionRecord, setForm, setOpen }) {
  const isTemplate = form.source === "seed";
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="의사결정 기록 편집">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Decision</span>
            <h2>{isTemplate ? "의사결정 템플릿 편집" : form.id ? "의사결정 수정" : "의사결정 기록"}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="닫기">
            <X aria-hidden="true" />
          </button>
        </header>
        <form className="workspace-form" onSubmit={saveDecisionRecord}>
          <label>
            <span>제목</span>
            <input value={form.title} onChange={(event) => setForm((item) => ({ ...item, title: event.target.value, projectId }))} required />
          </label>
          <div className="modal-grid">
            <label>
              <span>상태</span>
              <select value={form.status} onChange={(event) => setForm((item) => ({ ...item, status: event.target.value, projectId }))}>
                {decisionStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
              </select>
            </label>
            <label>
              <span>결정일</span>
              <input type="date" value={form.decidedAt || ""} onChange={(event) => setForm((item) => ({ ...item, decidedAt: event.target.value, projectId }))} />
            </label>
          </div>
          <label>
            <span>배경</span>
            <textarea value={form.context} onChange={(event) => setForm((item) => ({ ...item, context: event.target.value, projectId }))} />
          </label>
          <label>
            <span>결정 내용</span>
            <textarea value={form.decision} onChange={(event) => setForm((item) => ({ ...item, decision: event.target.value, projectId }))} required />
          </label>
          <label>
            <span>영향과 후속 조치</span>
            <textarea value={form.impact} onChange={(event) => setForm((item) => ({ ...item, impact: event.target.value, projectId }))} />
          </label>
          <div className="modal-actions">
            <button className="subtle-button" type="button" onClick={() => setOpen(false)}>취소</button>
            <button className="action-button compact" type="submit">{isTemplate ? "전환 저장" : "저장"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function BoardPanel({ data, tasks, canEdit, projectId, backlogForm, taskStatuses, createBacklogItem, setBacklogForm, setItemModal, setTaskStatuses }) {
  const updateBacklogForm = (patch) => setBacklogForm((item) => ({ ...item, projectId, ...patch }));

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
              onChange={(event) => updateBacklogForm({ title: event.target.value })}
              placeholder="작업 제목"
              required
            />
            <div className="form-row">
              <select value={backlogForm.type} onChange={(event) => updateBacklogForm({ type: event.target.value })}>
                {itemTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={backlogForm.priority} onChange={(event) => updateBacklogForm({ priority: event.target.value })}>
                {priorities.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input type="date" value={backlogForm.due} onChange={(event) => updateBacklogForm({ due: event.target.value })} />
            </div>
            <textarea
              value={backlogForm.description}
              onChange={(event) => updateBacklogForm({ description: event.target.value })}
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
                      {task.description && <MarkdownText value={task.description} compact />}
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

function BoardItemModal({ data, item, canDelete, deleteTask, saveBoardModal, setItemModal, taskNotes, setTaskNotes }) {
  const isBacklog = item.source === "backlog";
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel" role="dialog" aria-modal="true" aria-label="작업 상세 편집">
        <header className="modal-header">
          <div>
            <span className="eyebrow">{isBacklog ? "Backlog item" : "Template task"}</span>
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
              {item.description && (
                <div className="markdown-preview">
                  <span>Markdown preview</span>
                  <MarkdownText value={item.description} />
                </div>
              )}
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
            <>
              {item.description && (
                <div className="markdown-preview">
                  <span>상세 설명</span>
                  <MarkdownText value={item.description} />
                </div>
              )}
              <p className="muted">초기 설계 태스크는 제목과 설명을 코드 데이터로 관리합니다. 여기서는 진행 상태와 변경 메모만 저장합니다.</p>
            </>
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
              <button className="danger-button" type="button" onClick={() => deleteTask(item)}>
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

function ReviewPanel({ canReview, canAdmin, items, reviewItem, deleteReviewItem, reviewNotes, setReviewNotes }) {
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
            {canAdmin && item.sourceType === "static" && (
              <div className="workspace-row-actions">
                <button type="button" onClick={() => deleteReviewItem(item.id)}>템플릿 항목 제외</button>
              </div>
            )}
          </article>
        ))}
        {items.length === 0 && <p className="workspace-empty">검수 대기 항목이 없습니다.</p>}
      </div>
    </section>
  );
}

function ArchivePanel({
  canEdit,
  canAdmin,
  data,
  project,
  archive,
  archiveForm,
  archiveItems,
  deleteArchiveChecklistItem,
  deleteArchiveItem,
  hiddenArchiveChecklistIds,
  saveArchiveItem,
  setArchiveForm,
}) {
  const projectLogs = data.logs.filter((log) => log.projectId === project.id);
  const checklistItems = (archive?.required || []).filter((item) => !hiddenArchiveChecklistIds.has(archiveChecklistTargetId(project.id, item)));
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
          {checklistItems.map((item) => {
            const missing = archive.missing.includes(item);
            return (
              <article key={item} className={missing ? "missing" : "ready"}>
                <div>
                  <strong>{item}</strong>
                  <span>{missing ? "필요" : "준비됨"}</span>
                </div>
                {canAdmin && (
                  <button type="button" onClick={() => deleteArchiveChecklistItem(item)}>
                    삭제
                  </button>
                )}
              </article>
            );
          })}
          {checklistItems.length === 0 && <p className="workspace-empty">남아 있는 기본 체크리스트 항목이 없습니다.</p>}
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
