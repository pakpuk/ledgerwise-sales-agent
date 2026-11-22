import { LlmUnavailableError, type LlmPort } from "@/application/ports";

export class NoLlm implements LlmPort {
  readonly available = false;
  async json<T>(): Promise<T> {
    throw new LlmUnavailableError("No LLM key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY)");
  }
}
