"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";

const SERIES_COLORS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#e11d48"];

function clampNum(val, min, max, fallback = 0) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function normalizeEntry(entry) {
  const dims = entry?.dimensions || {};
  const trials = Array.isArray(entry?.trials) ? entry.trials : [];
  const totalFallbacks = trials.reduce((acc, item) => acc + clampNum(item?.stats?.fallback_count, 0, 10000, 0), 0);
  const totalTurns = trials.reduce((acc, item) => acc + clampNum(item?.stats?.total_turns, 0, 10000, 0), 0);
  const scoreMean = Number(clampNum(entry?.score_mean ?? entry?.composite_score, 0, 100, 0).toFixed(1));
  const scoreMedian = Number(clampNum(entry?.score_median ?? scoreMean, 0, 100, scoreMean).toFixed(1));
  const latMean = Number(clampNum(entry?.latency_mean, 0, 3600, 0).toFixed(2));
  const latMedian = Number(clampNum(entry?.latency_median ?? latMean, 0, 3600, latMean).toFixed(2));

  return {
    id: String(entry?.id || entry?.name || ""),
    name: String(entry?.name || "Agent"),
    archetypeName: String(entry?.archetype_name || entry?.category || "Agent"),
    vendor: String(entry?.vendor || "Unknown"),
    modelRaw: String(entry?.model_raw || ""),
    settingProfile: String(entry?.setting_profile || "default"),
    settingLabel: String(entry?.setting_label || (entry?.setting_profile === "default" ? "Default" : entry?.setting_profile || "Default")),
    personaSummary: String(entry?.persona_summary || ""),
    trialsCount: Math.round(clampNum(entry?.trials_count ?? trials.length, 1, 500, 1)),
    scoreMean,
    scoreMedian,
    latMean,
    latMedian,
    totalFallbacks,
    totalTurns,
    winRate: {
      mafiaPct: Number(clampNum(entry?.win_rate?.mafia_pct, 0, 100, 0).toFixed(1)),
      citizenPct: Number(clampNum(entry?.win_rate?.citizen_pct, 0, 100, 0).toFixed(1)),
    },
    tokenUsage: {
      avgInput: Math.round(clampNum(entry?.token_usage?.avg_input, 0, 10000000, 0)),
      avgOutput: Math.round(clampNum(entry?.token_usage?.avg_output, 0, 10000000, 0)),
      avgTotal: Math.round(clampNum(entry?.token_usage?.avg_total, 0, 10000000, 0)),
    },
    dimensions: {
      social: Number(clampNum(dims.social_deduction, 0, 100, 0).toFixed(1)),
      persona: Number(clampNum(dims.persona_fidelity, 0, 100, 0).toFixed(1)),
      reasoning: Number(clampNum(dims.reasoning_depth, 0, 100, 0).toFixed(1)),
      intent: Number(clampNum(dims.intent_alignment, 0, 100, 0).toFixed(1)),
      memory: Number(clampNum(dims.memory_integrity, 0, 100, 0).toFixed(1)),
      economy: Number(clampNum(dims.token_economy, 0, 100, 0).toFixed(1)),
    },
    trials,
  };
}

function tierClass(val) {
  if (val >= 80) return "tier-high";
  if (val < 55) return "tier-low";
  return "";
}

export function BenchmarkViewer({ initialData = null, embedded = false }) {
  const [liveData, setLiveData] = useState(initialData);

  useEffect(() => {
    if (initialData && Array.isArray(initialData.leaderboard) && initialData.leaderboard.length > 0) return;
    let alive = true;
    fetch("/api/benchmark", { cache: "no-store" })
      .then((res) => res.json())
      .then((payload) => {
        if (alive && payload) setLiveData(payload);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initialData]);

  const dataSource = liveData || initialData;
  const entries = useMemo(
    () => (Array.isArray(dataSource?.leaderboard) ? dataSource.leaderboard.map(normalizeEntry) : []),
    [dataSource],
  );
  const [view, setView] = useState("table");
  const [scoreMode, setScoreMode] = useState("mean");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState(null);
  const [trialIdx, setTrialIdx] = useState(0);

  const vendors = useMemo(() => {
    const map = new Map();
    entries.forEach((item) => map.set(item.vendor, (map.get(item.vendor) || 0) + 1));
    return [...map.entries()];
  }, [entries]);

  const profiles = useMemo(() => {
    const map = new Map();
    entries.forEach((item) => map.set(item.settingProfile, item.settingLabel));
    return [...map.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((item) => {
      if (vendorFilter !== "all" && item.vendor !== vendorFilter) return false;
      if (profileFilter !== "all" && item.settingProfile !== profileFilter) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.archetypeName.toLowerCase().includes(q) ||
        item.modelRaw.toLowerCase().includes(q) ||
        item.settingLabel.toLowerCase().includes(q)
      );
    });

    const valueOf = (item) => {
      switch (sortCol) {
        case "social": return item.dimensions.social;
        case "persona": return item.dimensions.persona;
        case "reasoning": return item.dimensions.reasoning;
        case "intent": return item.dimensions.intent;
        case "memory": return item.dimensions.memory;
        case "economy": return item.dimensions.economy;
        case "latency": return scoreMode === "median" ? item.latMedian : item.latMean;
        default: return scoreMode === "median" ? item.scoreMedian : item.scoreMean;
      }
    };

    return [...list].sort((a, b) => {
      const diff = valueOf(a) - valueOf(b);
      return sortAsc ? diff : -diff;
    });
  }, [entries, profileFilter, query, scoreMode, sortAsc, sortCol, vendorFilter]);

  const topEntry = filtered[0] || entries[0];
  const uniqueModels = useMemo(() => new Set(entries.map((item) => item.modelRaw || item.vendor)).size, [entries]);
  const totalFallbacks = useMemo(() => entries.reduce((sum, item) => sum + item.totalFallbacks, 0), [entries]);
  const totalTurns = useMemo(() => entries.reduce((sum, item) => sum + item.totalTurns, 0), [entries]);
  const reliabilityPct = totalTurns > 0 ? (((totalTurns - totalFallbacks) / totalTurns) * 100).toFixed(1) : "100.0";

  function onSort(col) {
    if (sortCol === col) {
      setSortAsc((prev) => !prev);
    } else {
      setSortCol(col);
      setSortAsc(col === "latency");
    }
  }

  function openInspector(item) {
    setSelected(item);
    setTrialIdx(0);
  }

  const activeTrial = selected?.trials?.[trialIdx] || null;

  const Wrapper = embedded ? "div" : "main";

  return (
    <Wrapper className={embedded ? "v2-bench-embedded" : "route-shell bench-shell"}>
      {!embedded && (
        <header className="bench-masthead">
          <div>
            <div className="eyebrow">TEAM-ASP · V3 6D SOCIAL DEDUCTION RUBRIC</div>
            <h1>Mafia AI Agent Benchmark</h1>
            <p>
              santamkj (643d3a4) + Option B 테스트베드에서 측정된 멀티모델 × 에이전트 세팅 6차원 정량 평가 대시보드입니다.
            </p>
          </div>
          <div className="bench-masthead-actions">
            <Link href="/" className="subtle-button">
              <ArrowLeft size={14} aria-hidden="true" />
              Hub로 돌아가기
            </Link>
          </div>
        </header>
      )}

      <section className="bench-kpi-strip" aria-label="Benchmark Summary">
        <article>
          <span>Evaluated Entries</span>
          <strong className="mono">{entries.length}</strong>
          <small>{uniqueModels} model(s) · {profiles.length} setting(s)</small>
        </article>
        <article>
          <span>Top Ranked</span>
          <strong className="bench-kpi-title">{topEntry ? `${topEntry.archetypeName} · ${topEntry.modelRaw}` : "-"}</strong>
          <small className="mono">
            {topEntry ? `${scoreMode.toUpperCase()} ${(scoreMode === "median" ? topEntry.scoreMedian : topEntry.scoreMean).toFixed(1)} · ${topEntry.settingLabel}` : "-"}
          </small>
        </article>
        <article>
          <span>Schema Reliability</span>
          <strong className="mono">{reliabilityPct}%</strong>
          <small>{totalFallbacks} fallbacks / {totalTurns} turns</small>
        </article>
        <article>
          <span>Last Synced</span>
          <strong className="mono">{dataSource?.generated_at ? dataSource.generated_at.slice(0, 10) : "-"}</strong>
          <small>V3 6D · Free Vercel Hosting</small>
        </article>
      </section>

      <section className="bench-toolbar">
        <div className="bench-toolbar-left">
          <div className="segmented-control" role="tablist">
            <button type="button" className={view === "table" ? "active" : ""} onClick={() => setView("table")}>Leaderboard</button>
            <button type="button" className={view === "radar" ? "active" : ""} onClick={() => setView("radar")}>6D Radar</button>
          </div>
          <div className="segmented-control">
            <button type="button" className={scoreMode === "mean" ? "active" : ""} onClick={() => setScoreMode("mean")}>Mean</button>
            <button type="button" className={scoreMode === "median" ? "active" : ""} onClick={() => setScoreMode("median")}>Median</button>
          </div>
        </div>

        <div className="bench-toolbar-right">
          <div className="chip-row">
            <button type="button" className={`filter-chip ${vendorFilter === "all" ? "active" : ""}`} onClick={() => setVendorFilter("all")}>
              All ({entries.length})
            </button>
            {vendors.map(([vendor, count]) => (
              <button key={vendor} type="button" className={`filter-chip ${vendorFilter === vendor ? "active" : ""}`} onClick={() => setVendorFilter(vendor)}>
                {vendor} ({count})
              </button>
            ))}
          </div>

          <select className="compact-select" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} aria-label="Setting filter">
            <option value="all">All Settings</option>
            {profiles.map(([id, label]) => (
              <option key={id} value={id}>Setting: {label}</option>
            ))}
          </select>

          <input
            type="search"
            className="compact-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="모델 · 아키타입 · 세팅 검색..."
            aria-label="Search benchmark entries"
          />
        </div>
      </section>

      {view === "table" ? (
        <section className="bench-panel">
          <div className="md-table-scroll">
            <table className="bench-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Model &amp; Archetype</th>
                  <th className="num sortable" onClick={() => onSort("score")}>Score{sortCol === "score" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("social")}>Social{sortCol === "social" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("persona")}>Persona{sortCol === "persona" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("reasoning")}>Reason{sortCol === "reasoning" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("intent")}>Intent{sortCol === "intent" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("memory")}>Memory{sortCol === "memory" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num sortable" onClick={() => onSort("economy")}>Economy{sortCol === "economy" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                  <th className="num">Win Rate</th>
                  <th className="num sortable" onClick={() => onSort("latency")}>Latency{sortCol === "latency" ? (sortAsc ? " ↑" : " ↓") : ""}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const score = scoreMode === "median" ? item.scoreMedian : item.scoreMean;
                  const lat = scoreMode === "median" ? item.latMedian : item.latMean;
                  const winLabel = item.winRate.mafiaPct > 0 ? `M ${item.winRate.mafiaPct}%` : `C ${item.winRate.citizenPct}%`;
                  return (
                    <tr key={item.id} onClick={() => openInspector(item)}>
                      <td className="mono muted-num">{String(idx + 1).padStart(2, "0")}</td>
                      <td>
                        <div className="bench-entity">
                          <div className="bench-entity-top">
                            <strong>{item.archetypeName}</strong>
                            <span className="v2-tag accent mono">{item.settingLabel}</span>
                            <span className="v2-tag mono">{item.trialsCount}T</span>
                          </div>
                          <div className="bench-entity-sub">
                            <span className="mono">{item.modelRaw || item.name}</span>
                            <span>·</span>
                            <span>{item.vendor}</span>
                          </div>
                        </div>
                      </td>
                      <td className="num mono"><strong>{score.toFixed(1)}</strong></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.social)}`}>{item.dimensions.social.toFixed(1)}</span></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.persona)}`}>{item.dimensions.persona.toFixed(1)}</span></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.reasoning)}`}>{item.dimensions.reasoning.toFixed(1)}</span></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.intent)}`}>{item.dimensions.intent.toFixed(1)}</span></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.memory)}`}>{item.dimensions.memory.toFixed(1)}</span></td>
                      <td className="num"><span className={`dim-pill mono ${tierClass(item.dimensions.economy)}`}>{item.dimensions.economy.toFixed(1)}</span></td>
                      <td className="num mono">{winLabel}</td>
                      <td className="num mono">{lat.toFixed(1)}s</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={11} style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>
                      조건에 맞는 벤치마크 항목이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="bench-panel bench-radar-panel">
          <div className="bench-radar-wrap">
            <RadarSvg entries={filtered.slice(0, 5)} />
          </div>
          <div className="bench-radar-legend">
            {filtered.slice(0, 5).map((item, idx) => (
              <div key={item.id} className="bench-legend-item">
                <span className="bench-legend-swatch" style={{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }} />
                <span>{item.archetypeName} · <code className="mono">{item.modelRaw}</code> ({item.settingLabel})</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {selected && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <aside className="v2-drawer" role="dialog" aria-modal="true" aria-label="벤치마크 상세">
            <header className="v2-drawer-head">
              <div>
                <span className="eyebrow mono">{selected.vendor} · {selected.modelRaw} · {selected.settingLabel}</span>
                <h2>{selected.archetypeName}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelected(null)} aria-label="닫기">
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <div className="v2-drawer-body">
              <div className="chip-row" style={{ marginBottom: "14px" }}>
                {selected.trials.map((t, idx) => (
                  <button key={t.session_id || idx} type="button" className={`filter-chip mono ${idx === trialIdx ? "active" : ""}`} onClick={() => setTrialIdx(idx)}>
                    T{idx + 1} · {t.winner || "END"}
                  </button>
                ))}
              </div>
              <div className="bench-detail-grid">
                <div><span>Trial Score</span><strong className="mono">{activeTrial?.composite_score ?? selected.scoreMean}</strong></div>
                <div><span>Social / Persona</span><strong className="mono">{selected.dimensions.social} / {selected.dimensions.persona}</strong></div>
                <div><span>Reason / Intent</span><strong className="mono">{selected.dimensions.reasoning} / {selected.dimensions.intent}</strong></div>
                <div><span>Memory / Economy</span><strong className="mono">{selected.dimensions.memory} / {selected.dimensions.economy}</strong></div>
              </div>
              {activeTrial && (
                <div className="bench-kv">
                  <div><span>Session</span><code className="mono">{activeTrial.session_id} (seed {activeTrial.seed}, {activeTrial.days}d)</code></div>
                  <div><span>V3 Diagnostics</span><code className="mono">Clues {activeTrial.stats?.distinct_clues ?? "-"} · Hallucinations {activeTrial.stats?.spatial_hallucinations ?? 0} · CoT Refs {activeTrial.stats?.avg_other_refs_in_cot ?? "-"} · Fallbacks {activeTrial.stats?.fallback_count ?? 0}</code></div>
                  <div><span>Tokens</span><code className="mono">{selected.tokenUsage.avgTotal} tok/turn (In {selected.tokenUsage.avgInput} / Out {selected.tokenUsage.avgOutput})</code></div>
                </div>
              )}
              <div className="bench-transcripts">
                <h3>Decision Transcript &amp; CoT</h3>
                {(activeTrial?.sample_dialogues || []).map((item, idx) => (
                  <article key={idx} className="bench-transcript-card">
                    <div className="bench-transcript-meta">
                      <strong>{item.speakerId}</strong>
                      <span className="mono">Day {item.day} · {item.phase}</span>
                    </div>
                    {item.intent && <div className="bench-transcript-intent">Intent: {item.intent}</div>}
                    <p>&ldquo;{item.content}&rdquo;</p>
                    {item.reasoning && <div className="bench-transcript-cot"><strong>CoT:</strong> {item.reasoning}</div>}
                  </article>
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </Wrapper>
  );
}

function RadarSvg({ entries }) {
  const axes = [
    { key: "social", label: "Social" },
    { key: "persona", label: "Persona" },
    { key: "reasoning", label: "Reasoning" },
    { key: "intent", label: "Intent" },
    { key: "memory", label: "Memory" },
    { key: "economy", label: "Economy" },
  ];
  const cx = 240;
  const cy = 205;
  const radius = 148;
  const step = (Math.PI * 2) / axes.length;

  return (
    <svg viewBox="0 0 480 410" className="bench-radar-svg" aria-label="6D Performance Radar">
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((lvl) => {
        const pts = axes
          .map((_, i) => {
            const a = i * step - Math.PI / 2;
            return `${(cx + radius * lvl * Math.cos(a)).toFixed(1)},${(cy + radius * lvl * Math.sin(a)).toFixed(1)}`;
          })
          .join(" ");
        return <polygon key={lvl} points={pts} fill="none" stroke="var(--line)" strokeWidth="1" />;
      })}
      {axes.map((axis, i) => {
        const a = i * step - Math.PI / 2;
        const x2 = cx + radius * Math.cos(a);
        const y2 = cy + radius * Math.sin(a);
        const lx = cx + (radius + 24) * Math.cos(a);
        const ly = cy + (radius + 24) * Math.sin(a);
        const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
        return (
          <g key={axis.key}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--line)" strokeWidth="1" />
            <text x={lx} y={ly} fill="var(--muted)" fontSize="11.5" fontWeight="600" textAnchor={anchor} dominantBaseline="central">
              {axis.label}
            </text>
          </g>
        );
      })}
      {entries.map((entry, idx) => {
        const color = SERIES_COLORS[idx % SERIES_COLORS.length];
        const pts = axes
          .map((axis, i) => {
            const val = Math.max(0.05, Math.min(1, (entry.dimensions[axis.key] || 0) / 100));
            const a = i * step - Math.PI / 2;
            return `${(cx + radius * val * Math.cos(a)).toFixed(1)},${(cy + radius * val * Math.sin(a)).toFixed(1)}`;
          })
          .join(" ");
        return <polygon key={entry.id} points={pts} fill={color} fillOpacity="0.12" stroke={color} strokeWidth="2" strokeLinejoin="round" />;
      })}
    </svg>
  );
}
