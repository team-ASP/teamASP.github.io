"use client";

import { Archive, ArrowRight, BookOpen, CalendarDays, Github, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const initialProjectForm = {
  repositoryUrl: "",
  title: "",
  summary: "",
  type: "project",
  status: "planning",
  periodStart: "",
  periodEnd: "",
};

function formatDate(date) {
  if (!date) return "기간 미정";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "기간 미정";
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(value);
}

function memberName(data, id) {
  return data.members.find((member) => member.id === id)?.name || id;
}

export function StudyHub({ data }) {
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(null);
  const [projects, setProjects] = useState(data.projects);
  const [projectForm, setProjectForm] = useState(initialProjectForm);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    async function load() {
      const [meResponse, projectsResponse] = await Promise.all([
        fetch("/api/me", { cache: "no-store", credentials: "same-origin" }),
        fetch("/api/projects", { cache: "no-store", credentials: "same-origin" }),
      ]);
      const [me, projectPayload] = await Promise.all([meResponse.json(), projectsResponse.json()]);
      if (!alive) return;
      setSession(me);
      setProjects(projectPayload.items?.length ? projectPayload.items : data.projects);
    }
    load().catch(() => setMessage("프로젝트 목록을 불러오지 못했습니다."));
    return () => {
      alive = false;
    };
  }, [data.projects]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        `${project.title} ${project.summary} ${project.status}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, query],
  );
  const recentLogs = data.logs.slice(0, 3);
  const canAdmin = session?.editableScopes?.includes("admin");

  async function createProject(event) {
    event.preventDefault();
    setMessage("");
    const payload = Object.fromEntries(Object.entries(projectForm).filter(([, value]) => value !== ""));
    const response = await fetch("/api/projects", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session?.csrfToken || "" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error || "프로젝트 생성에 실패했습니다.");
      return;
    }
    setProjects((items) => [body.item, ...items]);
    setProjectForm(initialProjectForm);
    setMessage(`프로젝트를 추가했습니다: ${body.item.title}`);
  }

  return (
    <main className="home-shell">
      <header className="home-header">
        <div>
          <span className="eyebrow">{data.team.org}</span>
          <h1>ASP Project Hub</h1>
          <p>프로젝트별 백로그, 진행 로그, 의사결정, 발표 자료, 아카이브를 한 곳에 남기는 팀 운영 허브입니다.</p>
        </div>
        <div className="home-header-actions">
          <Link className="home-github-link" href="/workspace">
            Workspace
            <ArrowRight aria-hidden="true" />
          </Link>
          <a className="home-github-link" href={data.team.githubOrgUrl} target="_blank" rel="noreferrer">
            <Github aria-hidden="true" />
            GitHub
          </a>
        </div>
      </header>

      <section className="home-toolbar">
        <label className="home-search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 검색" />
        </label>
        <div className="home-metrics" aria-label="Project metrics">
          <span>{projects.length} projects</span>
          <span>{data.tasks.length} seeded tasks</span>
          <span>{data.logs.length} logs</span>
        </div>
      </section>

      {message && <div className="workspace-message">{message}</div>}

      <section className="home-layout">
        <div className="project-directory">
          <div className="home-section-head">
            <div>
              <span className="eyebrow">Projects</span>
              <h2>진행 중인 프로젝트</h2>
            </div>
          </div>
          {filteredProjects.map((project) => {
            const tasks = data.tasks.filter((task) => task.projectId === project.id);
            const logs = data.logs.filter((log) => log.projectId === project.id);
            return (
              <article key={project.id} className="project-row-card">
                <div>
                  <span className="project-status">{project.status}</span>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <div className="project-row-meta">
                    <span>{formatPeriod(project.period)}</span>
                    <span>{tasks.length} seeded backlog</span>
                    <span>{logs.length} logs</span>
                  </div>
                </div>
                <div className="project-row-actions">
                  <Link href={`/projects/${project.id}`}>Overview</Link>
                  <Link className="primary" href={`/workspace?project=${project.id}`}>
                    Workspace
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
          {filteredProjects.length === 0 && <p className="workspace-empty">검색 결과가 없습니다.</p>}
        </div>

        <aside className="home-side">
          <section className="project-admin-panel">
            <div className="home-section-head">
              <div>
                <span className="eyebrow">Admin</span>
                <h2>프로젝트 추가</h2>
              </div>
              <Plus aria-hidden="true" />
            </div>
            {canAdmin ? (
              <form className="workspace-form" onSubmit={createProject}>
                <label>
                  <span>GitHub Repo URL</span>
                  <input
                    value={projectForm.repositoryUrl}
                    onChange={(event) => setProjectForm((form) => ({ ...form, repositoryUrl: event.target.value }))}
                    placeholder="https://github.com/team-ASP/repository"
                  />
                </label>
                <label>
                  <span>프로젝트명</span>
                  <input
                    value={projectForm.title}
                    onChange={(event) => setProjectForm((form) => ({ ...form, title: event.target.value }))}
                    placeholder="Repo URL만 입력하면 자동 보완"
                  />
                </label>
                <label>
                  <span>요약</span>
                  <textarea
                    value={projectForm.summary}
                    onChange={(event) => setProjectForm((form) => ({ ...form, summary: event.target.value }))}
                    placeholder="목표, 범위, 기대 산출물"
                  />
                </label>
                <div className="form-row">
                  <select value={projectForm.type} onChange={(event) => setProjectForm((form) => ({ ...form, type: event.target.value }))}>
                    <option value="project">Project</option>
                    <option value="study">Study</option>
                    <option value="research">Research</option>
                    <option value="product">Product</option>
                  </select>
                  <select value={projectForm.status} onChange={(event) => setProjectForm((form) => ({ ...form, status: event.target.value }))}>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div className="form-row">
                  <input type="date" value={projectForm.periodStart} onChange={(event) => setProjectForm((form) => ({ ...form, periodStart: event.target.value }))} />
                  <input type="date" value={projectForm.periodEnd} onChange={(event) => setProjectForm((form) => ({ ...form, periodEnd: event.target.value }))} />
                </div>
                <button className="action-button compact" type="submit">
                  <Plus aria-hidden="true" />
                  추가
                </button>
              </form>
            ) : (
              <p className="muted">Admin 권한으로 로그인하면 GitHub repo 기반 프로젝트를 추가할 수 있습니다.</p>
            )}
          </section>

          <section>
            <div className="home-section-head">
              <div>
                <span className="eyebrow">Next</span>
                <h2>다가오는 세션</h2>
              </div>
              <CalendarDays aria-hidden="true" />
            </div>
            <div className="home-mini-list">
              {data.sessions.slice(0, 3).map((sessionItem) => (
                <article key={sessionItem.id}>
                  <strong>{sessionItem.title}</strong>
                  <span>{formatDate(sessionItem.date)} · {memberName(data, sessionItem.ownerId)}</span>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="home-section-head">
              <div>
                <span className="eyebrow">Knowledge</span>
                <h2>최근 기록</h2>
              </div>
              <BookOpen aria-hidden="true" />
            </div>
            <div className="home-mini-list">
              {recentLogs.map((log) => (
                <article key={log.id}>
                  <strong>{log.title}</strong>
                  <span>{log.type} · {formatDate(log.date)}</span>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="home-section-head">
              <div>
                <span className="eyebrow">Archive</span>
                <h2>아카이브 상태</h2>
              </div>
              <Archive aria-hidden="true" />
            </div>
            <div className="home-mini-list">
              {data.archive.map((item) => (
                <article key={item.id}>
                  <strong>{item.status}</strong>
                  <span>{item.missing.length} required items remaining</span>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function formatPeriod(period) {
  if (!period?.start || !period?.end) return "기간 미정";
  return `${formatDate(period.start)} - ${formatDate(period.end)}`;
}
