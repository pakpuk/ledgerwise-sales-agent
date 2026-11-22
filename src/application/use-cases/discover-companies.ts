// `npm run research`: search the web by trigger, let the LLM pick candidate brands,
// keep only candidates whose quote really appears in the search result, then import them.

import { quoteAppearsIn } from "@/domain/rules/quote-check";
import type { SalesRepository, SearchPort, SearchResult } from "@/application/ports";
import { FindCandidatesSchema, FIND_CANDIDATES_VERSION, findCandidatesPrompt, findCandidatesSystem } from "@/application/prompts/find-candidates";
import { importCompanies, normalizeWebsite, type SeedCompany } from "./import-companies";
import type { ResearchDeps } from "./research-company";

export const TRIGGER_QUERIES = [
  // Hiring finance / ops
  "Shopify brand hiring staff accountant",
  "DTC e-commerce brand hiring operations manager",
  "e-commerce brand hiring bookkeeper 2026",
  "DTC brand hiring finance manager 2026",
  "Shopify Plus brand hiring controller",
  "Amazon seller brand hiring operations coordinator 2026",
  // Funding
  "consumer brand raises seed round Shopify 2026",
  "DTC brand closes Series A funding 2026",
  "DTC brand raises funding 2026 to expand retail",
  "e-commerce startup raises seed round 2026 consumer products",
  // Expansion
  "Shopify brand launches on Amazon 2026",
  "DTC brand expands into wholesale retail stores 2026",
  "e-commerce brand launches in Target stores 2026",
  "DTC brand launches at Whole Foods 2026",
  "independent DTC brand expands to Canada UK 2026",
  "DTC brand opens first retail store 2026",
];

const NEWS_HOSTS = /(techcrunch|forbes|businessinsider|linkedin|indeed|glassdoor|crunchbase|bloomberg|reuters|yahoo|medium|substack|prnewswire|businesswire|shopify\.com|amazon\.com|modernretail|retaildive)/i;

export async function discoverCompanies(
  deps: ResearchDeps & { search: SearchPort },
  opts: { queries?: string[]; limit?: number } = {},
): Promise<{ found: number; imported: number }> {
  const { search, llm, repo } = deps;
  if (!search.available) throw new Error("Search is not configured (TAVILY_API_KEY missing)");
  if (!llm.available) throw new Error("LLM is not configured: cannot pick candidates from search results");

  const existing = new Set((await repo.listCompanies()).map((c) => c.domain));
  const picked = new Map<string, SeedCompany>();
  const limit = opts.limit ?? 15;

  for (const q of opts.queries ?? TRIGGER_QUERIES) {
    if (picked.size >= limit) break;
    deps.log?.(`search: ${q}`);
    let results: SearchResult[];
    try {
      results = await search.search(q, 8);
    } catch (e) {
      deps.log?.(`  search failed: ${(e as Error).message}`);
      continue;
    }
    const out = await llm
      .json({ kind: "find_candidates", promptVersion: FIND_CANDIDATES_VERSION, tier: "fast", system: findCandidatesSystem, prompt: findCandidatesPrompt(results), schema: FindCandidatesSchema })
      .catch((e: Error) => (deps.log?.(`  LLM failed: ${e.message}`), { candidates: [] }));

    for (const c of out.candidates) {
      const result = results.find((r) => r.url === c.source_url);
      let domain: string;
      try {
        domain = normalizeWebsite(c.website).domain;
      } catch {
        continue;
      }
      if (!result || !quoteAppearsIn(c.quote, `${result.title}\n${result.content}`)) continue; // unverifiable
      if (NEWS_HOSTS.test(domain) || existing.has(domain) || picked.has(domain)) continue;
      picked.set(domain, { ...c, fallbackText: `${result.title}\n${result.content}` });
    }
  }

  const seeds = [...picked.values()].slice(0, limit);
  await importCompanies(deps, seeds, "research");
  return { found: picked.size, imported: seeds.length };
}
