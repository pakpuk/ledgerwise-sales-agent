import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { AgentRunRecord, CompanyWithQualification, NewMessage, SalesRepository, ThreadView } from "@/application/ports";
import type { Booking, Company, Contact, Fact, Message, Page, Qualification, QualificationReason, Thread, ThreadStatus } from "@/domain/entities";
import type { Db } from "./client";
import * as t from "./schema";

export class DrizzleRepository implements SalesRepository {
  constructor(private db: Db) {}

  async upsertCompany(c: Parameters<SalesRepository["upsertCompany"]>[0]): Promise<Company> {
    const [row] = await this.db
      .insert(t.companies)
      .values(c)
      .onConflictDoUpdate({ target: t.companies.domain, set: { name: c.name, website: c.website, trigger: c.trigger } })
      .returning();
    return row;
  }

  async getCompany(id: string): Promise<Company | null> {
    return (await this.db.query.companies.findFirst({ where: eq(t.companies.id, id) })) ?? null;
  }

  async setCompanyStatus(id: string, status: Company["status"]) {
    await this.db.update(t.companies).set({ status }).where(eq(t.companies.id, id));
  }

  async listCompanies(): Promise<CompanyWithQualification[]> {
    const [companies, quals, counts] = await Promise.all([
      this.db.select().from(t.companies).orderBy(desc(t.companies.createdAt)),
      this.db.selectDistinctOn([t.qualifications.companyId]).from(t.qualifications).orderBy(t.qualifications.companyId, desc(t.qualifications.createdAt)),
      this.db.select({ companyId: t.facts.companyId, n: sql<number>`count(*)::int` }).from(t.facts).groupBy(t.facts.companyId),
    ]);
    const qBy = new Map(quals.map((q) => [q.companyId, q as Qualification]));
    const nBy = new Map(counts.map((c) => [c.companyId, c.n]));
    return companies.map((c) => ({ ...c, qualification: qBy.get(c.id) ?? null, factCount: nBy.get(c.id) ?? 0 }));
  }

  async savePage(p: { companyId: string; url: string; text: string }): Promise<Page> {
    const [row] = await this.db.insert(t.pages).values(p).returning();
    return row;
  }

  async listPages(companyId: string): Promise<Page[]> {
    return this.db.select().from(t.pages).where(eq(t.pages.companyId, companyId));
  }

  async saveFacts(facts: Omit<Fact, "id">[]): Promise<Fact[]> {
    if (facts.length === 0) return [];
    return this.db.insert(t.facts).values(facts).returning();
  }

  async listFacts(companyId: string): Promise<Fact[]> {
    return this.db.select().from(t.facts).where(eq(t.facts.companyId, companyId));
  }

  async saveQualification(q: { companyId: string; score: number; reasons: QualificationReason[] }): Promise<Qualification> {
    const [row] = await this.db.insert(t.qualifications).values(q).returning();
    return row;
  }

  async recordRun(run: AgentRunRecord) {
    await this.db.insert(t.agentRuns).values({ ...run, error: run.error ?? null, subjectId: run.subjectId ?? null });
  }

  async getOrCreateContact(c: { companyId: string; name: string; email: string; timezone?: string | null }): Promise<Contact> {
    const email = c.email.toLowerCase();
    const [row] = await this.db
      .insert(t.contacts)
      .values({ ...c, email, timezone: c.timezone ?? null })
      .onConflictDoUpdate({ target: t.contacts.email, set: { name: c.name } })
      .returning();
    return row;
  }

  async createThread(contactId: string): Promise<Thread> {
    const [row] = await this.db.insert(t.threads).values({ contactId }).returning();
    return row;
  }

  private async views(threads: Thread[]): Promise<ThreadView[]> {
    if (threads.length === 0) return [];
    const contactIds = [...new Set(threads.map((x) => x.contactId))];
    const contacts = await this.db.select().from(t.contacts).where(inArray(t.contacts.id, contactIds));
    const companyIds = [...new Set(contacts.map((c) => c.companyId))];
    const [companies, messages] = await Promise.all([
      this.db.select().from(t.companies).where(inArray(t.companies.id, companyIds)),
      this.db.select().from(t.messages).where(inArray(t.messages.threadId, threads.map((x) => x.id))).orderBy(asc(t.messages.createdAt)),
    ]);
    const contactBy = new Map(contacts.map((c) => [c.id, c]));
    const companyBy = new Map(companies.map((c) => [c.id, c]));
    return threads.map((thread) => {
      const contact = contactBy.get(thread.contactId)!;
      return { thread, contact, company: companyBy.get(contact.companyId)!, messages: messages.filter((m) => m.threadId === thread.id) as Message[] };
    });
  }

  async getThread(id: string): Promise<ThreadView | null> {
    const rows = await this.db.select().from(t.threads).where(eq(t.threads.id, id));
    return (await this.views(rows))[0] ?? null;
  }

  async listThreads(): Promise<ThreadView[]> {
    return this.views(await this.db.select().from(t.threads).orderBy(desc(t.threads.createdAt)));
  }

  async setThreadStatus(id: string, status: ThreadStatus) {
    await this.db.update(t.threads).set({ status }).where(eq(t.threads.id, id));
  }

  async saveMessage(m: NewMessage): Promise<Message> {
    const [row] = await this.db.insert(t.messages).values({ ...m, meta: m.meta ?? {}, claims: m.claims ?? [], subject: m.subject ?? null }).returning();
    return row as Message;
  }

  async getMessage(id: string): Promise<Message | null> {
    const [row] = await this.db.select().from(t.messages).where(eq(t.messages.id, id));
    return (row as Message) ?? null;
  }

  async updateMessage(id: string, patch: Partial<Pick<Message, "status" | "subject" | "body" | "claims" | "meta" | "sentAt">>) {
    await this.db.update(t.messages).set(patch).where(eq(t.messages.id, id));
  }

  async findSuppression(email: string, companyDomain: string) {
    const e = email.toLowerCase();
    const [row] = await this.db
      .select()
      .from(t.suppressions)
      .where(or(eq(t.suppressions.value, e), eq(t.suppressions.value, companyDomain.toLowerCase())));
    return row ? { value: row.value, kind: row.kind } : null;
  }

  async addSuppression(value: string, kind: "email" | "domain", reason: string) {
    await this.db.insert(t.suppressions).values({ value: value.toLowerCase(), kind, reason }).onConflictDoNothing();
  }

  async cancelPendingMessages(companyId: string): Promise<number> {
    const contacts = await this.db.select({ id: t.contacts.id }).from(t.contacts).where(eq(t.contacts.companyId, companyId));
    if (contacts.length === 0) return 0;
    const threads = await this.db.select({ id: t.threads.id }).from(t.threads).where(inArray(t.threads.contactId, contacts.map((c) => c.id)));
    if (threads.length === 0) return 0;
    const rows = await this.db
      .update(t.messages)
      .set({ status: "cancelled" })
      .where(and(inArray(t.messages.threadId, threads.map((x) => x.id)), inArray(t.messages.status, ["draft", "approved"])))
      .returning({ id: t.messages.id });
    return rows.length;
  }

  async createBooking(b: Omit<Booking, "id">) {
    const [row] = await this.db.insert(t.bookings).values(b).onConflictDoNothing({ target: t.bookings.idempotencyKey }).returning();
    if (row) return { booking: row as Booking, created: true };
    return { booking: (await this.findBooking(b.idempotencyKey))!, created: false };
  }

  async findBooking(idempotencyKey: string) {
    const [row] = await this.db.select().from(t.bookings).where(eq(t.bookings.idempotencyKey, idempotencyKey));
    return (row as Booking) ?? null;
  }

  async listBookings() {
    return (await this.db.select().from(t.bookings).orderBy(asc(t.bookings.start))) as Booking[];
  }

  async listRuns() {
    const rows = await this.db.select().from(t.agentRuns).orderBy(desc(t.agentRuns.createdAt));
    return rows.map((r) => ({ ...r, subjectId: r.subjectId ?? undefined, error: r.error ?? undefined }));
  }
}
