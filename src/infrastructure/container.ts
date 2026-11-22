// Composition root: the ONLY place that wires ports to adapters.
import type { LlmPort, SalesRepository, SearchPort } from "@/application/ports";
import { getDb, hasDb } from "./db/client";
import { DrizzleRepository } from "./db/repo";
import { AnthropicLlm } from "./llm/anthropic";
import { GeminiLlm } from "./llm/gemini";
import { NoLlm } from "./llm/none";
import { FetchScraper } from "./scraper/fetch-scraper";
import { NoSearch, TavilySearch } from "./search/tavily";
import { SandboxMail } from "./mail/sandbox-mail";
import { SimulatedCalendar } from "./calendar/simulated";
import { CalComCalendar } from "./calendar/calcom";
import type { CalendarPort } from "@/application/ports";

export interface FeatureStatus {
  key: string;
  ok: boolean;
  affects: string;
}

/** What's configured, in plain language, for the UI and scripts. */
export function featureStatus(env = process.env): FeatureStatus[] {
  return [
    { key: "DATABASE_URL", ok: Boolean(env.DATABASE_URL), affects: "Everything is stored here; without it screens stay empty." },
    { key: "ANTHROPIC_API_KEY / GEMINI_API_KEY", ok: Boolean(env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY), affects: "Fact extraction, qualification, email drafts and reply classification (replies go to a human instead)." },
    { key: "TAVILY_API_KEY", ok: Boolean(env.TAVILY_API_KEY), affects: "`npm run research` web discovery (seed import still works)." },
    { key: "CAL_API_KEY + CAL_EVENT_TYPE_ID", ok: Boolean(env.CAL_API_KEY && env.CAL_EVENT_TYPE_ID), affects: "Real calendar slots and bookings (falls back to simulated slots)." },
  ];
}

/** Picks the LLM adapter from env. Exported so the eval runner can use it without a database. */
export function makeLlm(record: SalesRepository["recordRun"], env = process.env): LlmPort {
  const provider = (env.LLM_PROVIDER ?? "").toLowerCase();
  if (env.ANTHROPIC_API_KEY && provider !== "gemini") {
    return new AnthropicLlm(env.ANTHROPIC_API_KEY, { fast: env.MODEL_FAST || "claude-haiku-5-5", smart: env.MODEL_SMART || "claude-opus-5-5" }, record);
  }
  if (env.GEMINI_API_KEY) {
    return new GeminiLlm(env.GEMINI_API_KEY, { fast: env.MODEL_FAST || "gemini-3.5-flash-lite", smart: env.MODEL_SMART || "gemini-3.5-flash" }, record);
  }
  return new NoLlm();
}

let cached: ReturnType<typeof build> | null = null;

function build() {
  const repo: SalesRepository = new DrizzleRepository(getDb());
  const llm = makeLlm((r) => repo.recordRun(r));

  const search: SearchPort = process.env.TAVILY_API_KEY ? new TavilySearch(process.env.TAVILY_API_KEY) : new NoSearch();
  const calKey = process.env.CAL_API_KEY;
  const calEvent = Number(process.env.CAL_EVENT_TYPE_ID);
  const calendar: CalendarPort = calKey && calEvent ? new CalComCalendar(calKey, calEvent) : new SimulatedCalendar(repo);
  return { repo, llm, search, calendar, scraper: new FetchScraper(), mail: new SandboxMail() };
}

export function container() {
  if (!hasDb()) throw new Error("DATABASE_URL is not set");
  cached ??= build();
  return cached;
}
