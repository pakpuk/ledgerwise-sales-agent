// Every claim in an outbound draft must point at a known fact, and any
// number it states must appear in that fact's quote (no invented stats).

import type { Claim, Fact } from "@/domain/entities";
import type { GuardResult } from "./price-guard";

const NUMBER = /\d[\d,.]*%?/g;

export function claimGuard(claims: Claim[], facts: Pick<Fact, "id" | "quote">[]): GuardResult {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const violations: string[] = [];

  for (const c of claims) {
    const fact = byId.get(c.factId);
    if (!fact) {
      violations.push(`Claim not backed by a known fact: "${c.text}" (fact_id=${c.factId || "missing"})`);
      continue;
    }
    if (!claimSupportedByQuote(c.text, fact.quote)) {
      violations.push(`Claim says more than its source quote: "${c.text}" (fact_id=${c.factId})`);
    }
    const quote = fact.quote.replace(/,/g, "");
    for (const n of c.text.match(NUMBER) ?? []) {
      const bare = n.replace(/,/g, "").replace(/\.$/, "");
      if (!quote.includes(bare)) {
        violations.push(`Number "${n}" in claim is not in the source quote (fact_id=${c.factId})`);
      }
    }
  }
  return { ok: violations.length === 0, violations };
}

const STOPWORDS = new Set(
  "that this with your have from they their about into over were been just also very more most some such than then them what when which while will would could should there these those our ours you".split(" "),
);
const keyWords = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9.]+/g) ?? []).map((w) => w.replace(/\.$/, "")).filter((w) => (w.length >= 4 || /\d/.test(w)) && !STOPWORDS.has(w));

/**
 * Cheap, deterministic support check: most of the claim's key words (compared on their first
 * 4 letters, so "raised" ~ "raising") must appear in the quote. Catches claims that say
 * something the source doesn't (e.g. "hiring for operations" backed by a UX job quote).
 */
export function claimSupportedByQuote(claim: string, quote: string, minRatio = 0.6): boolean {
  const words = keyWords(claim);
  if (words.length === 0) return true;
  const quoteStems = new Set(keyWords(quote).map((w) => w.slice(0, 4)));
  const hits = words.filter((w) => quoteStems.has(w.slice(0, 4))).length;
  return hits / words.length >= minRatio;
}

/** Every claim text must actually appear in the body (so the UI can't show phantom claims). */
export function claimsInBody(body: string, claims: Claim[]): GuardResult {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const b = norm(body);
  const violations = claims
    .filter((c) => !b.includes(norm(c.text)))
    .map((c) => `Claim text not found in body: "${c.text}"`);
  return { ok: violations.length === 0, violations };
}
