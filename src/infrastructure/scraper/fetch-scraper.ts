import type { ScraperPort } from "@/application/ports";
import { htmlToText } from "./html-to-text";

const MAX_CHARS = 40_000;

export class FetchScraper implements ScraperPort {
  async fetchText(url: string): Promise<{ url: string; text: string }> {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LedgerwiseResearchBot/0.1)", Accept: "text/html,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) throw new Error(`Unsupported content-type ${type}`);
    const text = htmlToText(await res.text()).slice(0, MAX_CHARS);
    return { url, text };
  }
}
