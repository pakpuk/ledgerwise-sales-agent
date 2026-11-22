// Draft a first email for a qualified company. Every claim must cite a fact_id.
// Rules are checked in code; one regeneration with the violations as feedback; then flag for a human.

import type { Claim } from "@/domain/entities";
import { checkFirstEmail, withOptOut } from "@/domain/rules/email-rules";
import { LlmOutputError, LlmUnavailableError, type LlmPort, type SalesRepository } from "@/application/ports";
import { DraftEmailSchema, DRAFT_EMAIL_VERSION, draftEmailPrompt, draftEmailSystem } from "@/application/prompts/draft-email";

/** No real addresses are ever invented or used: every prospect gets a sandbox inbox. */
export const sandboxEmailFor = (domain: string) => `prospect@${domain.replace(/[^a-z0-9.-]/gi, "")}.sandbox`;

export async function draftEmail(deps: { repo: SalesRepository; llm: LlmPort }, companyId: string) {
  const { repo, llm } = deps;
  const company = await repo.getCompany(companyId);
  if (!company) throw new Error("Company not found");
  const facts = await repo.listFacts(companyId);
  if (facts.length === 0) throw new Error("No researched facts: cannot write a truthful email");

  let feedback: string[] = [];
  let attempt = 0;
  let draft: { subject: string; body: string; claims: Claim[]; greetingName: string | null } | null = null;
  let violations: string[] = [];

  while (attempt < 2) {
    attempt++;
    try {
      const out = await llm.json({
        kind: "draft_email",
        promptVersion: DRAFT_EMAIL_VERSION,
        tier: "smart",
        system: draftEmailSystem,
        prompt: draftEmailPrompt(company, facts, feedback),
        schema: DraftEmailSchema,
        subjectId: companyId,
      });
      const nameBacked = out.greeting_name && facts.some((f) => f.id === out.greeting_name_fact_id);
      draft = {
        subject: out.subject,
        body: withOptOut(out.body),
        claims: out.claims.map((c) => ({ text: c.text, factId: c.fact_id })),
        greetingName: nameBacked ? out.greeting_name : null,
      };
      const check = checkFirstEmail(draft.subject, draft.body, draft.claims, facts);
      if (!nameBacked && out.greeting_name) check.violations.push(`Greeting name "${out.greeting_name}" is not backed by a fact`);
      violations = check.violations;
      if (violations.length === 0) break;
      feedback = violations;
    } catch (e) {
      if (!(e instanceof LlmOutputError) && !(e instanceof LlmUnavailableError)) throw e;
      violations = [e.message];
    }
  }

  const contact = await repo.getOrCreateContact({
    companyId,
    name: draft?.greetingName ?? `${company.name} team`,
    email: sandboxEmailFor(company.domain),
  });
  const thread = await repo.createThread(contact.id);
  const needsHuman = violations.length > 0;
  return repo.saveMessage({
    threadId: thread.id,
    direction: "outbound",
    status: "draft",
    subject: draft?.subject ?? `${company.name} x Ledgerwise`,
    body: draft?.body ?? withOptOut("(The agent could not write a draft that passes the rules. Please write this one.)"),
    claims: draft?.claims ?? [],
    meta: needsHuman ? { needsHuman, reason: "Draft failed the rules twice", violations } : { attempts: attempt },
  });
}
