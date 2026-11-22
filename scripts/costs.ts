// Cost summary from agent_runs: total by kind, cost per lead and cost per reply.
import { container } from "@/infrastructure/container";

const LEAD_KINDS = new Set(["find_candidates", "extract_facts", "qualify", "draft_email"]);
const REPLY_KINDS = new Set(["classify_reply", "answer_reply"]);

async function main() {
  const { repo } = container();
  const [runs, companies, threads] = await Promise.all([repo.listRuns(), repo.listCompanies(), repo.listThreads()]);
  const byKind = new Map<string, { n: number; failed: number; cost: number; tokensIn: number; tokensOut: number; ms: number }>();
  for (const r of runs) {
    const k = byKind.get(r.kind) ?? { n: 0, failed: 0, cost: 0, tokensIn: 0, tokensOut: 0, ms: 0 };
    k.n++;
    k.failed += r.ok ? 0 : 1;
    k.cost += r.costUsd;
    k.tokensIn += r.inputTokens;
    k.tokensOut += r.outputTokens;
    k.ms += r.latencyMs;
    byKind.set(r.kind, k);
  }
  console.log("kind                calls  failed   tokens in/out        cost USD   avg ms");
  for (const [kind, k] of byKind) {
    console.log(`${kind.padEnd(20)}${String(k.n).padStart(5)}  ${String(k.failed).padStart(6)}   ${`${k.tokensIn}/${k.tokensOut}`.padEnd(18)}  ${k.cost.toFixed(4).padStart(9)}  ${String(Math.round(k.ms / k.n)).padStart(7)}`);
  }
  const leadCost = runs.filter((r) => LEAD_KINDS.has(r.kind)).reduce((s, r) => s + r.costUsd, 0);
  const replyCost = runs.filter((r) => REPLY_KINDS.has(r.kind)).reduce((s, r) => s + r.costUsd, 0);
  const inbound = threads.reduce((n, t) => n + t.messages.filter((m) => m.direction === "inbound").length, 0);
  const total = runs.reduce((s, r) => s + r.costUsd, 0);
  console.log(`\nTotal LLM spend : $${total.toFixed(4)} over ${runs.length} calls`);
  console.log(`Cost per lead   : $${(companies.length ? leadCost / companies.length : 0).toFixed(4)} (${companies.length} companies researched)`);
  console.log(`Cost per reply  : $${(inbound ? replyCost / inbound : 0).toFixed(4)} (${inbound} prospect replies handled)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
