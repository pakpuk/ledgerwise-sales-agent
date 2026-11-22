// Ports: the only way use cases talk to the outside world.
import type { z } from "zod";
import type { Company, CompanySource, Contact, Fact, Message, Page, Qualification, QualificationReason, Slot, Thread, ThreadStatus } from "@/domain/entities";

export type ModelTier = "fast" | "smart";

/** Thrown when the LLM output fails validation twice: the caller must flag for a human. */
export class LlmOutputError extends Error {}
/** Thrown when no LLM key is configured. */
export class LlmUnavailableError extends Error {}

export interface LlmRequest<T> {
  kind: string; // e.g. "qualify", logged in agent_runs
  promptVersion: string;
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  subjectId?: string;
}

export interface LlmPort {
  readonly available: boolean;
  /** Structured output -> Zod validation -> retry once -> LlmOutputError. Records an agent_run. */
  json<T>(req: LlmRequest<T>): Promise<T>;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchPort {
  readonly available: boolean;
  search(query: string, maxResults?: number): Promise<SearchResult[]>;
}

export interface ScraperPort {
  /** Fetch a URL and return readable plain text (throws on HTTP/network errors). */
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

export interface AgentRunRecord {
  kind: string;
  model: string;
  promptVersion: string;
  subjectId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  error?: string;
}

export interface CompanyWithQualification extends Company {
  qualification: Qualification | null;
  factCount: number;
}

/** Persistence port. One interface on purpose (small app); grows per checkpoint. */
export interface SalesRepository {
  upsertCompany(c: { name: string; domain: string; website: string; trigger: string | null; source: CompanySource }): Promise<Company>;
  getCompany(id: string): Promise<Company | null>;
  setCompanyStatus(id: string, status: Company["status"]): Promise<void>;
  listCompanies(): Promise<CompanyWithQualification[]>;
  savePage(p: { companyId: string; url: string; text: string }): Promise<Page>;
  listPages(companyId: string): Promise<Page[]>;
  saveFacts(facts: Omit<Fact, "id">[]): Promise<Fact[]>;
  listFacts(companyId: string): Promise<Fact[]>;
  saveQualification(q: { companyId: string; score: number; reasons: QualificationReason[] }): Promise<Qualification>;
  recordRun(run: AgentRunRecord): Promise<void>;

  // Conversations
  getOrCreateContact(c: { companyId: string; name: string; email: string; timezone?: string | null }): Promise<Contact>;
  createThread(contactId: string): Promise<Thread>;
  getThread(id: string): Promise<ThreadView | null>;
  listThreads(): Promise<ThreadView[]>;
  setThreadStatus(id: string, status: ThreadStatus): Promise<void>;
  saveMessage(m: NewMessage): Promise<Message>;
  getMessage(id: string): Promise<Message | null>;
  updateMessage(id: string, patch: Partial<Pick<Message, "status" | "subject" | "body" | "claims" | "meta" | "sentAt">>): Promise<void>;

  // Opt-outs
  /** Checks the exact email AND the company domain. */
  findSuppression(email: string, companyDomain: string): Promise<{ value: string; kind: "email" | "domain" } | null>;
  addSuppression(value: string, kind: "email" | "domain", reason: string): Promise<void>;
  /** Cancel unsent drafts/approved messages to anyone at this company. Returns how many. */
  cancelPendingMessages(companyId: string): Promise<number>;
}

export type NewMessage = Omit<Message, "id" | "createdAt" | "sentAt" | "meta" | "claims" | "subject"> &
  Partial<Pick<Message, "meta" | "claims" | "subject" | "sentAt">>;

export interface ThreadView {
  thread: Thread;
  contact: Contact;
  company: Company;
  messages: Message[]; // oldest first
}
