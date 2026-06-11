"use client";

import { Archive, ArrowRight, BookOpen, CalendarDays, Github, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function formatDate(date) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(date));
}

function memberName(data, id) {
  return data.members.find((member) => member.id === id)?.name || id;
}

export function StudyHub({ data }) {
  const [query, setQuery] = useState("");
  const projects = useMemo(
    () =>
      data.projects.filter((project) =>
        `${project.title} ${project.summary} ${project.status}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [data.projects, query],
  );
  const recentLogs = data.logs.slice(0, 3);

  return (
    <main className="home-shell">
      <header className="home-header">
        <div>
          <span className="eyebrow">{data.team.org}</span>
          <h1>Project Memory for ASP</h1>
          <p>프로젝트별 백로그, 진행 로그, 의사결정, 발표 자료, 아카이브를 한 곳에 남기는 팀 운영 허브입니다.</p>
        </div>
        <a className="home-github-link" href={data.team.githubOrgUrl} target="_blank" rel="noreferrer">
          <Github aria-hidden="true" />
          GitHub
        </a>
      </header>

      <section className="home-toolbar">
        <label className="home-search">
          <Search aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="프로젝트 검색" />
        </label>
        <div className="home-metrics" aria-label="Project metrics">
          <span>{data.projects.length} projects</span>
          <span>{data.tasks.length} backlog items</span>
          <span>{data.logs.length} logs</span>
        </div>
      </section>

      <section className="home-layout">
        <div className="project-directory">
          <div className="home-section-head">
            <div>
              <span className="eyebrow">Projects</span>
              <h2>진행 중인 프로젝트</h2>
            </div>
          </div>
          {projects.map((project) => {
            const tasks = data.tasks.filter((task) => task.projectId === project.id);
            const logs = data.logs.filter((log) => log.projectId === project.id);
            return (
              <article key={project.id} className="project-row-card">
                <div>
                  <span className="project-status">{project.status}</span>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <div className="project-row-meta">
                    <span>{formatDate(project.period.start)} - {formatDate(project.period.end)}</span>
                    <span>{tasks.length} backlog</span>
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
        </div>

        <aside className="home-side">
          <section>
            <div className="home-section-head">
              <div>
                <span className="eyebrow">Next</span>
                <h2>다가오는 세션</h2>
              </div>
              <CalendarDays aria-hidden="true" />
            </div>
            <div className="home-mini-list">
              {data.sessions.slice(0, 3).map((session) => (
                <article key={session.id}>
                  <strong>{session.title}</strong>
                  <span>{formatDate(session.date)} · {memberName(data, session.ownerId)}</span>
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
