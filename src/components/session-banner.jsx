"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SessionBanner() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store", credentials: "same-origin" })
      .then((response) => response.json())
      .then((payload) => {
        if (alive) setSession(payload);
      })
      .catch(() => {
        if (alive) setSession({ authenticated: false, role: "viewer", authEnabled: true });
      });
    return () => {
      alive = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    window.location.assign("/");
  }

  const label = session?.authenticated ? `${session.name || session.login} · ${session.role}` : "Viewer";

  return (
    <div className="session-banner">
      <Link href="/" className="session-home">
        ASP Study Hub
      </Link>
      <div className="session-state" aria-live="polite">
        <span>{session ? label : "Session 확인 중"}</span>
        {session?.authenticated ? (
          <>
            <Link href="/workspace">Workspace</Link>
            {session.role === "admin" && <Link href="/admin/audit">Audit</Link>}
            <button type="button" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <a href="/api/auth/start">GitHub 로그인</a>
        )}
      </div>
    </div>
  );
}
