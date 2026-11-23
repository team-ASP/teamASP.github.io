const MODEL_DISPLAY_MAP = {
  "gemini-3.5-flash-lite": "Gemini 3.5 Lite",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-3.1-flash-lite-preview": "Gemini 3.1 Lite",
  "gemini-3.8-flash": "Gemini 3.8 Flash",
  "gemini-4-hydrogen": "Gemini 4 Hydrogen",
  "qwen2.5:7b": "Qwen 2.5 7B (Local)",
  "gemma4:12b": "Gemma 4 12B (Local)",
};

const SETTING_DISPLAY_MAP = {
  mafia_c1_detective: { short: "역할반전", detail: "역할반전 · 탐정=마피아" },
  logic_t02: { short: "저온논리 T=0.2", detail: "저온 논리 추론 (T=0.2)" },
  std_t07: { short: "표준 T=0.7", detail: "표준 균형 추론 (T=0.7)" },
  default: { short: "기본 기준선", detail: "기본 기준선 (Multi-Trial)" },
};

export function prettifyModelName(modelRaw) {
  const raw = String(modelRaw || "").trim();
  if (!raw) return "Unknown Model";
  if (MODEL_DISPLAY_MAP[raw]) return MODEL_DISPLAY_MAP[raw];
  return raw
    .replace(/-preview$/i, "")
    .split(/[-_]/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

export function extractAgentSlot(entry) {
  const id = String(entry?.id || "");
  const match = id.match(/(시민\d+|마피아\d*|agent[_-]?\d+)$/i);
  if (match) return match[1];
  const firstSpeaker = entry?.trials?.[0]?.sample_dialogues?.[0]?.speakerId;
  return firstSpeaker || "";
}

export function formatBenchmarkIdentity(entry) {
  const modelRaw = String(entry?.model_raw || entry?.modelRaw || "").trim();
  const settingProfile = String(entry?.setting_profile || entry?.settingProfile || "default").trim();
  const settingLabel = String(entry?.setting_label || entry?.settingLabel || settingProfile).trim();
  const archetypeId = String(entry?.archetype_id || entry?.archetypeId || "").trim();
  const archetypeName = String(entry?.archetype_name || entry?.archetypeName || "Agent").trim();
  const rawName = String(entry?.name || "");
  const slot = extractAgentSlot(entry);
  const firstSession = entry?.trials?.[0]?.session_id || "";

  const modelShort = prettifyModelName(modelRaw);
  const settingInfo = SETTING_DISPLAY_MAP[settingProfile] || {
    short: settingLabel || settingProfile,
    detail: settingLabel || settingProfile,
  };

  const isMafiaRole =
    rawName.includes("(Mafia)") ||
    (settingProfile === "mafia_c1_detective" ? slot === "시민1" : slot === "시민5") ||
    Number(entry?.win_rate?.mafia_pct ?? entry?.winRate?.mafiaPct ?? 0) > 0;

  let roleTitle = archetypeName;
  if (settingProfile === "mafia_c1_detective" && slot === "시민1") {
    roleTitle = "마피아 (탐정 위장)";
  } else if (settingProfile === "mafia_c1_detective" && slot === "시민5") {
    roleTitle = "여론 조작형 (시민 전환)";
  } else if (isMafiaRole) {
    roleTitle = archetypeName.includes("마피아") ? archetypeName : `${archetypeName} (마피아)`;
  } else {
    roleTitle = `${archetypeName} (시민)`;
  }

  const mainTitle = `[${settingInfo.short}] ${modelShort} · ${roleTitle}`;
  const fileOrSession = firstSession || String(entry?.id || "");
  const agentTag = [slot, archetypeId].filter(Boolean).join(" / ");
  const subtitle = [fileOrSession, modelRaw, agentTag].filter(Boolean).join(" · ");

  return {
    mainTitle,
    subtitle,
    modelShort,
    settingShort: settingInfo.short,
    settingDetail: settingInfo.detail,
    roleTag: isMafiaRole ? "Mafia" : "Citizen",
    isMafiaRole,
    slot,
  };
}
