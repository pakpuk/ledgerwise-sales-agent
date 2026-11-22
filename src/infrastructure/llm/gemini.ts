// Gemini via plain fetch (no extra SDK). JSON mode + JSON schema; Zod validates in BaseLlm.
import { z } from "zod";
import type { AgentRunRecord } from "@/application/ports";
import { BaseLlm, type RawResult } from "./base";

const GeminiResponse = z.object({
  candidates: z.array(z.object({ content: z.object({ parts: z.array(z.object({ text: z.string().optional() })) }).optional(), finishReason: z.string().optional() })).optional(),
  usageMetadata: z.object({ promptTokenCount: z.number().optional(), candidatesTokenCount: z.number().optional() }).optional(),
});

export class GeminiLlm extends BaseLlm {
  constructor(private apiKey: string, models: { fast: string; smart: string }, recordRun: (r: AgentRunRecord) => Promise<void>) {
    super(models, recordRun);
  }

  protected async call(model: string, system: string, prompt: string, schema: z.ZodType<unknown>): Promise<RawResult> {
    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema), temperature: 0.2 },
    });
    // Transient errors (overload, rate limit, timeout) get their own retries with backoff,
    // so they don't use up the single "invalid output" retry in BaseLlm.
    let res: Response | null = null;
    let lastErr = "";
    for (let i = 0; i < 3; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 2000 * 2 ** (i - 1)));
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          body: requestBody,
          signal: AbortSignal.timeout(90_000),
        });
      } catch (e) {
        lastErr = (e as Error).message;
        res = null;
        continue;
      }
      if (res.status !== 429 && res.status < 500) break;
      lastErr = `HTTP ${res.status}`;
    }
    if (!res) throw new Error(`Gemini unreachable: ${lastErr}`);
    if (!res.ok) throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = GeminiResponse.parse(await res.json());
    const cand = body.candidates?.[0];
    const text = cand?.content?.parts.map((p) => p.text ?? "").join("") ?? "";
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return {
      data,
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      refused: cand?.finishReason === "SAFETY",
    };
  }
}
