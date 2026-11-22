import { z } from "zod";
import { ICP, UNTRUSTED_RULE, untrusted } from "./shared";

export const EXTRACT_FACTS_VERSION = "extract-facts@1";

export const ExtractFactsSchema = z.object({
  facts: z
    .array(
      z.object({
        statement: z.string().min(5).max(200),
        quote: z.string().min(12).max(300),
      }),
    )
    .max(8),
});
export type ExtractFactsOutput = z.infer<typeof ExtractFactsSchema>;

export const extractFactsSystem = `You extract sales research facts about one company from its web page.
${ICP}
Extract only facts useful to judge fit or to personalise an email: what they sell, channels (Shopify/Amazon/own site/wholesale/retail),
US presence, team size, revenue, funding, hiring, expansion, founder/COO/finance names and roles.
Each fact needs a "quote" copied EXACTLY, character for character, from the page (one sentence or phrase, 12-300 chars).
If you are not sure, leave the fact out. Never guess numbers. ${UNTRUSTED_RULE}`;

export function extractFactsPrompt(company: string, url: string, text: string): string {
  return `Company: ${company}\nPage URL: ${url}\n\n${untrusted(url, text)}\n\nReturn JSON with the facts.`;
}
