// Live research pipeline WITHOUT a database: real Tavily + real LLM + real page fetches,
// stored in memory. Usage: npm run research:dry -- --limit=3
import { FakeRepo } from "@/application/use-cases/fakes";
import { discoverCompanies } from "@/application/use-cases/discover-companies";
import { qualifyCompany } from "@/application/use-cases/qualify-company";
import { draftEmail } from "@/application/use-cases/draft-email";
import { makeLlm } from "@/infrastructure/container";
import { FetchScraper } from "@/infrastructure/scraper/fetch-scraper";
import { TavilySearch } from "@/infrastructure/search/tavily";

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 3;
  const repo = new FakeRepo();
  const llm = makeLlm((r) => repo.recordRun(r));
  const deps = { repo, llm, scraper: new FetchScraper(), search: new TavilySearch(process.env.TAVILY_API_KEY), log: (m: string) => console.log(m) };

  const r = await discoverCompanies(deps, { limit, queries: process.argv.includes("--all-queries") ? undefined : undefined });
  console.log(`\nDiscovery: ${r.found} candidates, ${r.imported} imported`);

  for (const c of repo.companies) {
    try {
      const q = await qualifyCompany(deps, c.id);
      console.log(`\n== ${c.name} (${c.domain}) score ${q.score} [${c.status}] facts=${repo.facts.filter((f) => f.companyId === c.id).length}`);
      for (const reason of q.reasons) console.log(`   ${reason.verdict.padEnd(7)} ${reason.criterion.padEnd(14)} ${reason.quote ? `"${reason.quote.slice(0, 70)}"` : ""}`);
      if (c.status === "qualified") {
        const m = await draftEmail(deps, c.id);
        console.log(`   DRAFT${m.meta.needsHuman ? " (needs you: " + (m.meta.violations ?? []).join("; ") + ")" : ""}\n   Subject: ${m.subject}\n   ${m.body.replace(/\n/g, "\n   ")}`);
      }
    } catch (e) {
      console.log(`   ${c.name}: ${(e as Error).message}`);
    }
  }

  const failed = repo.runs.filter((x) => !x.ok);
  const tokens = repo.runs.reduce((s, x) => s + x.inputTokens + x.outputTokens, 0);
  console.log(`\nLLM calls: ${repo.runs.length} (${failed.length} failed attempts), ${tokens} tokens`);
  for (const f of failed.slice(0, 5)) console.log(`  failed ${f.kind}: ${(f.error ?? "").slice(0, 160)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
