// Reply eval: runs every case in evals/replies.jsonl through the real handleReply use case
// with in-memory repo/mail/calendar and the REAL LLM from env (or no LLM if no key).
// Prints rule violations, routing accuracy and booking success.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { FakeCalendar, FakeMail, FakeRepo } from "@/application/use-cases/fakes";
import { handleReply, type Route } from "@/application/use-cases/handle-reply";
import { makeLlm } from "@/infrastructure/container";
import { isPriced } from "@/infrastructure/llm/pricing";
import { priceGuard } from "@/domain/rules/price-guard";
import { BOT_ANSWER } from "@/domain/rules/bot-question";

const Case = z.object({
  id: z.string(),
  category: z.string(),
  reply: z.string(),
  expect: z.array(z.string()).min(1),
  preOffered: z.boolean().optional(),
  expectBooking: z.boolean().optional(),
});
type EvalCase = z.infer<typeof Case>;

async function runCase(c: EvalCase) {
  const repo = new FakeRepo();
  const mail = new FakeMail();
  const calendar = new FakeCalendar();
  const llm = makeLlm((r) => repo.recordRun(r));
  const company = await repo.upsertCompany({ name: "Acme Coffee", domain: "acmecoffee.com", website: "https://acmecoffee.com", trigger: "Hiring a staff accountant", source: "seed" });
  const contact = await repo.getOrCreateContact({ companyId: company.id, name: "Sam", email: "prospect@acmecoffee.com.sandbox" });
  const thread = await repo.createThread(contact.id);
  await repo.saveMessage({
    threadId: thread.id,
    direction: "outbound",
    status: "sent",
    subject: "Your finance hire",
    body: "Hi Sam, I saw you're hiring a Staff Accountant. We do monthly bookkeeping for e-commerce brands. Worth a 20-minute call?",
  });
  if (c.preOffered) {
    const slots = (await calendar.availableSlots({ from: new Date(), days: 7, timezone: "America/New_York" })).map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      timezone: s.timezone,
      simulated: true,
    }));
    await repo.saveMessage({ threadId: thread.id, direction: "outbound", status: "sent", body: "Great. Here are a few times that work: ...", meta: { route: "offer_slots", slots } });
  }

  const started = Date.now();
  let route: Route | "error" = "error";
  let reason: string | undefined;
  try {
    const r = await handleReply({ repo, llm, mail, calendar }, thread.id, c.reply);
    route = r.route;
    reason = r.reason;
  } catch (e) {
    reason = (e as Error).message;
  }

  // Rule violations are checked on what was actually sent, independently of the agent's own checks.
  const violations: string[] = [];
  for (const m of mail.sent) violations.push(...priceGuard(m.body).violations.map((v) => `sent text: ${v}`));
  if (c.category === "stop") {
    if (mail.sent.length > 0) violations.push("replied after a stop");
    if (!repo.suppressions.some((s) => s.kind === "domain")) violations.push("domain not suppressed after stop");
  }
  if (route === "bot_question" && !mail.sent.some((m) => m.body === BOT_ANSWER)) violations.push("bot question not answered with the honest fixed text");
  if (route === "human" && mail.sent.length > 0) violations.push("sent a reply while escalating");

  return {
    id: c.id,
    category: c.category,
    expected: c.expect.join("|"),
    route,
    routeOk: c.expect.includes(route),
    reason,
    violations,
    booked: repo.bookings.length === 1,
    expectBooking: Boolean(c.expectBooking),
    llmCalls: repo.runs.length,
    costUsd: repo.runs.reduce((s, r) => s + r.costUsd, 0),
    unpriced: [...new Set(repo.runs.filter((r) => !isPriced(r.model)).map((r) => r.model))],
    tokens: repo.runs.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0),
    llmFailures: repo.runs.filter((r) => !r.ok).length,
    ms: Date.now() - started,
  };
}

async function main() {
  const cases = readFileSync("evals/replies.jsonl", "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => Case.parse(JSON.parse(l)));
  const hasLlm = Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY);
  const llmLabel = hasLlm ? `LLM fast=${process.env.MODEL_FAST ?? "default"} smart=${process.env.MODEL_SMART ?? "default"}` : "NO LLM KEY: rules-only mode";
  console.log(`Running ${cases.length} reply cases. ${llmLabel}\n`);

  const results = [];
  for (const c of cases) {
    const r = await runCase(c);
    results.push(r);
    const mark = r.routeOk && r.violations.length === 0 ? "PASS" : "FAIL";
    const extra = r.violations.length ? ` VIOLATIONS: ${r.violations.join("; ")}` : !r.routeOk && r.reason ? ` (${r.reason})` : "";
    console.log(`${mark}  ${r.id.padEnd(22)} expected=${r.expected.padEnd(18)} got=${String(r.route).padEnd(13)}${extra}`);
  }

  const routing = results.filter((r) => r.routeOk).length;
  const violations = results.reduce((n, r) => n + r.violations.length, 0);
  const bookingCases = results.filter((r) => r.expectBooking);
  const booked = bookingCases.filter((r) => r.booked).length;
  const cost = results.reduce((s, r) => s + r.costUsd, 0);
  console.log(`\nRouting accuracy : ${routing}/${results.length} (${Math.round((100 * routing) / results.length)}%)`);
  console.log(`Rule violations  : ${violations}`);
  console.log(`Booking success  : ${booked}/${bookingCases.length}`);
  const unpriced = [...new Set(results.flatMap((r) => r.unpriced))];
  const tokens = results.reduce((s, r) => s + r.tokens, 0);
  const llmCalls = results.reduce((s, r) => s + r.llmCalls, 0);
  const llmFailures = results.reduce((s, r) => s + r.llmFailures, 0);
  console.log(`LLM calls        : ${llmCalls} (${llmFailures} failed attempts), ${tokens} tokens, ${Math.round(tokens / results.length)} per reply`);
  console.log(
    unpriced.length
      ? `LLM cost         : price unknown for ${unpriced.join(", ")} (use the token counts)`
      : `LLM cost         : $${cost.toFixed(4)} total, $${(cost / results.length).toFixed(5)} per reply`,
  );

  mkdirSync("evals/results", { recursive: true });
  writeFileSync(
    "evals/results/latest.json",
    JSON.stringify({ at: new Date().toISOString(), llm: llmLabel, routing, total: results.length, violations, booked, bookingCases: bookingCases.length, costUsd: cost, results }, null, 2),
  );
  process.exit(violations > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
