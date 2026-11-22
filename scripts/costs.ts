// Cost summary from agent_runs: total by kind, cost per lead and cost per reply.
import { container } from "@/infrastructure/container";
import { isPriced } from "@/infrastructure/llm/pricing";

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
  const tok = (kinds: Set<string>) => runs.filter((r) => kinds.has(r.kind)).reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const allTokens = runs.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const unpriced = [...new Set(runs.filter((r) => !isPriced(r.model)).map((r) => r.model))];
  const money = (v: number) => (unpriced.length ? "price unknown" : `$${v.toFixed(4)}`);
  if (unpriced.length) console.log(`\nNo price on file for: ${unpriced.join(", ")}. Dollar figures are not shown; use tokens.`);
  console.log(`\nTotal LLM usage : ${money(total)}, ${allTokens} tokens over ${runs.length} calls`);
  console.log(`Per lead        : ${money(companies.length ? leadCost / companies.length : 0)}, ${companies.length ? Math.round(tok(LEAD_KINDS) / companies.length) : 0} tokens (${companies.length} companies researched)`);
  console.log(`Per reply       : ${money(inbound ? replyCost / inbound : 0)}, ${inbound ? Math.round(tok(REPLY_KINDS) / inbound) : 0} tokens (${inbound} prospect replies handled; see npm run eval for a measured per-reply figure)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
