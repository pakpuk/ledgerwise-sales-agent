import { z } from "zod";
import { CRITERIA } from "@/domain/entities";
import type { Fact } from "@/domain/entities";
import { ICP, UNTRUSTED_RULE, untrusted } from "./shared";

export const QUALIFY_VERSION = "qualify@2";

export const QualifySchema = z.object({
  criteria: z
    .array(
      z.object({
        criterion: z.enum(CRITERIA),
        verdict: z.enum(["meets", "fails", "unknown"]),
        reason: z.string().min(3).max(240),
        fact_id: z.string().nullable(),
      }),
    )
    .length(CRITERIA.length),
});
export type QualifyOutput = z.infer<typeof QualifySchema>;

export const qualifySystem = `You judge whether a company fits Ledgerwise's customer profile.
${ICP}
Judge each criterion exactly once: ${CRITERIA.join(", ")}.
- us_ecommerce: a US brand selling online (Shopify, Amazon, own store).
- revenue_range: roughly $1M-$10M yearly revenue.
- team_size: 5-50 employees.
- trigger: a reason to talk NOW: hiring specifically for finance, accounting, bookkeeping or operations roles; funding
  raised in the last ~18 months; or a recent expansion (wholesale, Amazon, retail stores, new countries).
  Hiring for other roles (marketing, design, e-commerce UX, sales) is NOT a trigger. Funding or news older than ~18 months,
  or with no visible date, is NOT proof: use "unknown". Today is ${new Date().toISOString().slice(0, 10)}.
- contact_role: a named founder, COO or finance lead is identifiable.
Use ONLY the numbered facts. "meets" or "fails" MUST cite the fact_id that proves it.
If no fact proves it either way, the verdict is "unknown" with fact_id null. Never infer revenue or headcount from vibes.
${UNTRUSTED_RULE}`;

export function qualifyPrompt(companyName: string, facts: Fact[]): string {
  const list = facts.map((f) => `[${f.id}] ${f.statement} | quote: "${f.quote}" | source: ${f.sourceUrl}`).join("\n");
  return `Company: ${companyName}\n\nFacts:\n${untrusted("research-facts", list || "(no facts)")}\n\nReturn JSON.`;
}
