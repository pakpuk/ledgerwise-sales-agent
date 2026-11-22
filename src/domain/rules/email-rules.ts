// Shape rules for outbound emails. The opt-out line is appended by code, never left to the LLM.

import type { Claim, Fact } from "@/domain/entities";
import { claimGuard, claimsInBody } from "./claim-guard";
import { priceGuard, type GuardResult } from "./price-guard";

export const MAX_WORDS = 120;
export const OPT_OUT_LINE = 'Not relevant? Just reply "stop" and I won\'t email you again.';

export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export function withOptOut(body: string): string {
  return body.includes(OPT_OUT_LINE) ? body : `${body.trim()}\n\n${OPT_OUT_LINE}`;
}

export function stripOptOut(body: string): string {
  return body.replace(OPT_OUT_LINE, "").trim();
}

/** All rules for a first email: price, claims backed by facts, claims present, length, a soft ask. */
export function checkFirstEmail(subject: string, body: string, claims: Claim[], facts: Pick<Fact, "id" | "quote">[]): GuardResult {
  const core = stripOptOut(body);
  const results = [priceGuard(`${subject}\n${body}`), claimGuard(claims, facts), claimsInBody(core, claims)];
  const violations = results.flatMap((r) => r.violations);
  if (claims.length === 0) violations.push("Email must use at least one researched fact");
  if (countWords(core) > MAX_WORDS) violations.push(`Too long: ${countWords(core)} words (max ${MAX_WORDS})`);
  return { ok: violations.length === 0, violations };
}

/** Rules for any outbound text at send time (replies included). */
export function checkOutbound(text: string, claims: Claim[], facts: Pick<Fact, "id" | "quote">[]): GuardResult {
  const violations = [...priceGuard(text).violations, ...claimGuard(claims, facts).violations];
  return { ok: violations.length === 0, violations };
}
