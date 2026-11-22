import { z } from "zod";
import type { SearchResult } from "@/application/ports";
import { ICP, UNTRUSTED_RULE, untrusted } from "./shared";

export const FIND_CANDIDATES_VERSION = "find-candidates@2";

export const FindCandidatesSchema = z.object({
  candidates: z
    .array(
      z.object({
        name: z.string().min(2).max(100),
        website: z.string().min(4).max(200),
        trigger: z.string().min(3).max(200),
        source_url: z.string().url(),
        quote: z.string().min(12).max(300),
      }),
    )
    .max(10),
});
export type FindCandidatesOutput = z.infer<typeof FindCandidatesSchema>;

export const findCandidatesSystem = `You find candidate companies for Ledgerwise in web search results.
${ICP}
From the results, list real, specific e-commerce brands that may fit and have a reason to talk now.
For each: brand name, its own website (homepage URL, not a news site), the trigger, the source_url of the result,
and a quote copied EXACTLY from that result's content that shows the trigger.
Prefer triggers from 2025-2026; skip results that are clearly older (e.g. funding in 2020-2023).
Skip big public companies, agencies, marketplaces, software vendors and anything you are unsure about. ${UNTRUSTED_RULE}`;

export function findCandidatesPrompt(results: SearchResult[]): string {
  const blocks = results.map((r) => untrusted(r.url, `TITLE: ${r.title}\nURL: ${r.url}\n${r.content}`, 3000)).join("\n\n");
  return `${blocks}\n\nReturn JSON with candidates.`;
}
