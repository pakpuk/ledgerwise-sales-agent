# Ledgerwise Sales Agent

An AI sales platform for **Ledgerwise** (fictional US bookkeeping firm for e-commerce brands). The agent researches companies, qualifies them with sources, drafts first emails, answers replies and books calls, while the sales team stays in control.

## Screens
| Screen | What the team does there |
|---|---|
| **Home: Needs your attention** | Counts + every conversation waiting for a human, with the reason. |
| **Companies** | Fit score, a Yes/No/Unknown verdict per criterion, the quote + link behind each one. Sort by fit, name, newest, facts. "Write email" for good fits. |
| **Review queue** | Every first email before it goes out: approve & send, edit, reject. The facts behind each claim are shown next to the draft. |
| **Inbox** | Every conversation with status badges, the full thread, what the agent decided and why, **Take over / Hand back**, a reply box, and **Simulate prospect reply**. |
| **Calls** | Booked calls in the prospect's timezone, labelled "In Cal.com" or "Simulated calendar". |

## Business rules, and where code enforces them
| Rule | Enforced in |
|---|---|
| Never quote a price | `domain/rules/price-guard.ts` on every outbound text, at draft time AND inside `send-message`. Pricing questions get a fixed "we cover that on a call" + slots. |
| No false claims | Facts are stored only if their quote is found in the saved page text (`quote-check.ts`). Every email claim cites a `fact_id`, and numbers in a claim must appear in the quote (`claim-guard.ts`). A score reason without a real fact counts as "unknown" (`scoring.ts`). |
| Stop means stop | `stop-detector.ts` runs **before any LLM call**. It suppresses the email AND the company domain, cancels pending drafts and stops the thread. `send-message` checks suppression again. |
| Bot question → honest | `bot-question.ts` overrides the classifier and sends a fixed, approved answer. |
| Unsure → human | `escalation.ts`: low confidence, unsure, hostile, legal/complaint, non-English, outside the knowledge base, validator failed twice, agent reply limit. |

Scraped pages and prospect replies are wrapped in `<untrusted>` delimiters, and only LLM output that passes a Zod schema is accepted (one retry, then a human).

## Architecture
```
src/domain/          entities + pure rules (no I/O), unit-tested
src/application/     ports, use-cases (one file each), prompts (versioned, Zod schemas), knowledge-base
src/infrastructure/  adapters: db (Drizzle/Neon), llm (Anthropic | Gemini), search (Tavily), scraper (fetch + html-to-text),
                     mail (sandbox), calendar (Cal.com | simulated), auth; container.ts = the only wiring point
src/app/             Next.js pages + thin server actions that call use cases
scripts/             research.ts, eval.ts, costs.ts
evals/               replies.jsonl + results/
```
`send-message.ts` is the **only** code path that sends anything, and human replies go through it too.

## Setup
```bash
npm install
cp .env.example .env.local     # fill in (see below)
npm run db:push                # create tables in Neon
npm run dev                    # http://localhost:3000, log in with APP_PASSWORD
```

| Env | Needed for | If missing |
|---|---|---|
| `DATABASE_URL` | everything | screens show empty states + a banner |
| `APP_PASSWORD`, `SESSION_SECRET` | login | login fails |
| `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` (+ `MODEL_FAST`, `MODEL_SMART`) | fact extraction, scoring, drafts, reply classification | pages + seed facts still saved. Replies: pricing/bot get fixed answers, everything else goes to a human |
| `TAVILY_API_KEY` | `npm run research` discovery | seed import still works |
| `CAL_API_KEY`, `CAL_EVENT_TYPE_ID` | real slots + bookings | simulated weekday slots (labelled) |

## Commands
| Command | What it does |
|---|---|
| `npm run research:seed` | import `data/seed-companies.json` (`{name, website, trigger, source_url, quote}`), fetch pages, store verified facts, score |
| `npm run research` | discover new candidates via Tavily by trigger, then the same pipeline |
| `npm run research -- --qualify-only --draft` | score unscored companies, draft emails for good fits |
| `npm run eval` | run the 17 reply cases, print routing accuracy, rule violations, booking success, cost |
| `npm run costs` | LLM spend by kind, cost per lead, cost per reply (from `agent_runs`) |
| `npm test` / `npm run typecheck` | unit + use-case tests (fake ports) / TypeScript |

## Evaluation
`evals/replies.jsonl` has 17 cases: stop x4, bot question, pricing, objection, KB question, wants call, "Tuesday works" x2, maybe-later, hostile, legal, non-English, prompt injection, out-of-office. The runner uses the real `handleReply` use case and the real LLM with in-memory storage, and checks what was actually sent.

**Final run (2026-11-22, `gemini-3.5-flash-lite` for both tiers): routing 17/17, 0 rule violations, bookings 2/2, ~490 tokens per reply.**
Earlier live runs with `gemini-3.5-flash` as the smart model gave the same 17/17, 0 violations, 2/2 (two runs). Without an LLM key (rules only): 12/17, 0 violations, and every miss went safely to a human.
17 cases is a small sample: it shows the routing works on the main reply types, not a measured error rate.

**Live LLM calls run on a free Gemini quota.** The smart model (`gemini-3.5-flash`) ran out of quota mid-build, so the deployed config uses `gemini-3.5-flash-lite` for both tiers. If the quota runs out in production, replies go to "Needs you" with the reason, nothing is sent, and the Score/Write buttons show a notice instead of failing.
Gemini 3.5 prices are not in `pricing.ts`, so usage is reported in tokens, not a made-up dollar figure: research+qualify+draft ≈ **12.5k tokens per lead** (21 companies, 262k tokens over 121 calls).

**Pipeline results (live, 2026-11-22):** 21 companies researched (51 pages, 121 verified facts, 0 quotes accepted without a match on the page), 13 qualified, 15 drafts (11 pass all rules, 4 need review). Known gap: when revenue/team size is unknown it doesn't count against a company, so a few much larger brands qualified. A human should check size on the Companies page.

`npm run research:dry -- --limit=3` runs the live research pipeline (Tavily + LLM + real page fetches) into memory, no database needed.

## Deploy (Vercel)
1. Import the repo in Vercel (framework: Next.js, default build).
2. Set the env vars above for Production (at least `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, plus an LLM key).
3. Run `npm run db:push` once against the production database, then run research locally (`npm run research:seed`). Long research runs as a script, not in a serverless request.
4. Check: `/api/health` returns `{ok:true}`, `/` redirects to `/login`, and after login every screen loads.

Known limits: no real email sending (sandbox only); Cal.com availability is tested live (event type "30 min", slots filtered to 9:00-17:00 in the prospect's timezone) but a live booking has not been made; only 21 companies researched so far (target 30); re-drafting a company creates a new thread.

More: `docs/ASSUMPTIONS.md` (things to confirm with the client), `LOG.md` (build journal, mistakes, plan changes).
