// Fit score is computed in code from per-criterion verdicts (the LLM never picks the number).
// "unknown" earns partial credit: we don't punish missing data as hard as a clear miss.

import type { Criterion, QualificationReason, Verdict } from "@/domain/entities";

export const WEIGHTS: Record<Criterion, number> = {
  us_ecommerce: 35,
  trigger: 25,
  revenue_range: 15,
  team_size: 15,
  contact_role: 10,
};

// 0.4 was too generous: "US e-commerce + everything unknown" scored 61 and qualified with no reason
// to talk now (found in the first live run). At 0.25 it scores 51.
const CREDIT: Record<Verdict, number> = { meets: 1, unknown: 0.25, fails: 0 };

/** A "meets"/"fails" verdict without evidence is downgraded to "unknown". */
export function enforceEvidence(r: QualificationReason): QualificationReason {
  if (r.verdict !== "unknown" && (!r.quote || !r.sourceUrl)) {
    return { ...r, verdict: "unknown", reason: `${r.reason} (no verified source, treated as unknown)` };
  }
  return r;
}

export function scoreFit(reasons: QualificationReason[]): number {
  let total = 0;
  for (const r of reasons) total += WEIGHTS[r.criterion] * CREDIT[r.verdict];
  // Hard gate: not a US e-commerce brand => cap the score.
  const ecom = reasons.find((r) => r.criterion === "us_ecommerce");
  if (ecom?.verdict === "fails") total = Math.min(total, 20);
  return Math.round(total);
}

export const QUALIFIED_THRESHOLD = 60;
