import { describe, expect, it } from "vitest";
import type { LlmPort } from "@/application/ports";
import type { ClassifyOutput } from "@/application/prompts/reply";
import { FakeCalendar, FakeLlm, FakeMail, FakeRepo } from "./fakes";
import { handleReply } from "./handle-reply";
import { bookCall } from "./book-call";
import { NoLlmForTests } from "./test-helpers";

const cls = (o: Partial<ClassifyOutput>): ClassifyOutput => ({ intent: "unsure", confidence: 0.95, language: "en", kb_entry_id: null, preferred_time: null, ...o });

async function setup(llm: LlmPort) {
  const repo = new FakeRepo();
  const company = await repo.upsertCompany({ name: "Acme", domain: "acme.com", website: "https://acme.com", trigger: null, source: "seed" });
  const contact = await repo.getOrCreateContact({ companyId: company.id, name: "Sam", email: "prospect@acme.com.sandbox" });
  const thread = await repo.createThread(contact.id);
  await repo.saveMessage({ threadId: thread.id, direction: "outbound", status: "sent", subject: "Your finance hire", body: "Hi Sam..." });
  const mail = new FakeMail();
  const calendar = new FakeCalendar();
  return { repo, mail, calendar, thread, company, deps: { repo, llm, mail, calendar } };
}

describe("handleReply", () => {
  it("stop: suppresses email + domain, cancels drafts, sends nothing, never calls the LLM", async () => {
    const llm = new FakeLlm({});
    const { repo, mail, thread, deps } = await setup(llm);
    await repo.saveMessage({ threadId: thread.id, direction: "outbound", status: "draft", body: "follow-up" });
    const r = await handleReply(deps, thread.id, "Please unsubscribe me.");
    expect(r.route).toBe("stop");
    expect(llm.calls).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
    expect(repo.suppressions.map((s) => s.value)).toEqual(["prospect@acme.com.sandbox", "acme.com"]);
    expect(repo.messages.find((m) => m.body === "follow-up")!.status).toBe("cancelled");
    expect(repo.threads[0].status).toBe("stopped");
  });

  it("bot question: honest fixed answer, even if the classifier says otherwise", async () => {
    const { mail, thread, deps } = await setup(new FakeLlm({ classify_reply: cls({ intent: "wants_call" }) }));
    const r = await handleReply(deps, thread.id, "Wait, are you a bot?");
    expect(r.route).toBe("bot_question");
    expect(mail.sent[0].body).toMatch(/AI assistant/);
  });

  it("pricing: fixed answer, no price, 3 slots with timezone", async () => {
    const { mail, thread, deps } = await setup(new FakeLlm({ classify_reply: cls({ intent: "pricing" }) }));
    const r = await handleReply(deps, thread.id, "How much do you charge?");
    expect(r.route).toBe("pricing");
    expect(mail.sent[0].body).not.toMatch(/\$/);
    expect(mail.sent[0].body.match(/EST/g)).toHaveLength(3);
  });

  it("wants call: offers slots, then books the one they pick (idempotently)", async () => {
    const llm = new FakeLlm({ classify_reply: (req: { prompt: string }) => cls({ intent: "wants_call", preferred_time: req.prompt.includes("Tuesday") ? "Tuesday afternoon" : null }) });
    const { repo, thread, calendar, deps } = await setup(llm);
    expect((await handleReply(deps, thread.id, "Sure, happy to chat")).route).toBe("offer_slots");
    const r = await handleReply(deps, thread.id, "Tuesday afternoon works");
    expect(r.route).toBe("booked");
    expect(repo.bookings).toHaveLength(1);
    expect(repo.threads[0].status).toBe("booked");
    // Booking the same slot again returns the same booking, no double-booking.
    const again = await bookCall({ repo, calendar }, thread.id, { start: new Date("2026-12-01T19:00:00Z"), end: new Date("2026-12-01T19:30:00Z"), timezone: "America/New_York" });
    expect(again.created).toBe(false);
    expect(repo.bookings).toHaveLength(1);
  });

  it.each([
    ["non-English", cls({ intent: "question", language: "fr", kb_entry_id: "what-we-do" }), "Qu'est-ce que vous faites exactement ?"],
    ["legal", cls({ intent: "legal" }), "Where did you get my data? GDPR request."],
    ["hostile", cls({ intent: "hostile" }), "This is spam, idiot."],
    ["outside KB", cls({ intent: "question", kb_entry_id: null }), "Do you do payroll in Germany?"],
    ["low confidence", cls({ intent: "wants_call", confidence: 0.4 }), "hmm maybe"],
  ])("%s -> human, nothing sent", async (_n, out, text) => {
    const { mail, repo, thread, deps } = await setup(new FakeLlm({ classify_reply: out }));
    const r = await handleReply(deps, thread.id, text);
    expect(r.route).toBe("human");
    expect(mail.sent).toHaveLength(0);
    expect(repo.threads[0].status).toBe("human");
  });

  it("question in KB: answers and offers slots; a price in the answer is blocked", async () => {
    const good = new FakeLlm({
      classify_reply: cls({ intent: "question", kb_entry_id: "tools" }),
      answer_reply: { answerable: true, body: "We work in QuickBooks Online or Xero. Would a short call help?", kb_ids_used: ["tools"] },
    });
    const a = await setup(good);
    expect((await handleReply(a.deps, a.thread.id, "Do you use Xero?")).route).toBe("answer");

    const bad = new FakeLlm({
      classify_reply: cls({ intent: "question", kb_entry_id: "tools" }),
      answer_reply: { answerable: true, body: "We use Xero, from $300/mo.", kb_ids_used: ["tools"] },
    });
    const b = await setup(bad);
    const r = await handleReply(b.deps, b.thread.id, "Do you use Xero?");
    expect(r.route).toBe("human");
    expect(b.mail.sent).toHaveLength(0);
  });

  it("out of office: no reply, no escalation", async () => {
    const { mail, thread, deps } = await setup(new FakeLlm({ classify_reply: cls({ intent: "out_of_office" }) }));
    expect((await handleReply(deps, thread.id, "I'm out of office until Monday.")).route).toBe("out_of_office");
    expect(mail.sent).toHaveLength(0);
  });

  it("taken over by a human: the agent stays quiet", async () => {
    const llm = new FakeLlm({});
    const { repo, mail, thread, deps } = await setup(llm);
    await repo.setThreadStatus(thread.id, "human");
    expect((await handleReply(deps, thread.id, "Tuesday works")).route).toBe("human");
    expect(llm.calls).toHaveLength(0);
    expect(mail.sent).toHaveLength(0);
  });

  it("no LLM: pricing still gets the safe fixed answer, the rest goes to a human", async () => {
    const a = await setup(new NoLlmForTests());
    expect((await handleReply(a.deps, a.thread.id, "what's the price?")).route).toBe("pricing");
    const b = await setup(new NoLlmForTests());
    expect((await handleReply(b.deps, b.thread.id, "Tell me more")).route).toBe("human");
  });
});
