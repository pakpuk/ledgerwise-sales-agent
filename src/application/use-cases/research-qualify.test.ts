import { describe, expect, it } from "vitest";
import { FakeLlm, FakeRepo, FakeScraper } from "./fakes";
import { importCompanies } from "./import-companies";
import { qualifyCompany } from "./qualify-company";

const pad = (s: string) => `${s} ${"Lorem ipsum filler text. ".repeat(10)}`;

const pages = {
  "https://acme.com": pad("Acme makes cold brew sold on our Shopify store and Amazon. Shipping across the United States."),
  "https://acme.com/careers": pad("We are hiring a Staff Accountant to join our finance team in Austin, TX."),
};

describe("import + research", () => {
  it("keeps facts whose quote is on the page and drops invented ones", async () => {
    const repo = new FakeRepo();
    const llm = new FakeLlm({
      extract_facts: {
        facts: [
          { statement: "Sells on Shopify and Amazon", quote: "sold on our Shopify store and Amazon" },
          { statement: "Has 200 employees", quote: "our team of 200 employees" }, // not on page
        ],
      },
    });
    const [r] = await importCompanies({ repo, llm, scraper: new FakeScraper(pages) }, [
      { name: "Acme", website: "acme.com", trigger: "Hiring accountant", source_url: "https://acme.com/careers", quote: "hiring a Staff Accountant to join our finance team" },
    ]);
    const quotes = repo.facts.map((f) => f.quote);
    expect(quotes).toContain("hiring a Staff Accountant to join our finance team");
    expect(quotes).toContain("sold on our Shopify store and Amazon");
    expect(quotes).not.toContain("our team of 200 employees");
    expect(r.factsDropped).toBeGreaterThan(0);
    expect(repo.companies[0].status).toBe("researched");
  });

  it("drops a seed quote that is not on the source page", async () => {
    const repo = new FakeRepo();
    const llm = new FakeLlm({ extract_facts: { facts: [] } });
    await importCompanies({ repo, llm, scraper: new FakeScraper(pages) }, [
      { name: "Acme", website: "acme.com", trigger: "Funding", source_url: "https://acme.com/careers", quote: "Acme raised a $5M Series A" },
    ]);
    expect(repo.facts).toHaveLength(0);
  });
});

describe("qualifyCompany", () => {
  it("attaches quotes from cited facts and treats unbacked claims as unknown", async () => {
    const repo = new FakeRepo();
    const c = await repo.upsertCompany({ name: "Acme", domain: "acme.com", website: "https://acme.com", trigger: null, source: "seed" });
    const [f1, f2] = await repo.saveFacts([
      { companyId: c.id, pageId: "p", sourceUrl: "https://acme.com", statement: "Shopify + Amazon, US", quote: "sold on our Shopify store and Amazon" },
      { companyId: c.id, pageId: "p", sourceUrl: "https://acme.com/careers", statement: "Hiring accountant", quote: "hiring a Staff Accountant" },
    ]);
    const llm = new FakeLlm({
      qualify: {
        criteria: [
          { criterion: "us_ecommerce", verdict: "meets", reason: "Shopify and Amazon", fact_id: f1.id },
          { criterion: "trigger", verdict: "meets", reason: "Hiring accountant", fact_id: f2.id },
          { criterion: "revenue_range", verdict: "meets", reason: "Feels like $5M", fact_id: "made-up" },
          { criterion: "team_size", verdict: "unknown", reason: "No data", fact_id: null },
          { criterion: "contact_role", verdict: "unknown", reason: "No data", fact_id: null },
        ],
      },
    });
    const q = await qualifyCompany({ repo, llm }, c.id);
    const revenue = q.reasons.find((r) => r.criterion === "revenue_range")!;
    expect(revenue.verdict).toBe("unknown");
    expect(q.reasons.find((r) => r.criterion === "trigger")!.sourceUrl).toBe("https://acme.com/careers");
    expect(q.score).toBe(35 + 25 + 0.25 * (15 + 15 + 10));
    expect(repo.companies[0].status).toBe("qualified");
  });
});
