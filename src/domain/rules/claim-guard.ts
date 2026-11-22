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

/** Every claim text must actually appear in the body (so the UI can't show phantom claims). */
export function claimsInBody(body: string, claims: Claim[]): GuardResult {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const b = norm(body);
  const violations = claims
    .filter((c) => !b.includes(norm(c.text)))
    .map((c) => `Claim text not found in body: "${c.text}"`);
  return { ok: violations.length === 0, violations };
}
