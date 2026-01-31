import { AbuseFlags, Difficulty } from "./types";

const WORLDVIEW_KEYWORDS = [
  "近未来",
  "異世界",
  "中世",
  "魔法",
  "宇宙",
  "サイバー",
  "未来",
  "未来都市",
  "steam",
  "steampunk",
];

const INJECTION_KEYWORDS = [
  "system prompt",
  "システムプロンプト",
  "truth table",
  "真実を出せ",
  "ルールを無視",
  "apiキー",
  "developer message",
  "あなたの指示",
  "メタ",
  "要約して",
  "解説して",
];

export function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\p{P}\p{S}]/gu, "")
    .replace(/(.)\1{3,}/g, "$1$1");
}

export function detectAbuse(input: string, lastHash?: string): {
  flags: AbuseFlags;
  hash: string;
} {
  const normalized = normalizeInput(input);
  const tooLong = input.length > 1000;
  const promptInjection = INJECTION_KEYWORDS.some((keyword) =>
    normalized.includes(normalizeInput(keyword))
  );
  const repetitive = lastHash ? lastHash === hashString(normalized) : false;
  const spam = input.length < 5 && !/\p{L}/u.test(input);
  const flags: AbuseFlags = {
    prompt_injection: promptInjection,
    spam,
    repetitive,
    too_long: tooLong,
  };
  return { flags, hash: hashString(normalized) };
}

export function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h${Math.abs(hash)}`;
}

export function worldExplainNeeded(worldview: string): boolean {
  const lowered = worldview.toLowerCase();
  return WORLDVIEW_KEYWORDS.some((keyword) =>
    lowered.includes(keyword.toLowerCase())
  );
}

export function difficultyConfig(difficulty: Difficulty): {
  turnLimit: number;
  suspectCount: number;
} {
  switch (difficulty) {
    case "Easy":
      return { turnLimit: 10, suspectCount: 1 };
    case "Normal":
      return { turnLimit: 10, suspectCount: 2 };
    case "Hard":
      return { turnLimit: 15, suspectCount: 3 };
    case "Expert":
      return { turnLimit: 20, suspectCount: 4 };
    default:
      return { turnLimit: 10, suspectCount: 2 };
  }
}

export function sanitizeKeyword(keyword?: string): string {
  if (!keyword) return "";
  return keyword.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 20);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
