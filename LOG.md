# Build log

## Checkpoint 1 — scaffold, guards, auth, empty screens (2026-11-22)

- **Missing inputs:** `CLAUDE.md` and `docs/CASE_STUDY.md` are not in the repo. Built CP1 from the session brief only; ICP/pricing/tone still needed before CP2.
- **Next 16.4 differences:** middleware is now `src/proxy.ts`; `cacheComponents` is on, so the first build failed on `/login` reading `searchParams` outside `<Suspense>`. Fixed with Suspense on `/login` and `export const instant = false` on the `(app)` layout (internal tool, blocking on DB reads is fine).
- **Dependency hiccup:** vitest 5 needs `@types/node` >=22; bumped to `^24` (matches Node 24 runtime).
- **shadcn/ui:** did not run the shadcn CLI (time + Tailwind 4.3/Next 16 risk). Hand-wrote minimal shadcn-style primitives in `src/components/ui.tsx`. Can swap for real shadcn later.
- **Layers:** `domain` (entities, pure guards) → `application` (ports; use cases next) → `infrastructure` (db, auth, adapters) → `app` (UI). No repositories yet: use cases will take `Db` directly to stay light.
- **Guard design choices:**
  - price-guard blocks any money amount not on the approved list, plus discount/free-offer wording.
  - stop-detector is deliberately over-eager ("not interested" = stop).
  - claim-guard: unknown `fact_id` fails, and any number in a claim must appear in the fact's quote.
  - escalation: human takeover, `unsure`, confidence < 0.7, legal/complaint words, or ≥3 agent replies → human.
- **Auth:** HMAC-signed expiring cookie (Web Crypto), shared `APP_PASSWORD`. Proxy does the optimistic check; server actions must call `requireSession()`.
- **Schema not pushed yet:** waiting on `DATABASE_URL`.

## Between CP1 and CP2 — corrections (2026-11-22)

- **Mistake (corrected by user):** I assumed an approved price list and built `priceGuard(text, allowedPrices)`. There is no price list. Now any money amount / "per month" / "/mo" / "starting at" / discount wording is blocked, and pricing questions get a fixed "we cover that on a call" answer + slots.
- **Docs found late:** the brief files are at the repo root as `claude.md` and `case_study.md` (not `CLAUDE.md` / `docs/CASE_STUDY.md`), which is why I missed them at CP1.
- **Plan change:** restructured to the claude.md layout (`domain/entities`, `domain/rules`, `application/ports`, `application/use-cases`, `application/prompts`). Escalation now also covers hostile, non-English, outside-knowledge-base and "validator failed twice".
- **LLM provider:** the provider was left as a placeholder; claude.md says Anthropic SDK, so `@anthropic-ai/sdk` is the primary adapter. A small fetch-based Gemini adapter is used only if `GEMINI_API_KEY` is set instead.
- **Env:** `.env.local` had none of the user's keys at the start of CP2 → every external feature needs a graceful fallback.

## Checkpoint 2 — research, qualify, Companies page (2026-11-22)

- **Fact rule enforced in code:** `quoteAppearsIn()` (normalises case/whitespace/smart quotes) runs on every fact (seed quote, LLM-extracted, search candidate). Facts that fail are dropped and logged, never stored.
- **Score is computed in code** (`domain/rules/scoring.ts`), not picked by the LLM: weighted per-criterion verdicts, "unknown" gets 40% credit, a "meets/fails" that cites no real fact_id is downgraded to "unknown", non-e-commerce is capped at 20. Threshold 60 = qualified.
- **Discovery (`npm run research`):** Tavily search by trigger → LLM picks brands → candidate kept only if its quote is in the search result text → same import pipeline as the seed list. If the source page can't be fetched, the search snippet is saved as the page text (so the quote check still has real text).
- **LLM adapter:** `BaseLlm` = structured output → Zod → one retry with the error → `LlmOutputError` (caller flags for a human). Every attempt is logged to `agent_runs` with prompt version, tokens, cost, latency. Anthropic via `messages.parse` + `zodOutputFormat`; Gemini via fetch + JSON schema.
- **Not done:** server-side refusal `fallbacks` (beta) not enabled; a refusal is treated as a failed attempt → human.
- **Not verified end-to-end:** `.env.local` still has no DATABASE_URL / LLM / Tavily keys, so `db:push`, a real import and a real qualify run have NOT happened yet. Covered by use-case tests with fake ports (quote dropping, unbacked-verdict downgrade, score).

## Checkpoint 3 — draft email, review queue, send path (2026-11-22)

- **One send path:** `send-message.ts` is the only caller of `MailPort.send`. At send time it re-checks: approved status, thread not stopped, suppression (exact email AND company domain), any inbound "stop" in the thread, price guard and claim guard. Blocked messages go back to the queue with reasons.
- **Draft loop:** LLM draft → code appends the opt-out line → `checkFirstEmail` (price, every claim has a real fact_id, numbers in claims are in the quote, claim text is in the body, ≤120 words, ≥1 fact) → one regeneration with the violations → else saved as "Needs you" with the violations shown.
- **Human edits** are re-checked at send (a test proves an edit adding "$99/mo" is blocked). Claims no longer in the edited text are dropped so the fact panel stays truthful.
- **Mistake caught:** stop-suppression keyed on the email's domain would not have matched, because prospect emails are sandbox addresses (`prospect@acme.com.sandbox`). Changed `findSuppression(email, companyDomain)` and `cancelPendingMessages(companyId)`.
- **Mistake caught:** `/review` was prerendered as a static page at build (no DB at build time) → would show stale data. Added `await connection()` to data pages.
- **Assumption:** we never invent real contact emails. Each company gets a clearly-labelled sandbox inbox; the greeting name is used only if a fact names the person.

## Checkpoint 4 — reply agent + Inbox (2026-11-22)

- **Order in `handle-reply.ts`:** save inbound → stop/suppression check in code (no LLM call; a test asserts the LLM is never called) → human-owned threads stay quiet → classify with MODEL_FAST → `isBotQuestion` overrides the classifier (honesty not left to the model) → `shouldEscalate` → route → every reply goes through `send-message`.
- **Routes:** pricing → fixed answer + 3 slots with timezone; bot → fixed honest answer; wants call → offer slots, or book if their text matches an offered slot ("Tuesday afternoon works"); question/objection → smart model answers ONLY from the KB entry the classifier picked (else human); not-now → fixed polite close; out-of-office → no reply; hostile/legal/non-English/unsure/low confidence/outside KB → human.
- **Stop:** suppresses the email AND the company domain, cancels pending drafts, marks the thread stopped.
- **No LLM fallback:** bot and pricing still get their safe fixed answers (regex), everything else goes to a human.
- **Booking pulled forward from CP5:** `book-call.ts` (idempotency key = thread + slot start, re-checks availability) and a simulated calendar, because "Tuesday works" needs booking to be testable now.
- **Knowledge base invented** in `src/application/knowledge-base.ts`, listed in `docs/ASSUMPTIONS.md` as "to confirm with the client".
- **Mistakes:** (1) a stray `cat >` with no input hung a shell command for 2 minutes; killed it and rewrote the lost test file. (2) My `Textarea` props type dropped `ref` (React 19 `ComponentProps` fixes it).

## Checkpoint 5 — booking + Calls page (2026-11-22)

- **Cal.com adapter** (`infrastructure/calendar/calcom.ts`): API v2 `GET /slots` + `POST /bookings`, responses validated with Zod, 12h notice, slots spread across days so the 3 offered times are on different days. Picked automatically when `CAL_API_KEY` + `CAL_EVENT_TYPE_ID` are set; otherwise the simulated calendar.
- **Idempotency:** key = thread id + slot start. `bookCall` returns the existing booking if the key exists (DB unique index is the final guard), and re-checks the slot is still free before booking. Tested: booking the same slot twice → one booking.
- **Calls page:** upcoming/past, time in the prospect's timezone, badge "In Cal.com" vs "Simulated calendar", link to the conversation.
- **Home = "Needs your attention"** (claude.md asked for it): counts + the threads waiting for a human with the reason.
- **Not verified live:** the Cal.com adapter was written from the v2 API docs I know; no key was available to test it. Known risk: Cal.com sends invites to the attendee email, which is a `.sandbox` address (will bounce, by design).

## Checkpoint 6 — evals, costs, README, deploy check (2026-11-22)

- **Eval set:** `evals/replies.jsonl`, 17 cases (stop x4, bot, pricing, objection, KB question, wants call, "Tuesday works" x2, maybe-later, hostile, legal, non-English, prompt injection, out-of-office). `npm run eval` runs the real `handleReply` with the real LLM and in-memory storage, and checks what was actually sent: price violations, replies after stop, domain suppression, honest bot answer, nothing sent while escalating.
- **Result without an LLM key (rules only): routing 12/17, 0 violations, booking 0/2.** The 5 misses (KB question, wants call, 2 bookings, out-of-office) need the classifier; without it they went to a human, which is the safe failure. NOT yet run with a real model, because no key was available.
- **Gaps found while writing the evals (fixed + tested):** "Stop spamming me" was not caught as an opt-out; "CAN-SPAM" was not treated as legal wording.
- **Mistake:** an earlier Python edit saved `guards.test.ts` as cp1252, which corrupted the "€" in a test string. The test still passed only because "per year" matched. Re-saved as UTF-8 and checked that every file is valid UTF-8.
- **Costs:** `npm run costs` reads `agent_runs` → spend by kind, cost per lead (research+qualify+draft ÷ companies), cost per reply (classify+answer ÷ inbound replies).
- **Deploy check (local prod build):** `next build` OK; `next start`: `/api/health` 200, unauthenticated `/` → 307 `/login`, all 5 screens 200 with a valid session and show the "not connected" banner. Vercel deploy not done (Vercel CLI not installed, no DB/LLM keys yet).

## Live pass (2026-11-22)

- **Keys landed in the wrong file:** the user put the Gemini, Tavily and Cal.com keys into `.env.example` (tracked by git) instead of `.env.local`. They were never committed. I moved them to `.env.local` (gitignored) and restored the template. `DATABASE_URL` and `CAL_EVENT_TYPE_ID` were not provided, so **no schema push, no DB-backed research, no Cal.com check yet**.
- **Mistake: stale model defaults.** `gemini-2.5-flash-lite` is retired for new users (HTTP 404). Listed the models the key can use and switched to `gemini-3.5-flash-lite` / `gemini-3.5-flash`. Model prices for these are unknown → reports show tokens + "price unknown" instead of a fake $0.
- **Bugs the live eval exposed (fixed):** (1) when the classifier failed, a regex-detected bot question kept confidence 0 and was escalated instead of getting the honest answer; (2) on an LLM failure the pricing regex fallback was skipped. Both now share the "no LLM" safe fallback.
- **Live eval (Gemini):** 17/17 routing, 0 violations, 2/2 bookings, ~500 tokens/reply, on two consecutive runs (1-2 invalid outputs per run, fixed by the retry).
- **Live research dry run** (`npm run research:dry`, new: in-memory, no DB): Tavily → LLM → real pages → quote check worked end to end (0 facts dropped, ~5 facts/company), 3 companies scored, 2 drafts that passed all rules.
- **Quality issues found and fixed:** the qualifier accepted a **2020** funding round and an **e-commerce UX hire** as triggers. Prompt `qualify@2` requires finance/accounting/ops hiring or funding/expansion within ~18 months, else "unknown". Re-run: the UX hire is now "fails" (score 76 → 51, disqualified).
- **Gemini 503 "high demand" + timeouts** used up the single validation retry. The adapter now retries 429/5xx/timeouts twice with backoff, separately.
- **Stopped:** the Gemini key then hit its quota (HTTP 429 "exceeded your current quota"). Clove and Silk & Sonder were not re-scored with `qualify@2`.
- **DATABASE_URL** arrived later (again in `.env.example`, moved to `.env.local`, template restored). It had a stray `postgres:` prefix in front of the real `postgresql://` URL; removed it.
- **Schema pushed** with `drizzle-kit push --force`. Mistake: I should have listed the tables before using `--force` (it auto-approves data-loss statements). Checked afterwards: the DB holds only our 11 tables, so nothing else was dropped. Added `npm run db:status`.
- **Real research into Neon:** 3 companies, 7 pages, 18 verified facts (0 dropped). The smart model was still out of quota, so this one qualify/draft pass ran with `MODEL_SMART=gemini-3.5-flash-lite` as a one-off override.
- **Truthfulness bug found in live data (fixed):** a draft claimed Blenders was "hiring for fulfillment and operations roles". The cited fact's *statement* was the LLM's summary from search, and its *quote* (a UX job ad) said nothing of the sort. The claim guard only checked the fact_id and numbers. Fixes: (1) seed/search fact statements are now the verified quote itself; (2) new `claimSupportedByQuote` (most of the claim's key words must be in the quote), with the two real live cases as regression tests; (3) the draft prompt (`draft-email@2`) gets quotes only, no LLM labels, and may not call things "recent" unless the quote shows it.
- **Scoring bug found in live data (fixed):** "US e-commerce + everything unknown" scored 61 and qualified with no reason to talk now. Unknown credit 0.4 → 0.25. After re-scoring, all 3 discovered companies are 45-51 and disqualified, which is correct: none has a recent finance/ops/funding trigger.
- **Old drafts re-checked** (`npm run recheck-drafts`, non-destructive): both are flagged "Needs you" with the reason. Nothing was deleted.
- **App on the live DB:** production build + `next start`: all 5 screens 200 with real data.
- **Open:** no qualified companies yet (the case needs >= 30 researched); the Gemini quota is the bottleneck. `CAL_EVENT_TYPE_ID` missing, so Cal.com is untested and slots are simulated. Gemini 3.5 prices unknown, so costs are in tokens (39.5k tokens for 3 researched companies, ~500 per reply).

## Final pass (2026-11-22)

- **User decision:** use the fast model for both tiers (`MODEL_SMART=gemini-3.5-flash-lite`) because of the free-quota limit on `gemini-3.5-flash`.
- **Discovery widened** to 16 recency-focused queries (`find-candidates@2` prefers 2025-2026 triggers). Found 18 candidates → **21 companies total (target was 30), 13 qualified, 15 drafts (11 pass, 4 need review)**. Qualification rules were NOT loosened.
- **Precision gap (not fixed, scope frozen):** when revenue/team size is unknown it doesn't count against a company, so large brands (e.g. Vuori, Shapermint, OOFOS) qualified. Needs a human check on size.
- **Cal.com:** listed event types via the API, chose 8021783 ("Rendez-vous de 30 min"). Real availability works. **Bug found live:** the Cal.com schedule is in a European timezone, so the first slots were 3:00 AM Eastern. Fixed: only offer 9:00-17:00 in the prospect's timezone (20 slots/week). No live booking made (it would create a real event).
- **Graceful failure gaps (fixed + tested):** non-"invalid output" errors in reply classification, KB answers or the calendar would have thrown. Now one outer guard in `handleReply` hands the thread to a human with the reason ("AI quota exhausted: please reply yourself") and sends nothing. The Score/Write email buttons show an amber "Needs you" notice instead of an error page. 2 new tests (quota, Cal.com outage).
- **Misleading number fixed:** `npm run costs` printed "$0.0000" for unpriced models. It now says "price unknown" and reports tokens: ~12.5k tokens per lead (262k tokens / 121 calls / 21 companies).
- **Final eval:** 17/17 routing, 0 violations, 2/2 bookings, ~490 tokens/reply (fast model both tiers).
- **Secret scan:** history + tree. Only match = the `SESSION_SECRET` placeholder in `.env.example` (false positive). Real keys only in gitignored `.env.local`, never committed.
- **GitHub CLI not installed** → the push is left to the user.

## After deploy (2026-11-22)
- **Live Cal.com booking test FAILED:** Cal.com returns `email_domain_cannot_receive_mail` for our `.sandbox` prospect addresses, so every live booking would have failed. Worse, the agent would then have told the prospect "that time was just taken". Fixed: a booking failure now hands the thread to a human; new optional `CAL_BOOKING_EMAIL` (a real team inbox) is used as the Cal.com attendee. Not re-tested live (no inbox configured yet).
- Login page redesigned (clearer card, show/hide password, plain error message).
