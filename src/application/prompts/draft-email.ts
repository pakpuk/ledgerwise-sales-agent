import { z } from "zod";
import type { Company, Fact } from "@/domain/entities";
import { MAX_WORDS } from "@/domain/rules/email-rules";
import { UNTRUSTED_RULE, untrusted } from "./shared";

export const DRAFT_EMAIL_VERSION = "draft-email@1";

export const DraftEmailSchema = z.object({
  subject: z.string().min(3).max(80),
  greeting_name: z.string().max(40).nullable(),
  greeting_name_fact_id: z.string().nullable(),
  body: z.string().min(20).max(1200),
  claims: z.array(z.object({ text: z.string().min(3).max(200), fact_id: z.string() })).min(1).max(3),
});
export type DraftEmailOutput = z.infer<typeof DraftEmailSchema>;

export const draftEmailSystem = `You write a first cold email for Ledgerwise, a US bookkeeping firm doing monthly bookkeeping for e-commerce brands.
Rules (all mandatory):
- Under ${MAX_WORDS - 20} words. Plain, human, no hype, no buzzwords, no exclamation marks.
- Use exactly ONE specific fact from the research to show why you are writing now. Every factual statement about the company
  must be listed in "claims" with the fact_id it comes from, and the claim "text" must appear word for word in the body.
- One soft ask for a short call. No price, no numbers about Ledgerwise, no promises, no claims about results.
- Do not write a signature or an unsubscribe line (added automatically).
- greeting_name: only if a fact names the founder/COO/finance lead (set greeting_name_fact_id); otherwise null and start with "Hi there,".
${UNTRUSTED_RULE}`;

export function draftEmailPrompt(company: Company, facts: Fact[], feedback?: string[]): string {
  const list = facts.map((f) => `[${f.id}] ${f.statement} | quote: "${f.quote}"`).join("\n");
  const retry = feedback?.length ? `\n\nYour previous draft broke these rules, fix them:\n- ${feedback.join("\n- ")}` : "";
  return `Company: ${company.name} (${company.domain})\nWhy now: ${company.trigger ?? "unknown"}\n\nResearch facts:\n${untrusted("research-facts", list)}${retry}\n\nReturn JSON.`;
}
