import { describe, expect, it } from "vitest";
import { FakeLlm, FakeMail, FakeRepo } from "./fakes";
import { draftEmail } from "./draft-email";
import { approveDraft } from "./review-draft";
import { sendMessage } from "./send-message";

async function setup() {
  const repo = new FakeRepo();
  const c = await repo.upsertCompany({ name: "Acme", domain: "acme.com", website: "https://acme.com", trigger: "Hiring", source: "seed" });
  const [f] = await repo.saveFacts([
    { companyId: c.id, pageId: "p", sourceUrl: "https://acme.com/careers", statement: "Hiring", quote: "We are hiring a Staff Accountant to join our finance team" },
  ]);
  return { repo, c, f };
}

const good = (factId: string) => ({
  subject: "Your finance hire",
  greeting_name: null,
  greeting_name_fact_id: null,
  body: "Hi there, I saw you're hiring a Staff Accountant. We do monthly bookkeeping for e-commerce brands. Worth a 20-minute call?",
  claims: [{ text: "you're hiring a Staff Accountant", fact_id: factId }],
});

describe("draftEmail", () => {
  it("saves a clean draft with the opt-out line", async () => {
    const { repo, c, f } = await setup();
    const msg = await draftEmail({ repo, llm: new FakeLlm({ draft_email: good(f.id) }) }, c.id);
    expect(msg.status).toBe("draft");
    expect(msg.meta.needsHuman).toBeUndefined();
    expect(msg.body).toMatch(/reply "stop"/);
  });

  it("regenerates once, then flags for a human", async () => {
    const { repo, c, f } = await setup();
    const llm = new FakeLlm({ draft_email: { ...good(f.id), body: `${good(f.id).body} Plans start at $199 per month.` } });
    const msg = await draftEmail({ repo, llm }, c.id);
    expect(llm.calls).toEqual(["draft_email", "draft_email"]);
    expect(msg.meta.needsHuman).toBe(true);
    expect(msg.meta.violations?.join(" ")).toMatch(/pricing/);
  });
});

describe("sendMessage (only send path)", () => {
  it("sends an approved clean draft", async () => {
    const { repo, c, f } = await setup();
    const mail = new FakeMail();
    const msg = await draftEmail({ repo, llm: new FakeLlm({ draft_email: good(f.id) }) }, c.id);
    expect((await approveDraft({ repo, mail }, msg.id)).ok).toBe(true);
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0].to).toMatch(/\.sandbox$/);
  });

  it("refuses unapproved drafts and suppressed domains", async () => {
    const { repo, c, f } = await setup();
    const mail = new FakeMail();
    const msg = await draftEmail({ repo, llm: new FakeLlm({ draft_email: good(f.id) }) }, c.id);
    expect((await sendMessage({ repo, mail }, msg.id)).ok).toBe(false); // still a draft
    await repo.addSuppression("acme.com", "domain", "stop");
    const r = await approveDraft({ repo, mail }, msg.id);
    expect(r.ok).toBe(false);
    expect(mail.sent).toHaveLength(0);
    expect(repo.messages[0].status).toBe("draft"); // back in the queue
  });

  it("blocks a human edit that adds a price", async () => {
    const { repo, c, f } = await setup();
    const mail = new FakeMail();
    const msg = await draftEmail({ repo, llm: new FakeLlm({ draft_email: good(f.id) }) }, c.id);
    await repo.updateMessage(msg.id, { body: `${msg.body}\nOnly $99/mo!` });
    expect((await approveDraft({ repo, mail }, msg.id)).ok).toBe(false);
  });
});
