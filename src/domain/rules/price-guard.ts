// Rule 1: never quote a price. There is NO approved price list: any money
// amount or pricing phrasing in outbound text is a violation.

export interface GuardResult {
  ok: boolean;
  violations: string[];
}

const PRICE_PATTERNS: RegExp[] = [
  /[$€£]\s?\d/,
  /\b\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars?|euros?|bucks)\b/i,
  /\bper\s+(?:month|year|hour|seat|user|transaction)\b/i,
  /\/\s?(?:mo|month|yr|year|hr)\b/i,
  /\bstarting\s+(?:at|from)\b/i,
  /\b(?:costs?|priced at|fee of|retainer of)\s+(?:about\s+|around\s+|only\s+)?\d/i,
  /\b(?:discount(?:ed)?|\d+\s?%\s?off|coupon|promo(?:tion)?\s*code)\b/i,
  /\bfree\s+(?:trial|month|months)\b/i,
];

export function priceGuard(text: string): GuardResult {
  const violations: string[] = [];
  for (const p of PRICE_PATTERNS) {
    const m = text.match(p);
    if (m) violations.push(`Mentions pricing: "${m[0].trim()}"`);
  }
  return { ok: violations.length === 0, violations };
}

const PRICING_Q = /\b(price|prices|pricing|cost|costs|how much|quote|budget|rates?|fees?|per (?:month|seat|user)|plans?|expensive|cheap)\b/i;

/** Does an inbound message ask about pricing? */
export function isPricingQuestion(text: string): boolean {
  return PRICING_Q.test(text);
}

export const PRICING_ANSWER =
  "Good question. We cover pricing on a short call, because it depends on your order volume, channels and how your books look today. Here are a few times that work:";
