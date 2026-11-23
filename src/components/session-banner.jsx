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
    <header className="v2-topbar">
      <div className="v2-topbar-left">
        <Link href="/" className="v2-topbar-brand">
          <span className="v2-brand-mark">ASP</span>
          <span className="v2-brand-name">Study Hub</span>
        </Link>
        <span className="v2-version-pill mono">v2.0</span>
        <nav className="v2-topbar-links" aria-label="Quick tabs">
          <Link href="/?tab=overview">Overview</Link>
          <Link href="/?tab=agile">Agile</Link>
          <Link href="/?tab=kanban">Kanban</Link>
          <Link href="/?tab=docs">Docs</Link>
          <Link href="/?tab=benchmark">Benchmark</Link>
        </nav>
      </div>
      <div className="v2-topbar-right" aria-live="polite">
        <button
          type="button"
          className="v2-topbar-btn"
          onClick={toggleTheme}
          aria-label="테마 전환"
          title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
        >
          {theme === "dark" ? <Sun size={14} aria-hidden="true" /> : <Moon size={14} aria-hidden="true" />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <span className="v2-topbar-actor">{session ? label : "Checking…"}</span>
        {session?.authenticated ? (
          <>
            {session.role === "admin" && (
              <Link href="/admin/audit" className="v2-topbar-btn">
                Audit
              </Link>
            )}
            <button type="button" className="v2-topbar-btn" onClick={logout}>
              로그아웃
            </button>
          </>
        ) : (
          <a href="/api/auth/start" className="v2-topbar-btn primary">
            GitHub 로그인
          </a>
        )}
      </div>
    </header>
  );
}
