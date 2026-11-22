// In-memory fakes for use-case tests (no DB, no network).
import type { AgentRunRecord, CompanyWithQualification, LlmPort, LlmRequest, SalesRepository, ScraperPort } from "@/application/ports";
import type { Company, Fact, Page, Qualification, QualificationReason } from "@/domain/entities";

let n = 0;
const id = () => `id${++n}`;

export class FakeRepo implements SalesRepository {
  companies: Company[] = [];
  pages: Page[] = [];
  facts: Fact[] = [];
  quals: Qualification[] = [];
  runs: AgentRunRecord[] = [];

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
