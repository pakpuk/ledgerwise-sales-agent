import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import type { AgentRunRecord } from "@/application/ports";
import { BaseLlm, type RawResult } from "./base";

export class AnthropicLlm extends BaseLlm {
  private client: Anthropic;
  constructor(apiKey: string, models: { fast: string; smart: string }, recordRun: (r: AgentRunRecord) => Promise<void>) {
    super(models, recordRun);
    this.client = new Anthropic({ apiKey, maxRetries: 2 });
  }

  protected async call(model: string, system: string, prompt: string, schema: z.ZodType<unknown>): Promise<RawResult> {
    const res = await this.client.messages.parse({
      model,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(schema), effort: model === this.models.fast ? "low" : "medium" },
    });
    return {
      data: res.parsed_output ?? null,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      refused: res.stop_reason === "refusal",
    };
  }
}
