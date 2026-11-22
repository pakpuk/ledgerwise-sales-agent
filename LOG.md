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
