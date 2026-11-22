// Ports: the only way use cases talk to the outside world.
import type { z } from "zod";
import type { Slot } from "@/domain/entities";

export type ModelTier = "fast" | "smart";

export interface LlmPort {
  /** Returns JSON parsed and validated against `schema`. Records an agent_run. */
  json<T>(args: { kind: string; tier: ModelTier; system: string; prompt: string; schema: z.ZodType<T> }): Promise<T>;
}

export interface PageFetcherPort {
  /** Fetch a URL and return plain text. */
  fetchText(url: string): Promise<{ url: string; text: string }>;
}

export interface MailPort {
  send(msg: { to: string; subject: string; body: string }): Promise<{ id: string }>;
}

export interface CalendarPort {
  readonly simulated: boolean;
  availableSlots(args: { from: Date; days: number; timezone: string }): Promise<Slot[]>;
  book(args: { start: Date; end: Date; email: string; name: string; timezone: string; idempotencyKey: string }): Promise<{
    externalId: string | null;
  }>;
}
