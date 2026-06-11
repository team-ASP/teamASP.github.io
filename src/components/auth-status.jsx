"use client";

import { useEffect, useState } from "react";

export function AuthStatus() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload) => {
        if (alive) setSession(payload);
      })
      .catch(() => {
        if (alive) setSession({ authenticated: false, role: "viewer" });
      });
    return () => {
      alive = false;
    };
  }, []);

  async function logout(event) {
    event.preventDefault();
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    window.location.assign("/");
  }

  if (!session) {
    return (
      <section className="panel">
        <span className="eyebrow">Session</span>
        <p>권한 정보를 확인하는 중입니다.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <span className="eyebrow">Session</span>
      <h2>{session.authenticated ? `${session.name || session.login} · ${session.role}` : "Viewer"}</h2>
      <p>
        {session.authenticated
          ? `${session.organization} 멤버로 인증되었습니다.`
          : session.authEnabled
            ? "GitHub 로그인 후 팀원 편집 기능을 사용할 수 있습니다."
            : "GitHub auth 환경 변수가 아직 활성화되지 않았습니다."}
      </p>
      <div className="hero-actions">
        {!session.authenticated && (
          <a className="icon-link primary-link" href="/api/auth/start">
            GitHub 로그인
          </a>
        )}
        {session.authenticated && (
          <form onSubmit={logout}>
            <button className="action-button secondary" type="submit">
              로그아웃
            </button>
          </form>
        )}
      </div>
      {session.editableScopes?.length > 0 && <p className="muted">Scopes: {session.editableScopes.join(", ")}</p>}
    </section>
  );
}
