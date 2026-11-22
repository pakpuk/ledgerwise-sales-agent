// Usage:
//   npm run research            -> discover new candidates via search, then qualify
//   npm run research -- --seed  -> import data/seed-companies.json, then qualify
//   npm run research -- --qualify-only
import { readFileSync } from "node:fs";
import { container, featureStatus } from "@/infrastructure/container";
import { importCompanies, SeedListSchema } from "@/application/use-cases/import-companies";
import { discoverCompanies } from "@/application/use-cases/discover-companies";
import { qualifyCompany } from "@/application/use-cases/qualify-company";
import { draftEmail } from "@/application/use-cases/draft-email";

const args = process.argv.slice(2);
const log = (m: string) => console.log(m);

async function main() {
  for (const f of featureStatus()) if (!f.ok) console.warn(`! ${f.key} missing -> ${f.affects}`);
  const deps = { ...container(), log };

  if (args.includes("--seed")) {
    const seeds = SeedListSchema.parse(JSON.parse(readFileSync("data/seed-companies.json", "utf8")));
    log(`Importing ${seeds.length} seed companies…`);
    await importCompanies(deps, seeds, "seed");
  } else if (!args.includes("--qualify-only")) {
    const limitArg = args.find((a) => a.startsWith("--limit="));
    const r = await discoverCompanies(deps, { limit: limitArg ? Number(limitArg.split("=")[1]) : 15 });
    log(`Discovery: found ${r.found}, imported ${r.imported}`);
  }

  if (!deps.llm.available) {
    log("Skipping qualification: no LLM key.");
    return;
  }
  const companies = await deps.repo.listCompanies();
  for (const c of companies.filter((c) => !c.qualification || args.includes("--requalify"))) {
    try {
      const q = await qualifyCompany(deps, c.id);
      log(`qualified ${c.name}: ${q.score}`);
    } catch (e) {
      log(`qualify ${c.name} failed (needs a human look): ${(e as Error).message}`);
    }
  }

  if (args.includes("--draft")) {
    const threads = await deps.repo.listThreads();
    const hasThread = new Set(threads.map((t) => t.company.id));
    for (const c of (await deps.repo.listCompanies()).filter((c) => c.status === "qualified" && !hasThread.has(c.id))) {
      const m = await draftEmail(deps, c.id).catch((e: Error) => (log(`draft ${c.name} failed: ${e.message}`), null));
      if (m) log(`drafted ${c.name}${m.meta.needsHuman ? " (needs you)" : ""}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
