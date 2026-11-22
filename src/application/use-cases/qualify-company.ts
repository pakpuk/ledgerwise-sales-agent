// Score fit from stored facts. The LLM gives a verdict per criterion and cites a fact_id;
// code attaches the quote + link from that fact, downgrades unbacked verdicts, and computes the score.

import { CRITERIA, type QualificationReason } from "@/domain/entities";
import { enforceEvidence, QUALIFIED_THRESHOLD, scoreFit } from "@/domain/rules/scoring";
import type { LlmPort, SalesRepository } from "@/application/ports";
import { QualifySchema, QUALIFY_VERSION, qualifyPrompt, qualifySystem } from "@/application/prompts/qualify";

export async function qualifyCompany(deps: { repo: SalesRepository; llm: LlmPort }, companyId: string) {
  const { repo, llm } = deps;
  const company = await repo.getCompany(companyId);
  if (!company) throw new Error(`Company ${companyId} not found`);
  const facts = await repo.listFacts(companyId);
  const byId = new Map(facts.map((f) => [f.id, f]));

  const out = await llm.json({
    kind: "qualify",
    promptVersion: QUALIFY_VERSION,
    tier: "smart",
    system: qualifySystem,
    prompt: qualifyPrompt(company.name, facts),
    schema: QualifySchema,
    subjectId: companyId,
  });

  const reasons: QualificationReason[] = CRITERIA.map((criterion) => {
    const c = out.criteria.find((x) => x.criterion === criterion);
    const fact = c?.fact_id ? byId.get(c.fact_id) : undefined;
    return enforceEvidence({
      criterion,
      verdict: c?.verdict ?? "unknown",
      reason: c?.reason ?? "Not assessed",
      factId: fact?.id ?? null,
      quote: fact?.quote ?? null,
      sourceUrl: fact?.sourceUrl ?? null,
    });
  });

  const score = scoreFit(reasons);
  const q = await repo.saveQualification({ companyId, score, reasons });
  await repo.setCompanyStatus(companyId, score >= QUALIFIED_THRESHOLD ? "qualified" : "disqualified");
  return q;
}
