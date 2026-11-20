"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_STORAGE_KEY = "asp_hub_theme";
const THEME_EVENT = "asp-hub-theme-change";

function subscribeTheme(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getThemeSnapshot() {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function SessionBanner() {
  const [session, setSession] = useState(null);
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", cache: "no-store", credentials: "same-origin" });
    window.location.assign("/");
  }

  const label = session?.authenticated ? `${session.name || session.login} · ${session.role}` : "Viewer";

  return (
    <div className="session-banner">
      <div className="session-brand-group">
        <Link href="/" className="session-home">
          ASP Study Hub
        </Link>
        <span className="session-version">v2</span>
        <nav className="session-quick-nav" aria-label="Primary hub navigation">
          <Link href="/workspace">Workspace</Link>
          <Link href="/benchmark">Benchmark</Link>
          <Link href="/archive">Archive</Link>
        </nav>
      </div>
      <div className="session-state" aria-live="polite">
        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label="테마 전환"
          title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        >
          {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <span className="session-actor">{session ? label : "Session 확인 중"}</span>
        {session?.authenticated ? (
          <>
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
