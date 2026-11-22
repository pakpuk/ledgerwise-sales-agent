import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  boolean,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Claim, MessageMeta, QualificationReason } from "@/domain/entities";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const companies = pgTable(
  "companies",
  {
    id: id(),
    name: text("name").notNull(),
    domain: text("domain").notNull(),
    website: text("website").notNull(),
    trigger: text("trigger"),
    source: text("source", { enum: ["seed", "research"] }).notNull().default("seed"),
    status: text("status", { enum: ["new", "researched", "qualified", "disqualified"] }).notNull().default("new"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("companies_domain_uq").on(t.domain)],
);

export const pages = pgTable(
  "pages",
  {
    id: id(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    text: text("text").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("pages_company_idx").on(t.companyId)],
);

export const facts = pgTable(
  "facts",
  {
    id: id(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
    sourceUrl: text("source_url").notNull(),
    statement: text("statement").notNull(),
    quote: text("quote").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("facts_company_idx").on(t.companyId)],
);

export const qualifications = pgTable(
  "qualifications",
  {
    id: id(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    reasons: jsonb("reasons").$type<QualificationReason[]>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("qualifications_company_idx").on(t.companyId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    timezone: text("timezone"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("contacts_email_uq").on(t.email), index("contacts_company_idx").on(t.companyId)],
);

export const threads = pgTable(
  "threads",
  {
    id: id(),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["active", "human", "stopped", "booked"] }).notNull().default("active"),
    createdAt: createdAt(),
  },
  (t) => [index("threads_contact_idx").on(t.contactId)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["outbound", "inbound"] }).notNull(),
    status: text("status", { enum: ["draft", "approved", "rejected", "sent", "received", "cancelled"] }).notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    claims: jsonb("claims").$type<Claim[]>().notNull().default([]),
    /** Why the agent chose this (route, escalation reason, guard violations). */
    meta: jsonb("meta").$type<MessageMeta>().notNull().default({}),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_thread_idx").on(t.threadId), index("messages_status_idx").on(t.status)],
);

/** Opt-outs (an email or a whole domain). Checked before any LLM call and inside send-message. */
export const suppressions = pgTable("suppressions", {
  value: text("value").primaryKey(), // lower-cased email or domain
  kind: text("kind", { enum: ["email", "domain"] }).notNull(),
  reason: text("reason").notNull(),
  createdAt: createdAt(),
});

/** Fallback availability when Cal.com is not configured (shown as "simulated"). */
export const slots = pgTable("slots", {
  id: id(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
  taken: boolean("taken").notNull().default(false),
});

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    start: timestamp("start", { withTimezone: true }).notNull(),
    end: timestamp("end", { withTimezone: true }).notNull(),
    timezone: text("timezone").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    provider: text("provider", { enum: ["calcom", "simulated"] }).notNull(),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("bookings_idem_uq").on(t.idempotencyKey)],
);

/** One row per LLM call: cost and latency tracking. */
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: id(),
    kind: text("kind").notNull(),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull().default("n/a"),
    subjectId: text("subject_id"), // company or thread this run was for (cost per lead / per reply)
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6, mode: "number" }).notNull().default(0),
    latencyMs: integer("latency_ms").notNull().default(0),
    ok: boolean("ok").notNull().default(true),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [index("agent_runs_created_idx").on(t.createdAt)],
);
