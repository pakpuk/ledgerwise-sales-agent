import { z } from "zod";
import type { SearchPort, SearchResult } from "@/application/ports";

const TavilyResponse = z.object({
  results: z.array(z.object({ title: z.string().default(""), url: z.string(), content: z.string().default("") })),
});

export class TavilySearch implements SearchPort {
  readonly available: boolean;
  constructor(private apiKey: string | undefined) {
    this.available = Boolean(apiKey);
  }

  async search(query: string, maxResults = 8): Promise<SearchResult[]> {
    if (!this.apiKey) throw new Error("TAVILY_API_KEY missing");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: "basic", topic: "general" }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
    return TavilyResponse.parse(await res.json()).results;
  }
}

export class NoSearch implements SearchPort {
  readonly available = false;
  async search(): Promise<SearchResult[]> {
    throw new Error("Search is not configured (TAVILY_API_KEY missing)");
  }
}
