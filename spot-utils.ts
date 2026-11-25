import type { ExpiryPreset, MatchStatus, SpotStream } from "./spot-types";

export function ytId(url: string): string {
  const m = String(url).match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  );
  return m?.[1] ?? "";
}

export function isVideoUrl(url: string): boolean {
  return /\.(m3u8|mp4|webm|mpd)(\?|#|$)/i.test(url);
}

export function toEmbedUrl(url: string): string {
  const id = ytId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0` : url;
}

export function thumbOf(stream: Pick<SpotStream, "url" | "thumb">): string {
  if (stream.thumb) return stream.thumb;
  const id = ytId(stream.url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : "";
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function nameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return (last || parsed.host).slice(0, 40);
  } catch {
    return url.slice(0, 40);
  }
}

export interface ParsedStreamInput {
  title: string;
  league: string;
  url: string;
  thumb: string;
}

export function parseM3U(text: string): ParsedStreamInput[] {
  const out: ParsedStreamInput[] = [];
  let meta: { title: string; league: string; thumb: string } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("#EXTINF")) {
      const title = line.split(",").slice(1).join(",").trim();
      const league = line.match(/group-title="([^"]*)"/)?.[1] ?? "";
      const thumb = line.match(/tvg-logo="([^"]*)"/)?.[1] ?? "";
      meta = { title, league, thumb };
    } else if (/^https?:\/\//i.test(line)) {
      out.push({
        title: meta?.title || nameFromUrl(line),
        league: meta?.league || "",
        thumb: meta?.thumb || "",
        url: line,
      });
      meta = null;
    }
  }

  return out;
}

export function parseBulkStreams(text: string): ParsedStreamInput[] {
  if (/#EXTM3U|#EXTINF/i.test(text)) {
    return parseM3U(text);
  }
  const results: ParsedStreamInput[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split("|").map((p) => p.trim());
    const url = parts.find((p) => /^https?:\/\//i.test(p));
    if (!url) continue;
    const rest = parts.filter((p) => p !== url);
    results.push({
      title: rest[0] || nameFromUrl(url),
      league: rest[1] || "",
      thumb: "",
      url,
    });
  }
  return results;
}

export function isStreamActive(expiresAt: string | null, nowMs = Date.now()): boolean {
  if (!expiresAt) return true;
  const expMs = Date.parse(expiresAt);
  if (Number.isNaN(expMs)) return true;
  return expMs > nowMs;
}

export function computeExpiresAt(
  preset: ExpiryPreset,
  customLocalDateTime: string,
  nowMs = Date.now(),
): string | null {
  const minutesMap: Partial<Record<ExpiryPreset, number>> = {
    "30m": 30,
    "1h": 60,
    "2h": 120,
    "3h": 180,
    "6h": 360,
    "24h": 1440,
  };
  if (preset === "none") return null;
  if (preset === "custom") {
    if (!customLocalDateTime.trim()) return null;
    const parsed = new Date(customLocalDateTime);
    if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= nowMs) return null;
    return parsed.toISOString();
  }
  const mins = minutesMap[preset];
  if (!mins) return null;
  return new Date(nowMs + mins * 60_000).toISOString();
}

export function formatTimeRemaining(expiresAt: string | null, nowMs = Date.now()): string | null {
  if (!expiresAt) return null;
  const diffMs = Date.parse(expiresAt) - nowMs;
  if (Number.isNaN(diffMs)) return null;
  if (diffMs <= 0) return "منتهي الصلاحية";
  const totalMinutes = Math.ceil(diffMs / 60_000);
  if (totalMinutes < 60) return `يُحذف خلال ${totalMinutes} د`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) return mins > 0 ? `يُحذف خلال ${hours} س ${mins} د` : `يُحذف خلال ${hours} س`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `يُحذف خلال ${days} ي ${remHours} س` : `يُحذف خلال ${days} يوم`;
}

export function formatMatchDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ar", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function matchStatusLabel(status: MatchStatus): string {
  if (status === "live") return "مباشر الآن";
  if (status === "finished") return "انتهت";
  return "قادمة";
}

export function parseOptionalScore(raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) return { value: null, error: "النتيجة يجب أن تكون رقماً صحيحاً غير سالب" };
  const num = Number(trimmed);
  if (num < 0 || num > 99) return { value: null, error: "النتيجة يجب أن تكون بين 0 و 99" };
  return { value: num };
}

export function translateAuthError(message?: string): string {
  const lower = (message ?? "").toLowerCase();
  if (lower.includes("invalid login credentials")) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
  if (lower.includes("email not confirmed")) return "يرجى تأكيد بريدك الإلكتروني أولاً من الرابط المرسل إليك";
  if (lower.includes("already registered") || lower.includes("already exists")) return "هذا البريد مسجّل مسبقاً";
  if (lower.includes("password should be at least")) return "كلمة المرور ضعيفة (6 أحرف على الأقل)";
  if (lower.includes("invalid email")) return "البريد الإلكتروني غير صالح";
  if (lower.includes("rate limit") || lower.includes("too many")) return "محاولات كثيرة، يرجى المحاولة لاحقاً";
  return "تعذّر إتمام الطلب، حاول مرة أخرى";
}