import { desc, eq, sql } from "drizzle-orm";
import type { AgentRunRecord, CompanyWithQualification, SalesRepository } from "@/application/ports";
import type { Company, Fact, Page, Qualification, QualificationReason } from "@/domain/entities";
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
}
