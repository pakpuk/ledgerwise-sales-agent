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

let cached: ReturnType<typeof build> | null = null;

function build() {
  const repo: SalesRepository = new DrizzleRepository(getDb());
  const record = (r: Parameters<SalesRepository["recordRun"]>[0]) => repo.recordRun(r);
  const provider = (process.env.LLM_PROVIDER ?? "").toLowerCase();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let llm: LlmPort = new NoLlm();
  if (anthropicKey && provider !== "gemini") {
    llm = new AnthropicLlm(anthropicKey, { fast: process.env.MODEL_FAST || "claude-haiku-5-5", smart: process.env.MODEL_SMART || "claude-opus-5-5" }, record);
  } else if (geminiKey) {
    llm = new GeminiLlm(geminiKey, { fast: process.env.MODEL_FAST || "gemini-2.5-flash-lite", smart: process.env.MODEL_SMART || "gemini-2.5-flash" }, record);
  }

  const search: SearchPort = process.env.TAVILY_API_KEY ? new TavilySearch(process.env.TAVILY_API_KEY) : new NoSearch();
  const calendar = new SimulatedCalendar(repo);
  return { repo, llm, search, calendar, scraper: new FetchScraper(), mail: new SandboxMail() };
}

export function container() {
  if (!hasDb()) throw new Error("DATABASE_URL is not set");
  cached ??= build();
  return cached;
}
