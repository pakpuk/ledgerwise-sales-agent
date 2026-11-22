// Re-run today's rules on drafts still waiting for review (e.g. after a rule was tightened).
// Never deletes or sends anything: failing drafts are flagged "Needs you" with the reasons.
import { container } from "@/infrastructure/container";
import { checkFirstEmail } from "@/domain/rules/email-rules";

async function main() {
  const { repo } = container();
  for (const t of await repo.listThreads()) {
    const facts = await repo.listFacts(t.company.id);
    for (const m of t.messages.filter((x) => x.status === "draft" && x.direction === "outbound")) {
      const r = checkFirstEmail(m.subject ?? "", m.body, m.claims, facts);
      await repo.updateMessage(m.id, {
        meta: r.ok ? { ...m.meta, needsHuman: false, violations: [] } : { ...m.meta, needsHuman: true, reason: "Fails the current rules (re-checked)", violations: r.violations },
      });
      console.log(`${t.company.name}: ${r.ok ? "passes" : `NEEDS YOU -> ${r.violations.join(" | ")}`}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
