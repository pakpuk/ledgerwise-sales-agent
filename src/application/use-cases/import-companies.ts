// Import a seed list (data/seed-companies.json) and research each company.

import { z } from "zod";
import type { CompanySource } from "@/domain/entities";
import { researchCompany, type KnownFact, type ResearchDeps, type ResearchReport } from "./research-company";

export const SeedCompanySchema = z.object({
  name: z.string().min(1),
  website: z.string().min(4),
  trigger: z.string().min(1),
  source_url: z.string().url(),
  quote: z.string().min(1),
});
export const SeedListSchema = z.array(SeedCompanySchema);
export type SeedCompany = z.infer<typeof SeedCompanySchema> & { fallbackText?: string };

export function normalizeWebsite(website: string): { website: string; domain: string } {
  const url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
  const domain = url.hostname.toLowerCase().replace(/^www\./, "");
  return { website: `https://${url.hostname.toLowerCase()}`, domain };
}

export async function importCompanies(
  deps: ResearchDeps,
  seeds: SeedCompany[],
  source: CompanySource = "seed",
): Promise<Array<{ name: string } & ResearchReport>> {
  const results: Array<{ name: string } & ResearchReport> = [];
  for (const s of seeds) {
    const { website, domain } = normalizeWebsite(s.website);
    const company = await deps.repo.upsertCompany({ name: s.name, domain, website, trigger: s.trigger, source });
    deps.log?.(`• ${s.name} (${domain})`);
    // The statement is the verified quote itself, never the LLM's own summary of the trigger.
    const known: KnownFact[] = [{ sourceUrl: s.source_url, quote: s.quote, statement: `Source says: ${s.quote}`, fallbackText: s.fallbackText }];
    const r = await researchCompany(deps, company, known);
    deps.log?.(`  pages=${r.pagesSaved} facts=${r.factsKept} dropped=${r.factsDropped}${r.errors.length ? ` errors=${r.errors.length}` : ""}`);
    results.push({ name: s.name, ...r });
  }
  return results;
}
