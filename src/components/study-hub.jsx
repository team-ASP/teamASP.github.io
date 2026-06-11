"use client";

import {
  Archive,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  LayoutDashboard,
  LockKeyhole,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "projects", label: "Projects", icon: GitBranch },
  { id: "sessions", label: "Sessions", icon: CalendarDays },
  { id: "tasks", label: "Tasks", icon: ClipboardList },
  { id: "logs", label: "Logs", icon: BookOpen },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "governance", label: "Governance", icon: ShieldCheck },
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
  watching: "Watching",
  open: "Open",
};

function getStatusLabel(status) {
  return statusLabels[status] || status;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(date));
}

function includesQuery(value, query) {
  if (!query) return true;
  return JSON.stringify(value).toLowerCase().includes(query.toLowerCase());
}

function memberName(data, id) {
  return data.members.find((member) => member.id === id)?.name || id;
}

export function StudyHub({ data }) {
  const [active, setActive] = useState("dashboard");
  const [query, setQuery] = useState("");
  const project = data.projects[0];

  const stats = useMemo(
    () => [
      { label: "진행 프로젝트", value: data.projects.length, tone: "mint" },
      { label: "예정 세션", value: data.sessions.filter((item) => item.status === "planned").length, tone: "blue" },
      { label: "열린 태스크", value: data.tasks.filter((item) => item.status !== "done").length, tone: "amber" },
      { label: "검수 대기", value: data.reviewQueue.length, tone: "rose" },
    ],
    [data],
  );

  const filteredTasks = data.tasks.filter((item) => includesQuery(item, query));
  const filteredSessions = data.sessions.filter((item) => includesQuery(item, query));
  const filteredLogs = data.logs.filter((item) => includesQuery(item, query));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand-button" onClick={() => setActive("dashboard")}>
          <span className="brand-mark">ASP</span>
          <span>
            <strong>{data.team.name}</strong>
            <small>{data.team.season}</small>
          </span>
        </button>
        <nav className="sidebar-nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}>
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <Link className="nav-link" href="/projects/mafia-simulation">
            <FileText aria-hidden="true" />
            <span>Project URL</span>
          </Link>
          <Link className="nav-link" href="/workspace">
            <ClipboardList aria-hidden="true" />
            <span>Workspace</span>
          </Link>
          <Link className="nav-link" href="/admin/audit">
            <ShieldCheck aria-hidden="true" />
            <span>Audit</span>
          </Link>
        </nav>
        <section className="access-panel">
          <span className="eyebrow">Access</span>
          <strong>GitHub organization 권한</strong>
          <p>상단 세션 바에서 현재 권한을 확인합니다. team-ASP 멤버는 로그인 후 draft, comment, review 흐름을 사용할 수 있습니다.</p>
        </section>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">{data.team.org}</span>
            <h1>{navItems.find((item) => item.id === active)?.label || "Dashboard"}</h1>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Search aria-hidden="true" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트, 태스크, 로그 검색" />
            </label>
            <a className="icon-link primary-link" href={data.team.githubOrgUrl} target="_blank" rel="noreferrer">
              <Github aria-hidden="true" />
              <span>GitHub</span>
            </a>
          </div>
        </header>

        {active === "dashboard" && <Dashboard data={data} project={project} stats={stats} setActive={setActive} />}
        {active === "projects" && <Projects data={data} project={project} />}
        {active === "sessions" && <Sessions data={data} sessions={filteredSessions} />}
        {active === "tasks" && <Tasks data={data} tasks={filteredTasks} />}
        {active === "logs" && <Logs data={data} logs={filteredLogs} />}
        {active === "archive" && <ArchivePage data={data} />}
        {active === "governance" && <Governance data={data} />}
      </main>
    </div>
  );
}

function Dashboard({ data, project, stats, setActive }) {
  const nextSession = data.sessions[0];
  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">Operating hub</span>
          <h2>{data.team.mission}</h2>
          <p>{project.summary}</p>
          <div className="hero-actions">
            <button className="action-button" onClick={() => setActive("projects")}>
              <GitBranch aria-hidden="true" />
              프로젝트 계획
            </button>
            <button className="action-button secondary" onClick={() => setActive("governance")}>
              <LockKeyhole aria-hidden="true" />
              권한 정책
            </button>
          </div>
        </div>
        <div className="phase-board">
          {project.milestones.slice(0, 4).map((milestone) => (
            <article key={milestone.id}>
              <small>Week {milestone.week}</small>
              <strong>{milestone.title}</strong>
              <span>{getStatusLabel(milestone.status)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="metric-grid">
        {stats.map((item) => (
          <article key={item.label} className={`metric-card ${item.tone}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Next session</span>
              <h2>{nextSession.title}</h2>
            </div>
            <span className="status-pill">{formatDate(nextSession.date)}</span>
          </div>
          <ul className="clean-list">
            {nextSession.agenda.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">Review queue</span>
              <h2>검수 대기</h2>
            </div>
            <span className="status-pill">{data.reviewQueue.length} items</span>
          </div>
          <div className="compact-list">
            {data.reviewQueue.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.type} · {getStatusLabel(item.status)}</span>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Projects({ data, project }) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{getStatusLabel(project.status)}</span>
          <h2>{project.title}</h2>
          <p>{project.summary}</p>
        </div>
        <a className="icon-link" href={project.repositoryUrl} target="_blank" rel="noreferrer">
          <ExternalLink aria-hidden="true" />
          Repository
        </a>
      </section>

      <section className="two-column">
        <article className="panel">
          <span className="eyebrow">Goals</span>
          <ul className="clean-list">
            {project.goals.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <span className="eyebrow">Success criteria</span>
          <ul className="clean-list">
            {project.successCriteria.map((goal) => (
              <li key={goal}>{goal}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="timeline">
        {project.milestones.map((milestone) => (
          <article key={milestone.id} className="timeline-item">
            <div className="timeline-marker">
              <CircleDot aria-hidden="true" />
            </div>
            <div>
              <span className="eyebrow">Week {milestone.week}</span>
              <h3>{milestone.title}</h3>
              <p>{milestone.deliverables.join(" · ")}</p>
            </div>
            <span className="status-pill">{getStatusLabel(milestone.status)}</span>
          </article>
        ))}
      </section>
    </div>
  );
}

function Sessions({ data, sessions }) {
  return (
    <section className="card-grid">
      {sessions.map((session) => (
        <article key={session.id} className="panel">
          <div className="section-head">
            <div>
              <span className="eyebrow">{formatDate(session.date)}</span>
              <h2>{session.title}</h2>
            </div>
            <span className="status-pill">{getStatusLabel(session.status)}</span>
          </div>
          <p className="muted">Owner: {memberName(data, session.ownerId)}</p>
          <ul className="clean-list">
            {session.agenda.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}

function Tasks({ data, tasks }) {
  return (
    <section className="task-table">
      {tasks.map((task) => (
        <article key={task.id} className="task-row">
          <div>
            <span className="eyebrow">{task.milestoneId}</span>
            <h3>{task.title}</h3>
            <p>Owner: {memberName(data, task.ownerId)} · Due {formatDate(task.due)}</p>
          </div>
          <span className={`status-pill ${task.status}`}>{getStatusLabel(task.status)}</span>
        </article>
      ))}
    </section>
  );
}

function Logs({ data, logs }) {
  return (
    <section className="card-grid">
      {logs.map((log) => (
        <article key={log.id} className="panel">
          <span className="eyebrow">{log.type} · {formatDate(log.date)}</span>
          <h2>{log.title}</h2>
          <p>{log.summary}</p>
          <div className="meta-row">
            <span>{memberName(data, log.authorId)}</span>
            <span>{log.relatedMilestoneId}</span>
          </div>
        </article>
      ))}
    </section>
  );
}

function ArchivePage({ data }) {
  return (
    <div className="page-stack">
      {data.archive.map((item) => {
        const project = data.projects.find((candidate) => candidate.id === item.projectId);
        return (
          <section key={item.id} className="page-intro">
            <div>
              <span className="eyebrow">{getStatusLabel(item.status)}</span>
              <h2>{project?.title}</h2>
              <p>최종 아카이브에 필요한 항목: {item.required.join(", ")}</p>
              <p className="muted">남은 항목: {item.missing.join(", ")}</p>
            </div>
            <CheckCircle2 aria-hidden="true" className="large-icon" />
          </section>
        );
      })}
    </div>
  );
}

function Governance({ data }) {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">Policy</span>
          <h2>GitHub organization 기반 편집 권한</h2>
          <p>{data.policies.deployment}</p>
        </div>
        <ShieldCheck aria-hidden="true" className="large-icon" />
      </section>

      <section className="card-grid">
        {data.policies.roles.map((item) => (
          <article key={item.role} className="panel">
            <Users aria-hidden="true" className="panel-icon" />
            <h2>{item.role}</h2>
            <p>{item.permission}</p>
          </article>
        ))}
      </section>

      <section className="panel">
        <span className="eyebrow">Automation</span>
        <h2>검증과 배포 흐름</h2>
        <div className="automation-steps">
          {["PR 생성", "GitHub Actions 검증", "Vercel Preview", "Maintainer review", "Production deploy"].map((item) => (
            <article key={item}>
              <FileText aria-hidden="true" />
              <span>{item}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
