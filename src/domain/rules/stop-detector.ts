// Detects opt-out intent. Deliberately over-eager: a false positive only
// costs one lead, a false negative costs trust (and is a compliance risk).

const STOP_PATTERNS: RegExp[] = [
  /^\s*stop\b/i,
  /\bunsubscribe\b/i,
  /\bopt[\s-]?out\b/i,
  /\bremove me\b/i,
  /\btake me off\b/i,
  /\b(?:do not|don't|dont|never) (?:contact|email|message|write to) (?:me|us)\b/i,
  /\bstop (?:emailing|contacting|messaging|writing)\b/i,
  /\bnot interested\b/i,
  /\bleave me alone\b/i,
];

export interface StopResult {
  stop: boolean;
  matched: string | null;
}

export function detectStop(text: string): StopResult {
  for (const p of STOP_PATTERNS) {
    const m = text.match(p);
    if (m) return { stop: true, matched: m[0].trim() };
  }
  return { stop: false, matched: null };
}
