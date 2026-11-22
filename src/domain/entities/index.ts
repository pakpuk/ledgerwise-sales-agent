// Domain entities: plain types, no framework imports.

export type CompanyStatus = "new" | "researched" | "qualified" | "disqualified";

export interface Company {
  id: string;
  name: string;
  domain: string;
  status: CompanyStatus;
  createdAt: Date;
}

/** A page we fetched and stored as plain text. Quotes must appear in `text`. */
export interface Page {
  id: string;
  companyId: string;
  url: string;
  text: string;
  fetchedAt: Date;
}

/** A fact is a statement backed by a verbatim quote from a saved page. */
export interface Fact {
  id: string;
  companyId: string;
  pageId: string;
  sourceUrl: string;
  statement: string;
  quote: string;
}

export interface QualificationReason {
  reason: string;
  quote: string;
  sourceUrl: string;
}

export interface Qualification {
  id: string;
  companyId: string;
  score: number; // 0-100
  reasons: QualificationReason[];
  createdAt: Date;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string;
  timezone: string | null;
}

export type ThreadStatus = "active" | "human" | "stopped" | "booked";

export interface Thread {
  id: string;
  contactId: string;
  status: ThreadStatus;
  createdAt: Date;
}

export type MessageDirection = "outbound" | "inbound";
export type MessageStatus = "draft" | "approved" | "rejected" | "sent" | "received";

/** A claim in an outbound message must point at a fact. */
export interface Claim {
  text: string;
  factId: string;
}

export interface Message {
  id: string;
  threadId: string;
  direction: MessageDirection;
  status: MessageStatus;
  subject: string | null;
  body: string;
  claims: Claim[];
  createdAt: Date;
}

export type ReplyIntent =
  | "stop"
  | "pricing"
  | "bot_question"
  | "wants_call"
  | "question"
  | "objection"
  | "not_now"
  | "out_of_office"
  | "hostile"
  | "legal"
  | "unsure";

export interface Slot {
  start: Date;
  end: Date;
  timezone: string;
  simulated: boolean;
}

export interface Booking {
  id: string;
  threadId: string;
  start: Date;
  end: Date;
  timezone: string;
  idempotencyKey: string;
  provider: "calcom" | "simulated";
  externalId: string | null;
}

export interface AgentRun {
  id: string;
  kind: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  ok: boolean;
  createdAt: Date;
}
