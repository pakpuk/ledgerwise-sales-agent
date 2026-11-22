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
