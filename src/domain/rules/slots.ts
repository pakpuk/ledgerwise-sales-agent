// Pure helpers: show slots with their timezone, and match "Tuesday works" to an offered slot.

import type { Slot } from "@/domain/entities";

export const DEFAULT_TZ = "America/New_York";

export function formatSlot(s: Pick<Slot, "start" | "timezone">): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: s.timezone,
    timeZoneName: "short",
  });
  return fmt.format(new Date(s.start));
}

export function slotsText(slots: Pick<Slot, "start" | "timezone">[]): string {
  return slots.map((s) => `- ${formatSlot(s)}`).join("\n");
}

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function partsIn(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", { weekday: "long", hour: "numeric", hour12: false, timeZone: tz }).formatToParts(d);
  return {
    weekday: (p.find((x) => x.type === "weekday")?.value ?? "").toLowerCase(),
    hour: Number(p.find((x) => x.type === "hour")?.value ?? 0) % 24,
  };
}

/**
 * Pick the offered slot the prospect most likely means. Returns null if ambiguous
 * (no day mentioned and more than one slot), so a human or a follow-up can clarify.
 */
export function matchSlot<T extends Pick<Slot, "start" | "timezone">>(offered: T[], text: string): T | null {
  const t = text.toLowerCase();
  const day = DAYS.find((d) => t.includes(d) || t.includes(d.slice(0, 3) + " ") || t.endsWith(d.slice(0, 3)));
  const wantsMorning = /\bmorning|\bam\b|\d\s?am\b/.test(t);
  const wantsAfternoon = /\bafternoon|\bpm\b|\d\s?pm\b/.test(t);
  const hourMatch = t.match(/\b(\d{1,2})(?::\d{2})?\s?(am|pm)\b/);
  const hour = hourMatch ? (Number(hourMatch[1]) % 12) + (hourMatch[2] === "pm" ? 12 : 0) : null;

  let candidates = offered.filter((s) => {
    const p = partsIn(new Date(s.start), s.timezone);
    if (day && p.weekday !== day) return false;
    if (hour !== null && p.hour !== hour) return false;
    if (wantsMorning && p.hour >= 12) return false;
    if (wantsAfternoon && p.hour < 12) return false;
    return true;
  });
  if (!day && hour === null && !wantsMorning && !wantsAfternoon) {
    if (/\b(first|earliest)\b/.test(t)) candidates = offered.slice(0, 1);
    else if (offered.length !== 1) return null;
  }
  return candidates.length >= 1 && (day || hour !== null || candidates.length === 1) ? candidates[0] : null;
}
