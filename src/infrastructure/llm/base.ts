// Shared retry + logging around a provider call: structured output -> Zod -> retry once -> LlmOutputError.

import { LlmOutputError, type AgentRunRecord, type LlmPort, type LlmRequest } from "@/application/ports";
import { costUsd } from "./pricing";

export interface RawResult {
  data: unknown; // parsed JSON (or null)
  inputTokens: number;
  outputTokens: number;
  refused?: boolean;
}

export abstract class BaseLlm implements LlmPort {
  readonly available = true;
  constructor(
    protected models: { fast: string; smart: string },
    private recordRun: (r: AgentRunRecord) => Promise<void>,
  ) {}

  protected abstract call(model: string, system: string, prompt: string, schema: LlmRequest<unknown>["schema"]): Promise<RawResult>;

  async json<T>(req: LlmRequest<T>): Promise<T> {
    const model = this.models[req.tier];
    let lastError = "";
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      let raw: RawResult = { data: null, inputTokens: 0, outputTokens: 0 };
      let ok = false;
      try {
        const prompt = attempt === 1 ? req.prompt : `${req.prompt}\n\nYour previous answer was invalid (${lastError}). Return valid JSON matching the schema.`;
        raw = await this.call(model, req.system, prompt, req.schema as LlmRequest<unknown>["schema"]);
        if (raw.refused) throw new Error("model refused");
        const parsed = req.schema.safeParse(raw.data);
        if (parsed.success) {
          ok = true;
          return parsed.data;
        }
        lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch (e) {
        lastError = (e as Error).message;
      } finally {
        await this.recordRun({
          kind: req.kind,
          model,
          promptVersion: req.promptVersion,
          subjectId: req.subjectId,
          inputTokens: raw.inputTokens,
          outputTokens: raw.outputTokens,
          costUsd: costUsd(model, raw.inputTokens, raw.outputTokens),
          latencyMs: Date.now() - started,
          ok,
          error: ok ? undefined : lastError.slice(0, 500),
        }).catch(() => {});
      }
    }
    throw new LlmOutputError(`LLM output invalid after retry (${req.kind}): ${lastError}`);
  }
}
