// Read-only: print scores with reasons and drafts with rule problems. Usage: npm run inspect
import { container } from "@/infrastructure/container";

async function main() {
  const { repo } = container();
  for (const c of await repo.listCompanies()) {
    console.log(`\n== ${c.name}: ${c.qualification?.score ?? "-"} (${c.status})`);
    for (const r of c.qualification?.reasons ?? []) console.log(`   ${r.verdict.padEnd(7)} ${r.criterion.padEnd(14)} ${r.reason.slice(0, 110)}`);
  }
  for (const t of await repo.listThreads()) {
    for (const m of t.messages.filter((x) => x.status === "draft")) {
      console.log(`\n-- Draft for ${t.company.name}${m.meta.needsHuman ? " [NEEDS YOU]" : ""}: ${m.subject}`);
      if (m.meta.violations?.length) console.log(`   problems: ${m.meta.violations.join(" | ").slice(0, 400)}`);
      console.log(`   ${m.body.replace(/\n/g, "\n   ")}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
