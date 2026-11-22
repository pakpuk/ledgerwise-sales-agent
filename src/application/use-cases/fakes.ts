// In-memory fakes for use-case tests (no DB, no network).
import type { AgentRunRecord, CompanyWithQualification, LlmPort, LlmRequest, MailPort, NewMessage, SalesRepository, ScraperPort, ThreadView } from "@/application/ports";
import type { Company, Contact, Fact, Message, Page, Qualification, QualificationReason, Thread, ThreadStatus } from "@/domain/entities";

let n = 0;
const id = () => `id${++n}`;

export class FakeRepo implements SalesRepository {
  companies: Company[] = [];
  pages: Page[] = [];
  facts: Fact[] = [];
  quals: Qualification[] = [];
  runs: AgentRunRecord[] = [];
  contacts: Contact[] = [];
  threads: Thread[] = [];
  messages: Message[] = [];
  suppressions: { value: string; kind: "email" | "domain"; reason: string }[] = [];

  async upsertCompany(c: Parameters<SalesRepository["upsertCompany"]>[0]) {
    const existing = this.companies.find((x) => x.domain === c.domain);
    if (existing) return Object.assign(existing, c);
    const row: Company = { id: id(), status: "new", createdAt: new Date(), ...c };
    this.companies.push(row);
    return row;
  }
  async getCompany(cid: string) {
    return this.companies.find((c) => c.id === cid) ?? null;
  }
  async setCompanyStatus(cid: string, status: Company["status"]) {
    const c = this.companies.find((x) => x.id === cid);
    if (c) c.status = status;
  }
  async listCompanies(): Promise<CompanyWithQualification[]> {
    return this.companies.map((c) => ({
      ...c,
      qualification: this.quals.filter((q) => q.companyId === c.id).at(-1) ?? null,
      factCount: this.facts.filter((f) => f.companyId === c.id).length,
    }));
  }
  async savePage(p: { companyId: string; url: string; text: string }) {
    const row: Page = { id: id(), fetchedAt: new Date(), ...p };
    this.pages.push(row);
    return row;
  }
  async listPages(cid: string) {
    return this.pages.filter((p) => p.companyId === cid);
  }
  async saveFacts(facts: Omit<Fact, "id">[]) {
    const rows = facts.map((f) => ({ id: id(), ...f }));
    this.facts.push(...rows);
    return rows;
  }
  async listFacts(cid: string) {
    return this.facts.filter((f) => f.companyId === cid);
  }
  async saveQualification(q: { companyId: string; score: number; reasons: QualificationReason[] }) {
    const row: Qualification = { id: id(), createdAt: new Date(), ...q };
    this.quals.push(row);
    return row;
  }
  async recordRun(r: AgentRunRecord) {
    this.runs.push(r);
  }
  async getOrCreateContact(c: { companyId: string; name: string; email: string; timezone?: string | null }) {
    const existing = this.contacts.find((x) => x.email === c.email.toLowerCase());
    if (existing) return existing;
    const row: Contact = { id: id(), timezone: null, ...c, email: c.email.toLowerCase() };
    this.contacts.push(row);
    return row;
  }
  async createThread(contactId: string) {
    const row: Thread = { id: id(), contactId, status: "active", createdAt: new Date() };
    this.threads.push(row);
    return row;
  }
  async getThread(tid: string): Promise<ThreadView | null> {
    const thread = this.threads.find((x) => x.id === tid);
    if (!thread) return null;
    const contact = this.contacts.find((c) => c.id === thread.contactId)!;
    const company = this.companies.find((c) => c.id === contact.companyId)!;
    return { thread, contact, company, messages: this.messages.filter((m) => m.threadId === tid) };
  }
  async listThreads() {
    return Promise.all(this.threads.map((x) => this.getThread(x.id))).then((v) => v.filter((x): x is ThreadView => x !== null));
  }
  async setThreadStatus(tid: string, status: ThreadStatus) {
    const x = this.threads.find((y) => y.id === tid);
    if (x) x.status = status;
  }
  async saveMessage(m: NewMessage) {
    const row: Message = { id: id(), createdAt: new Date(), sentAt: null, meta: {}, claims: [], subject: null, ...m };
    this.messages.push(row);
    return row;
  }
  async getMessage(mid: string) {
    return this.messages.find((m) => m.id === mid) ?? null;
  }
  async updateMessage(mid: string, patch: Partial<Message>) {
    const m = this.messages.find((x) => x.id === mid);
    if (m) Object.assign(m, patch);
  }
  async findSuppression(email: string, companyDomain: string) {
    const e = email.toLowerCase();
    const s = this.suppressions.find((x) => x.value === e || x.value === companyDomain.toLowerCase());
    return s ? { value: s.value, kind: s.kind } : null;
  }
  async addSuppression(value: string, kind: "email" | "domain", reason: string) {
    if (!this.suppressions.some((s) => s.value === value.toLowerCase())) this.suppressions.push({ value: value.toLowerCase(), kind, reason });
  }
  async cancelPendingMessages(companyId: string) {
    const contactIds = this.contacts.filter((c) => c.companyId === companyId).map((c) => c.id);
    const threadIds = this.threads.filter((x) => contactIds.includes(x.contactId)).map((x) => x.id);
    let n = 0;
    for (const m of this.messages) if (threadIds.includes(m.threadId) && (m.status === "draft" || m.status === "approved")) (m.status = "cancelled"), n++;
    return n;
  }
}

export class FakeMail implements MailPort {
  sent: { to: string; subject: string; body: string }[] = [];
  async send(msg: { to: string; subject: string; body: string }) {
    this.sent.push(msg);
    return { id: `fake-${this.sent.length}` };
  }
}

export class FakeScraper implements ScraperPort {
  constructor(private pages: Record<string, string>) {}
  async fetchText(url: string) {
    const text = this.pages[url];
    if (text === undefined) throw new Error("HTTP 404");
    return { url, text };
  }
}

/** Returns canned outputs by `kind`, validated with the real schema. */
export class FakeLlm implements LlmPort {
  readonly available = true;
  calls: string[] = [];
  constructor(private outputs: Record<string, unknown | ((req: LlmRequest<unknown>) => unknown)>) {}
  async json<T>(req: LlmRequest<T>): Promise<T> {
    this.calls.push(req.kind);
    const o = this.outputs[req.kind];
    const raw = typeof o === "function" ? (o as (r: LlmRequest<unknown>) => unknown)(req as LlmRequest<unknown>) : o;
    return req.schema.parse(raw);
  }
}
