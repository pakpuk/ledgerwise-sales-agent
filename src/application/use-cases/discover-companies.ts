// `npm run research`: search the web by trigger, let the LLM pick candidate brands,
// keep only candidates whose quote really appears in the search result, then import them.

import { quoteAppearsIn } from "@/domain/rules/quote-check";
import type { SalesRepository, SearchPort, SearchResult } from "@/application/ports";
import { FindCandidatesSchema, FIND_CANDIDATES_VERSION, findCandidatesPrompt, findCandidatesSystem } from "@/application/prompts/find-candidates";
import { importCompanies, normalizeWebsite, type SeedCompany } from "./import-companies";
import type { ResearchDeps } from "./research-company";

export const TRIGGER_QUERIES = [
  "Shopify brand hiring staff accountant",
  "DTC e-commerce brand hiring operations manager",
  "consumer brand raises seed round Shopify 2026",
  "DTC brand closes Series A funding",
  "Shopify brand launches on Amazon",
  "DTC brand expands into wholesale retail stores",
  "e-commerce brand launches in Target stores",
  "independent DTC brand expands to Canada UK",
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
