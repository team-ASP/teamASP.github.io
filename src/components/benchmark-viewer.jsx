"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { formatBenchmarkIdentity } from "@/lib/benchmark-format";

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
  const identity = formatBenchmarkIdentity(entry);

  return {
    id: String(entry?.id || entry?.name || ""),
    name: String(entry?.name || "Agent"),
    archetypeId: String(entry?.archetype_id || ""),
    archetypeName: String(entry?.archetype_name || entry?.category || "Agent"),
    mainTitle: identity.mainTitle,
    subtitle: identity.subtitle,
    modelShort: identity.modelShort,
    settingShort: identity.settingShort,
    settingDetail: identity.settingDetail,
    roleTag: identity.roleTag,
    isMafiaRole: identity.isMafiaRole,
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
  const [hoveredRadarId, setHoveredRadarId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [trialIdx, setTrialIdx] = useState(0);

  const vendors = useMemo(() => {
    const map = new Map();
    entries.forEach((item) => map.set(item.vendor, (map.get(item.vendor) || 0) + 1));
    return [...map.entries()];
  }, [entries]);

  const profiles = useMemo(() => {
    const map = new Map();
    entries.forEach((item) => map.set(item.settingProfile, item.settingDetail));
    return [...map.entries()];
  }, [entries]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = entries.filter((item) => {
      if (vendorFilter !== "all" && item.vendor !== vendorFilter) return false;
      if (profileFilter !== "all" && item.settingProfile !== profileFilter) return false;
      if (!q) return true;
      return (
        item.mainTitle.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.archetypeName.toLowerCase().includes(q) ||
        item.vendor.toLowerCase().includes(q) ||
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
  const radarEntries = filtered.slice(0, 5);

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
          <span>Top Ranked Experiment</span>
          <strong className="bench-kpi-title" title={topEntry?.mainTitle}>{topEntry ? topEntry.mainTitle : "-"}</strong>
          <small className="mono">
            {topEntry ? `${scoreMode.toUpperCase()} ${(scoreMode === "median" ? topEntry.scoreMedian : topEntry.scoreMean).toFixed(1)} · ${topEntry.modelRaw}` : "-"}
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
            <option value="all">모든 실험 세팅</option>
            {profiles.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>

          <input
            type="search"
            className="compact-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="실험명 · 모델 · 파일명 검색..."
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
                  <th>Experiment Title &amp; Agent File</th>
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
                            <strong className="bench-main-title">{item.mainTitle}</strong>
                            <span className={`v2-tag ${item.isMafiaRole ? "role-mafia" : "role-citizen"}`}>{item.roleTag}</span>
                            <span className="v2-tag mono">{item.trialsCount}T</span>
                          </div>
                          <div className="bench-entity-sub mono" title={item.subtitle}>
                            {item.subtitle}
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
          <div className="bench-radar-studio">
            <div className="bench-radar-stage">
              <div className="bench-radar-stage-head">
                <span className="v2-eyebrow">6D CAPABILITY COMPARISON (TOP 5 FILTERED)</span>
                <span className="v2-muted">범례에 마우스를 올리면 해당 실험 폴리곤이 강조되고, 클릭하면 CoT 상세가 열립니다.</span>
              </div>
              <RadarSvg entries={radarEntries} hoveredId={hoveredRadarId} />
            </div>

            <div className="bench-radar-sidebar">
              {radarEntries.map((item, idx) => {
                const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                const score = scoreMode === "median" ? item.scoreMedian : item.scoreMean;
                const isHighlighted = hoveredRadarId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`bench-legend-card${isHighlighted ? " active" : ""}`}
                    onMouseEnter={() => setHoveredRadarId(item.id)}
                    onMouseLeave={() => setHoveredRadarId(null)}
                    onClick={() => openInspector(item)}
                  >
                    <div className="bench-legend-card-head">
                      <span className="bench-legend-swatch" style={{ background: color }} />
                      <strong className="bench-legend-title">{item.mainTitle}</strong>
                      <span className="bench-legend-score mono">{score.toFixed(1)}</span>
                    </div>
                    <div className="bench-legend-sub mono">{item.subtitle}</div>
                    <div className="bench-legend-dims mono">
                      <span>SOC {item.dimensions.social.toFixed(0)}</span>
                      <span>PER {item.dimensions.persona.toFixed(0)}</span>
                      <span>RSN {item.dimensions.reasoning.toFixed(0)}</span>
                      <span>INT {item.dimensions.intent.toFixed(0)}</span>
                      <span>MEM {item.dimensions.memory.toFixed(0)}</span>
                      <span>ECO {item.dimensions.economy.toFixed(0)}</span>
                    </div>
                  </button>
                );
              })}
              {radarEntries.length === 0 && (
                <p className="v2-muted" style={{ padding: "12px" }}>표시할 벤치마크 항목이 없습니다.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {selected && (
        <div className="v2-drawer-backdrop" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
          <aside className="v2-drawer" role="dialog" aria-modal="true" aria-label="벤치마크 상세">
            <header className="v2-drawer-head">
              <div>
                <span className="eyebrow mono">{selected.subtitle}</span>
                <h2>{selected.mainTitle}</h2>
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
                  <div><span>Setting</span><code className="mono">{selected.settingDetail} ({selected.settingProfile})</code></div>
                  <div><span>Persona</span><span>{selected.personaSummary || selected.archetypeName}</span></div>
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

function RadarSvg({ entries, hoveredId }) {
  const axes = [
    { key: "social", label: "Social", sub: "사회적 추리력" },
    { key: "persona", label: "Persona", sub: "페르소나 일관성" },
    { key: "reasoning", label: "Reasoning", sub: "추론 심도" },
    { key: "intent", label: "Intent", sub: "의도 정합성" },
    { key: "memory", label: "Memory", sub: "기억 격리도" },
    { key: "economy", label: "Economy", sub: "토큰 경제성" },
  ];
  const cx = 340;
  const cy = 280;
  const radius = 212;
  const step = (Math.PI * 2) / axes.length;

  return (
    <svg viewBox="0 0 680 560" className="bench-radar-svg" aria-label="6D Performance Radar">
      {[0.2, 0.4, 0.6, 0.8, 1.0].map((lvl) => {
        const pts = axes
          .map((_, i) => {
            const a = i * step - Math.PI / 2;
            return `${(cx + radius * lvl * Math.cos(a)).toFixed(1)},${(cy + radius * lvl * Math.sin(a)).toFixed(1)}`;
          })
          .join(" ");
        return (
          <g key={lvl}>
            <polygon points={pts} fill="none" stroke="var(--line)" strokeWidth={lvl === 1 ? "1.35" : "1"} strokeDasharray={lvl === 1 ? undefined : "3 3"} />
            <text x={cx + 6} y={cy - radius * lvl + 4} fill="var(--muted)" fontSize="10.5" fontFamily="ui-monospace, monospace">
              {Math.round(lvl * 100)}
            </text>
          </g>
        );
      })}
      {axes.map((axis, i) => {
        const a = i * step - Math.PI / 2;
        const x2 = cx + radius * Math.cos(a);
        const y2 = cy + radius * Math.sin(a);
        const lx = cx + (radius + 32) * Math.cos(a);
        const ly = cy + (radius + 32) * Math.sin(a);
        const anchor = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle";
        return (
          <g key={axis.key}>
            <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--line-strong)" strokeWidth="1" />
            <text x={lx} y={ly - 6} fill="var(--text)" fontSize="13.5" fontWeight="700" textAnchor={anchor} dominantBaseline="central">
              {axis.label}
            </text>
            <text x={lx} y={ly + 11} fill="var(--muted)" fontSize="11" fontWeight="500" textAnchor={anchor} dominantBaseline="central">
              {axis.sub}
            </text>
          </g>
        );
      })}
      {entries.map((entry, idx) => {
        const color = SERIES_COLORS[idx % SERIES_COLORS.length];
        const dimmed = hoveredId && hoveredId !== entry.id;
        const emphasized = hoveredId === entry.id;
        const coords = axes.map((axis, i) => {
          const val = Math.max(0.05, Math.min(1, (entry.dimensions[axis.key] || 0) / 100));
          const a = i * step - Math.PI / 2;
          return {
            x: cx + radius * val * Math.cos(a),
            y: cy + radius * val * Math.sin(a),
          };
        });
        const pts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
        return (
          <g key={entry.id} style={{ transition: "opacity 0.16s ease" }} opacity={dimmed ? 0.16 : 1}>
            <polygon
              points={pts}
              fill={color}
              fillOpacity={emphasized ? "0.22" : "0.11"}
              stroke={color}
              strokeWidth={emphasized ? "3" : "2.1"}
              strokeLinejoin="round"
            />
            {coords.map((c, ci) => (
              <circle key={ci} cx={c.x} cy={c.y} r={emphasized ? "4.8" : "3.6"} fill={color} stroke="var(--panel)" strokeWidth="1.5" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
