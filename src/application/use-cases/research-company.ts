// Fetch a company's pages, store them as text, and store facts whose quotes
// are verified (in code) to appear in the saved text. Unverified facts are dropped.

import type { Company, Fact } from "@/domain/entities";
import { quoteAppearsIn } from "@/domain/rules/quote-check";
import type { LlmPort, SalesRepository, ScraperPort } from "@/application/ports";
import { ExtractFactsSchema, EXTRACT_FACTS_VERSION, extractFactsPrompt, extractFactsSystem } from "@/application/prompts/extract-facts";

export interface ResearchDeps {
  repo: SalesRepository;
  scraper: ScraperPort;
  llm: LlmPort;
  log?: (msg: string) => void;
}

/** A fact we were handed (seed list / search result), still to be verified. */
export interface KnownFact {
  sourceUrl: string;
  quote: string;
  statement: string;
  /** Used when the source URL cannot be fetched (e.g. a search snippet). */
  fallbackText?: string;
}

export interface ResearchReport {
  pagesSaved: number;
  factsKept: number;
  factsDropped: number;
  errors: string[];
}

const ABOUT_PATHS = ["", "/about", "/pages/about", "/pages/about-us"];

export async function researchCompany(deps: ResearchDeps, company: Company, known: KnownFact[] = []): Promise<ResearchReport> {
  const { repo, scraper, llm } = deps;
  const log = deps.log ?? (() => {});
  const report: ResearchReport = { pagesSaved: 0, factsKept: 0, factsDropped: 0, errors: [] };
  const pages = new Map<string, { id: string; url: string; text: string }>();

  const urls = new Set<string>([...known.map((k) => k.sourceUrl), ...ABOUT_PATHS.map((p) => company.website.replace(/\/$/, "") + p)]);
  for (const url of urls) {
    try {
      const { text } = await scraper.fetchText(url);
      if (text.length < 200) continue;
      const page = await repo.savePage({ companyId: company.id, url, text });
      pages.set(url, page);
      report.pagesSaved++;
    } catch (e) {
      const k = known.find((x) => x.sourceUrl === url && x.fallbackText);
      if (k?.fallbackText) {
        pages.set(url, await repo.savePage({ companyId: company.id, url, text: k.fallbackText }));
        report.pagesSaved++;
      } else {
        report.errors.push(`${url}: ${(e as Error).message}`);
      }
    }
  }

  const candidates: Omit<Fact, "id">[] = [];
  const consider = (pageUrl: string, statement: string, quote: string) => {
    const page = pages.get(pageUrl);
    if (page && quoteAppearsIn(quote, page.text)) {
      candidates.push({ companyId: company.id, pageId: page.id, sourceUrl: page.url, statement, quote });
    } else {
      report.factsDropped++;
      log(`  dropped (quote not on page): "${quote.slice(0, 60)}…"`);
    }
  };

  for (const k of known) consider(k.sourceUrl, k.statement, k.quote);

  if (llm.available) {
    for (const page of pages.values()) {
      try {
        const out = await llm.json({
          kind: "extract_facts",
          promptVersion: EXTRACT_FACTS_VERSION,
          tier: "fast",
          system: extractFactsSystem,
          prompt: extractFactsPrompt(company.name, page.url, page.text),
          schema: ExtractFactsSchema,
          subjectId: company.id,
        });
        for (const f of out.facts) consider(page.url, f.statement, f.quote);
      } catch (e) {
        report.errors.push(`extract ${page.url}: ${(e as Error).message}`);
      }
    }
  }

  // De-duplicate identical quotes.
  const seen = new Set<string>();
  const unique = candidates.filter((f) => (seen.has(f.quote) ? false : (seen.add(f.quote), true)));
  await repo.saveFacts(unique);
  report.factsKept = unique.length;
  if (report.pagesSaved > 0) await repo.setCompanyStatus(company.id, "researched");
  return report;
}
