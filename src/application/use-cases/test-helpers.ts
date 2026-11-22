import { LlmUnavailableError, type LlmPort } from "@/application/ports";

export class NoLlmForTests implements LlmPort {
  readonly available = false;
  async json<T>(): Promise<T> {
    throw new LlmUnavailableError("no llm");
  }
}
