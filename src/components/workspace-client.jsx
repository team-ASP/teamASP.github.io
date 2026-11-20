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
          <a key={key} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>
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
  return /^(```|#{1,3}\s+|[-*]\s+|\d+\.\s+|>\s+|\|.+\|$)/.test(line.trim());
}

function countChecklist(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  let total = 0;
  let checked = 0;
  for (const line of lines) {
    const match = line.trim().match(/^[-*]\s+\[([ xX])\]\s+/);
    if (match) {
      total += 1;
      if (match[1].toLowerCase() === "x") checked += 1;
    }
  }
  return { total, checked };
}

function stripMarkdownSnippet(markdown, maxLen = 96) {
  const plain = String(markdown || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>*\-\s|]+/gm, " ")
    .replace(/[*`_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return "";
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain;
}

function parseTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function MarkdownText({ value, compact = false, onToggleChecklist = null }) {
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

    if (trimmed.startsWith("|") && trimmed.endsWith("|") && index + 1 < lines.length && /^\|[\s:-]+\|$/.test(lines[index + 1].trim().replace(/\|/g, "|"))) {
      const headers = parseTableRow(trimmed);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].trim().startsWith("|") && lines[index].trim().endsWith("|")) {
        rows.push(parseTableRow(lines[index]));
        index += 1;
      }
      blocks.push(
        <div key={key} className="md-table-scroll">
          <table className="md-table">
            <thead>
              <tr>
                {headers.map((cell, ci) => (
                  <th key={`${key}-h-${ci}`}>{renderInlineMarkdown(cell, `${key}-h-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={`${key}-r-${ri}`}>
                  {headers.map((_, ci) => (
                    <td key={`${key}-r-${ri}-c-${ci}`}>{renderInlineMarkdown(row[ci] || "", `${key}-r-${ri}-c-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
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

    const checklistMatch = trimmed.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (checklistMatch) {
      const items = [];
      while (index < lines.length) {
        const m = lines[index].trim().match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
        if (!m) break;
        items.push({ lineIndex: index, checked: m[1].toLowerCase() === "x", text: m[2] });
        index += 1;
      }
      blocks.push(
        <ul key={key} className="md-checklist">
          {items.map((item) => (
            <li key={`${key}-chk-${item.lineIndex}`} className={item.checked ? "checked" : ""}>
              <input
                type="checkbox"
                checked={item.checked}
                readOnly={!onToggleChecklist}
                onChange={() => onToggleChecklist?.(item.lineIndex)}
              />
              <span>{renderInlineMarkdown(item.text, `${key}-chk-${item.lineIndex}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    const unordered = trimmed.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      const items = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^[-*]\s+(.+)$/);
        if (!item || /^[-*]\s+\[([ xX])\]\s+/.test(lines[index].trim())) break;
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

  async function quickCreateBacklogItem(status, title) {
    const cleanTitle = String(title || "").trim();
    if (!cleanTitle) return false;
    setMessage("");
    const response = await mutate(
      "/api/backlog-items",
      "POST",
      { projectId: project.id, title: cleanTitle, description: "", type: "task", status, priority: "medium" },
      session,
    );
    if (!response.ok) {
      setMessage(response.error || "빠른 작업 추가에 실패했습니다.");
      return false;
    }
    setBacklogItems((items) => [response.item, ...items]);
    setTaskStatuses((items) => ({ ...items, [response.item.id]: response.item.status }));
    setMessage(`빠르게 추가했습니다: ${response.item.title}`);
    return true;
  }

  async function quickMoveTask(task, nextStatus) {
    if (!canEdit || !nextStatus || nextStatus === task.status) return;
    const prevStatus = taskStatuses[task.id] || task.status;
    setTaskStatuses((items) => ({ ...items, [task.id]: nextStatus }));
    setMessage("");
    const isBacklogItem = task.source === "backlog";
    const payload = isBacklogItem
      ? { id: task.id, status: nextStatus }
      : { taskId: task.id, status: nextStatus, note: "" };
    const response = await mutate(
      isBacklogItem ? "/api/backlog-items" : "/api/task-updates",
      isBacklogItem ? "PATCH" : "POST",
      payload,
      session,
    );
    if (!response.ok) {
      setTaskStatuses((items) => ({ ...items, [task.id]: prevStatus }));
      setMessage(response.error || "상태 변경에 실패했습니다.");
      return;
    }
    if (isBacklogItem) {
      setBacklogItems((items) => items.map((item) => (item.id === response.item.id ? response.item : item)));
    } else {
      setTaskUpdates((items) => [response.item, ...items.filter((item) => item.taskId !== response.item.taskId)]);
    }
    setMessage(`상태를 변경했습니다: ${task.title} → ${getStatusLabel(nextStatus)}`);
  }

  async function promoteTaskToArchive(item) {
    if (!canEdit || !item) return;
    setMessage("");
    const response = await mutate(
      "/api/archive-items",
      "POST",
      {
        projectId: project.id,
        title: item.title,
        kind: item.type === "research" ? "report" : "artifact",
        status: "ready",
        url: "",
        notes: item.description || `${item.title} 완료 기록 (Kanban에서 승격됨)`,
      },
      session,
    );
    if (!response.ok) return setMessage(response.error || "아카이브 승격에 실패했습니다.");
    setArchiveItems((items) => [response.item, ...items]);
    setMessage(`아카이브로 승격했습니다: ${response.item.title}`);
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
          tags: itemModal.tagsText !== undefined ? itemModal.tagsText : (itemModal.tags || []),
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
            <Link href="/benchmark">Benchmark 6D</Link>
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
            quickCreateBacklogItem={quickCreateBacklogItem}
            quickMoveTask={quickMoveTask}
            setBacklogForm={setBacklogForm}
            setItemModal={setItemModal}
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
          canEdit={canEdit}
          canDelete={itemModal.source === "backlog" || (itemModal.source === "seed" && canAdmin)}
          deleteTask={deleteTask}
          promoteTaskToArchive={promoteTaskToArchive}
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

function BoardPanel({
  data,
  tasks,
  canEdit,
  projectId,
  backlogForm,
  taskStatuses,
  createBacklogItem,
  quickCreateBacklogItem,
  quickMoveTask,
  setBacklogForm,
  setItemModal,
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [showFullComposer, setShowFullComposer] = useState(false);
  const [quickTitles, setQuickTitles] = useState({});

  const updateBacklogForm = (patch) => setBacklogForm((item) => ({ ...item, projectId, ...patch }));

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (typeFilter !== "all" && (task.type || "task") !== typeFilter) return false;
      if (priorityFilter !== "all" && (task.priority || "medium") !== priorityFilter) return false;
      if (!q) return true;
      const tagsText = Array.isArray(task.tags) ? task.tags.join(" ") : "";
      return (
        String(task.title || "").toLowerCase().includes(q) ||
        String(task.description || "").toLowerCase().includes(q) ||
        tagsText.toLowerCase().includes(q)
      );
    });
  }, [priorityFilter, search, tasks, typeFilter]);

  async function handleQuickAdd(event, columnId) {
    event.preventDefault();
    const title = quickTitles[columnId] || "";
    const ok = await quickCreateBacklogItem(columnId, title);
    if (ok) {
      setQuickTitles((prev) => ({ ...prev, [columnId]: "" }));
    }
  }

  return (
    <div className="v2-board-stack">
      <section className="v2-board-toolbar">
        <div className="v2-board-filters">
          <input
            type="search"
            className="compact-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="작업 제목 · 내용 · 태그 검색..."
            aria-label="칸반 작업 검색"
          />
          <select className="compact-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="유형 필터">
            <option value="all">모든 유형</option>
            {itemTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="compact-select" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="우선순위 필터">
            <option value="all">모든 우선순위</option>
            {priorities.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <span className="workspace-hint mono">{filteredTasks.length} / {tasks.length}</span>
        </div>
        {canEdit && (
          <button type="button" className="action-button compact" onClick={() => setShowFullComposer((v) => !v)}>
            <Plus size={14} aria-hidden="true" />
            {showFullComposer ? "상세 작성 닫기" : "상세 문서로 추가"}
          </button>
        )}
      </section>

      {canEdit && showFullComposer && (
        <section className="workspace-section v2-full-composer">
          <div className="workspace-section-head">
            <div>
              <span className="eyebrow">Kanban Detail Composer</span>
              <h2>상세 작업 등록 (Markdown · 체크리스트 · 태그 지원)</h2>
            </div>
          </div>
          <form
            className="backlog-create-form"
            onSubmit={async (e) => {
              await createBacklogItem(e);
              setShowFullComposer(false);
            }}
          >
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
              <input
                value={backlogForm.tags || ""}
                onChange={(event) => updateBacklogForm({ tags: event.target.value })}
                placeholder="태그 (쉼표 구분: benchmark, ui)"
              />
            </div>
            <textarea
              rows={5}
              value={backlogForm.description}
              onChange={(event) => updateBacklogForm({ description: event.target.value })}
              placeholder={"## 배경 / 완료 조건\n- [ ] 체크리스트 항목 1\n- [ ] 체크리스트 항목 2"}
            />
            <div className="workspace-row-actions">
              <button className="action-button compact" type="submit">저장</button>
              <button className="subtle-button" type="button" onClick={() => setShowFullComposer(false)}>취소</button>
            </div>
          </form>
        </section>
      )}

      <div className="v2-kanban-grid">
        {boardColumns.map((column) => {
          const columnTasks = filteredTasks.filter((task) => column.statuses.includes(taskStatuses[task.id] || task.status));
          return (
            <article key={column.id} className="v2-kanban-col">
              <header className="v2-kanban-col-head">
                <div>
                  <h3>{column.title}</h3>
                  <p>{column.description}</p>
                </div>
                <span className="v2-col-count mono">{columnTasks.length}</span>
              </header>

              <div className="v2-kanban-cards">
                {columnTasks.map((task) => {
                  const checklist = countChecklist(task.description);
                  const snippet = stripMarkdownSnippet(task.description, 88);
                  const currentStatus = taskStatuses[task.id] || task.status;
                  const tags = Array.isArray(task.tags) ? task.tags : [];
                  return (
                    <div
                      key={task.id}
                      className={`v2-agile-card priority-${task.priority || "medium"}`}
                      onClick={() =>
                        setItemModal({
                          ...task,
                          status: currentStatus,
                          tagsText: tags.join(", "),
                          note: "",
                        })
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setItemModal({ ...task, status: currentStatus, tagsText: tags.join(", "), note: "" });
                        }
                      }}
                    >
                      <div className="v2-card-top">
                        <span className={`v2-priority-dot ${task.priority || "medium"}`} title={`Priority: ${task.priority || "medium"}`} />
                        <span className="v2-tag">{task.type || "task"}</span>
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="v2-tag accent">{tag}</span>
                        ))}
                      </div>
                      <strong className="v2-card-title">{task.title}</strong>
                      {snippet && <p className="v2-card-snippet">{snippet}</p>}
                      <div className="v2-card-foot" onClick={(e) => e.stopPropagation()}>
                        <span className="v2-card-meta">
                          {task.source === "backlog" ? task.ownerLogin : memberName(data, task.ownerId)} · {formatDate(task.due)}
                          {checklist.total > 0 && (
                            <span className="v2-checklist-badge mono"> · {checklist.checked}/{checklist.total}</span>
                          )}
                        </span>
                        {canEdit && (
                          <select
                            className="v2-status-select"
                            aria-label={`${task.title} 상태 변경`}
                            value={currentStatus}
                            onChange={(e) => quickMoveTask(task, e.target.value)}
                          >
                            {boardColumns.map((option) => (
                              <option key={option.id} value={option.id}>{option.title}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
                {columnTasks.length === 0 && <p className="workspace-empty">항목 없음</p>}
              </div>

              {canEdit && (
                <form className="v2-quick-add" onSubmit={(e) => handleQuickAdd(e, column.id)}>
                  <input
                    value={quickTitles[column.id] || ""}
                    onChange={(e) => setQuickTitles((prev) => ({ ...prev, [column.id]: e.target.value }))}
                    placeholder={`+ ${column.title}에 1줄 빠른 추가 (Enter)`}
                    aria-label={`${column.title} 빠른 작업 추가`}
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

function BoardItemModal({ data, item, canEdit, canDelete, deleteTask, promoteTaskToArchive, saveBoardModal, setItemModal, taskNotes, setTaskNotes }) {
  const isBacklog = item.source === "backlog";
  const [editorMode, setEditorMode] = useState(isBacklog && canEdit ? "split" : "preview");

  function toggleChecklistLine(lineIndex) {
    if (!isBacklog || !canEdit) return;
    const lines = String(item.description || "").replace(/\r\n/g, "\n").split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    lines[lineIndex] = lines[lineIndex].replace(
      /^(\s*[-*]\s+\[)([ xX])(\]\s+)/,
      (_, pre, mark, post) => `${pre}${mark.toLowerCase() === "x" ? " " : "x"}${post}`,
    );
    setItemModal((current) => ({ ...current, description: lines.join("\n") }));
  }

  return (
    <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setItemModal(null); }}>
      <aside className="v2-drawer wide" role="dialog" aria-modal="true" aria-label="작업 상세 문서">
        <header className="v2-drawer-head">
          <div>
            <span className="eyebrow">{isBacklog ? "Kanban Document" : "Template Task"}</span>
            <h2>{item.title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setItemModal(null)} aria-label="닫기">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <form className="v2-drawer-body workspace-form" onSubmit={saveBoardModal}>
          {isBacklog ? (
            <>
              <label>
                <span>제목</span>
                <input
                  value={item.title}
                  readOnly={!canEdit}
                  onChange={(event) => setItemModal((current) => ({ ...current, title: event.target.value }))}
                  required
                />
              </label>

              <div className="v2-meta-row-4">
                <label>
                  <span>상태</span>
                  <select value={item.status} disabled={!canEdit} onChange={(event) => setItemModal((current) => ({ ...current, status: event.target.value }))}>
                    {boardColumns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                  </select>
                </label>
                <label>
                  <span>종류</span>
                  <select value={item.type} disabled={!canEdit} onChange={(event) => setItemModal((current) => ({ ...current, type: event.target.value }))}>
                    {itemTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>우선순위</span>
                  <select value={item.priority} disabled={!canEdit} onChange={(event) => setItemModal((current) => ({ ...current, priority: event.target.value }))}>
                    {priorities.map((priority) => <option key={priority.value} value={priority.value}>{priority.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>기한</span>
                  <input type="date" disabled={!canEdit} value={item.due ? String(item.due).slice(0, 10) : ""} onChange={(event) => setItemModal((current) => ({ ...current, due: event.target.value }))} />
                </label>
              </div>

              <label>
                <span>태그 (쉼표 구분, 최대 6개)</span>
                <input
                  value={item.tagsText ?? (Array.isArray(item.tags) ? item.tags.join(", ") : "")}
                  readOnly={!canEdit}
                  onChange={(event) => setItemModal((current) => ({ ...current, tagsText: event.target.value }))}
                  placeholder="예: mafia-sim, v3-rubric, frontend"
                />
              </label>

              <div className="v2-doc-head">
                <span>상세 문서 (Markdown · 표 · 체크리스트 지원, 최대 8,000자)</span>
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
                  <textarea
                    className="v2-md-textarea mono"
                    rows={12}
                    value={item.description || ""}
                    onChange={(event) => setItemModal((current) => ({ ...current, description: event.target.value }))}
                    placeholder={"## 목표\n\n- [ ] 체크리스트 항목\n\n| 항목 | 결과 |\n| --- | --- |\n| 테스트 | 통과 |"}
                  />
                )}
                {editorMode !== "write" && (
                  <div className="v2-md-reader">
                    {item.description ? (
                      <MarkdownText value={item.description} onToggleChecklist={canEdit ? toggleChecklistLine : null} />
                    ) : (
                      <p className="muted">작성된 상세 문서가 없습니다.</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {item.description && (
                <div className="v2-md-reader">
                  <MarkdownText value={item.description} />
                </div>
              )}
              <label>
                <span>상태</span>
                <select value={item.status} disabled={!canEdit} onChange={(event) => setItemModal((current) => ({ ...current, status: event.target.value }))}>
                  {boardColumns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
                </select>
              </label>
              <label>
                <span>변경 메모</span>
                <input
                  value={taskNotes[item.id] || item.note || ""}
                  readOnly={!canEdit}
                  onChange={(event) => {
                    setTaskNotes((items) => ({ ...items, [item.id]: event.target.value }));
                    setItemModal((current) => ({ ...current, note: event.target.value }));
                  }}
                  placeholder={`${memberName(data, item.ownerId)}에게 공유할 변경 맥락`}
                />
              </label>
            </>
          )}

          <div className="modal-actions v2-drawer-actions">
            <div className="v2-drawer-actions-left">
              {canDelete && (
                <button className="danger-button" type="button" onClick={() => deleteTask(item)}>
                  <Trash2 size={14} aria-hidden="true" />
                  삭제
                </button>
              )}
              {canEdit && (
                <button className="subtle-button" type="button" onClick={() => promoteTaskToArchive(item)}>
                  <Archive size={14} aria-hidden="true" />
                  아카이브로 승격
                </button>
              )}
            </div>
            {canEdit && <button className="action-button compact" type="submit">변경 저장</button>}
          </div>
        </form>
      </aside>
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
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [showComposer, setShowComposer] = useState(false);
  const [readingItem, setReadingItem] = useState(null);

  const projectLogs = data.logs.filter((log) => log.projectId === project.id);
  const checklistItems = (archive?.required || []).filter((item) => !hiddenArchiveChecklistIds.has(archiveChecklistTargetId(project.id, item)));

  const filteredArchive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return archiveItems.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        String(item.title || "").toLowerCase().includes(q) ||
        String(item.notes || "").toLowerCase().includes(q)
      );
    });
  }, [archiveItems, kindFilter, search]);

  return (
    <div className="v2-archive-stack">
      <section className="v2-board-toolbar">
        <div className="v2-board-filters">
          <input
            type="search"
            className="compact-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="아카이브 제목 · 본문 검색..."
            aria-label="아카이브 검색"
          />
          <div className="chip-row">
            <button type="button" className={`filter-chip ${kindFilter === "all" ? "active" : ""}`} onClick={() => setKindFilter("all")}>
              All ({archiveItems.length})
            </button>
            {archiveKinds.map((kind) => (
              <button
                key={kind.value}
                type="button"
                className={`filter-chip ${kindFilter === kind.value ? "active" : ""}`}
                onClick={() => setKindFilter(kind.value)}
              >
                {kind.label}
              </button>
            ))}
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            className="action-button compact"
            onClick={() => {
              if (!showComposer) setArchiveForm(emptyArchiveItem(project.id));
              setShowComposer((v) => !v);
            }}
          >
            <Plus size={14} aria-hidden="true" />
            {showComposer ? "등록 폼 닫기" : "산출물 등록"}
          </button>
        )}
      </section>

      {canEdit && showComposer && (
        <section className="workspace-section v2-full-composer">
          <div className="workspace-section-head">
            <div>
              <span className="eyebrow">Archive</span>
              <h2>{archiveForm.id ? "산출물 수정" : "새 아카이브 산출물 등록"}</h2>
            </div>
          </div>
          <form
            className="workspace-form"
            onSubmit={async (e) => {
              await saveArchiveItem(e);
              setShowComposer(false);
            }}
          >
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
              <span>참고 URL (http/https만 허용)</span>
              <input value={archiveForm.url} onChange={(event) => setArchiveForm((item) => ({ ...item, url: event.target.value }))} placeholder="https://..." />
            </label>
            <label>
              <span>상세 노트 (Markdown 지원)</span>
              <textarea rows={6} value={archiveForm.notes} onChange={(event) => setArchiveForm((item) => ({ ...item, notes: event.target.value }))} />
            </label>
            <div className="workspace-row-actions">
              <button className="action-button compact" type="submit">{archiveForm.id ? "수정 저장" : "등록"}</button>
              <button className="subtle-button" type="button" onClick={() => setShowComposer(false)}>취소</button>
            </div>
          </form>
        </section>
      )}

      <div className="v2-archive-grid">
        <section className="workspace-section">
          <div className="workspace-section-head">
            <div>
              <span className="eyebrow">Knowledge Library</span>
              <h2>산출물 &amp; 아카이브 문서</h2>
            </div>
            <Link href="/benchmark" className="subtle-button">
              Mafia Benchmark 6D 열기 →
            </Link>
          </div>

          <div className="v2-archive-cards">
            {filteredArchive.map((item) => {
              const safeUrl = safeMarkdownHref(item.url);
              const snippet = stripMarkdownSnippet(item.notes, 140);
              return (
                <article key={item.id} className="v2-archive-card">
                  <div className="v2-card-top">
                    <span className="v2-tag accent">{archiveKinds.find((kind) => kind.value === item.kind)?.label || item.kind}</span>
                    <span className="v2-tag">{getStatusLabel(item.status)}</span>
                    <span className="v2-card-meta mono" style={{ marginLeft: "auto" }}>{formatDate(item.updatedAt || item.createdAt)}</span>
                  </div>
                  <strong className="v2-archive-title">{item.title}</strong>
                  {snippet && <p className="v2-archive-snippet">{snippet}</p>}
                  <div className="v2-archive-actions">
                    <button type="button" className="subtle-button" onClick={() => setReadingItem(item)}>
                      <BookOpen size={13} aria-hidden="true" />
                      열람
                    </button>
                    {safeUrl && (
                      <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="subtle-button">
                        외부 링크 ↗
                      </a>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="subtle-button"
                          onClick={() => {
                            setArchiveForm(item);
                            setShowComposer(true);
                          }}
                        >
                          편집
                        </button>
                        <button type="button" className="subtle-button" onClick={() => deleteArchiveItem(item.id)}>
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
            {filteredArchive.length === 0 && <p className="workspace-empty">조건에 맞는 아카이브 산출물이 없습니다.</p>}
          </div>
        </section>

        <section className="workspace-section">
          <div className="workspace-section-head">
            <div>
              <span className="eyebrow">Checklist &amp; Logs</span>
              <h2>필수 산출물 점검 &amp; 스터디 로그</h2>
            </div>
            <CheckCircle2 aria-hidden="true" className="panel-icon" />
          </div>
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
          <div className="workspace-list compact" style={{ marginTop: "14px" }}>
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

      {readingItem && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setReadingItem(null); }}>
          <aside className="v2-drawer wide" role="dialog" aria-modal="true" aria-label="아카이브 문서 열람">
            <header className="v2-drawer-head">
              <div>
                <span className="eyebrow">
                  {archiveKinds.find((k) => k.value === readingItem.kind)?.label || readingItem.kind} · {getStatusLabel(readingItem.status)}
                </span>
                <h2>{readingItem.title}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setReadingItem(null)} aria-label="닫기">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="v2-drawer-body">
              {safeMarkdownHref(readingItem.url) && (
                <div className="v2-reader-link-box">
                  <span>Reference Link</span>
                  <a href={safeMarkdownHref(readingItem.url)} target="_blank" rel="noopener noreferrer">
                    {safeMarkdownHref(readingItem.url)}
                  </a>
                </div>
              )}
              <div className="v2-md-reader reader-prose">
                {readingItem.notes ? <MarkdownText value={readingItem.notes} /> : <p className="muted">작성된 노트가 없습니다.</p>}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
