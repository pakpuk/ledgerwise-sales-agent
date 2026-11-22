import { describe, expect, it } from "vitest";
import { priceGuard, isPricingQuestion } from "./price-guard";
import { detectStop } from "./stop-detector";
import { isBotQuestion } from "./bot-question";
import { claimGuard, claimsInBody } from "./claim-guard";
import { shouldEscalate, type EscalationInput } from "./escalation";

describe("priceGuard", () => {
  it("passes text with no prices", () => {
    expect(priceGuard("Happy to walk you through how we work on a call.").ok).toBe(true);
  });
  it.each([
    "Plans start at $49 per month.",
    "It's only $29",
    "about 500 USD",
    "€1,200 per year",
    "Starting at a low rate",
    "billed per month",
    "just 300/mo",
    "I can give you 20% off",
    "We'll throw in a free month",
    "it costs around 400",
  ])("blocks %s", (t) => expect(priceGuard(t).ok).toBe(false));
  it("does not flag unrelated numbers", () => {
    expect(priceGuard("You opened 3 stores in 2024 and hired 12 people.").ok).toBe(true);
  });
  it("detects pricing questions", () => {
    expect(isPricingQuestion("How much does it cost?")).toBe(true);
    expect(isPricingQuestion("What are your rates?")).toBe(true);
    expect(isPricingQuestion("Sounds good, Tuesday works")).toBe(false);
  });
});

describe("detectStop", () => {
  it.each([
    "STOP",
    "Please unsubscribe me",
    "remove me from your list",
    "Don't contact me again",
    "stop emailing us",
    "Not interested, thanks",
    "opt-out",
  ])("detects %s", (t) => expect(detectStop(t).stop).toBe(true));

  it.each(["Sounds interesting, tell me more", "Can we talk next week?", "What does it cost?"])(
    "ignores %s",
    (t) => expect(detectStop(t).stop).toBe(false),
  );
});

describe("isBotQuestion", () => {
  it.each(["Are you a bot?", "is this AI?", "Was this written by ChatGPT?", "am I talking to a real person", "Is this an automated email?"])(
    "detects %s",
    (t) => expect(isBotQuestion(t)).toBe(true),
  );
  it.each(["Your bot integration sounds useful", "We use AI in our accounting"])("ignores %s", (t) =>
    expect(isBotQuestion(t)).toBe(false),
  );
});

describe("claimGuard", () => {
  const facts = [
    { id: "f1", quote: "We serve over 1,200 restaurants across Europe." },
    { id: "f2", quote: "Acme recently opened an office in Berlin." },
  ];
  it("passes backed claims", () => {
    expect(claimGuard([{ text: "you serve 1,200 restaurants", factId: "f1" }], facts).ok).toBe(true);
  });
  it("rejects unknown or missing fact ids", () => {
    expect(claimGuard([{ text: "you're growing fast", factId: "f9" }], facts).ok).toBe(false);
    expect(claimGuard([{ text: "you're growing fast", factId: "" }], facts).ok).toBe(false);
  });
  it("rejects numbers not in the quote", () => {
    const r = claimGuard([{ text: "you serve 5,000 restaurants", factId: "f1" }], facts);
    expect(r.ok).toBe(false);
    expect(r.violations[0]).toContain("5,000");
  });
  it("checks claims appear in body", () => {
    const claims = [{ text: "you opened an office in Berlin", factId: "f2" }];
    expect(claimsInBody("Hi! I saw you opened an office in Berlin.", claims).ok).toBe(true);
    expect(claimsInBody("Hi there.", claims).ok).toBe(false);
  });
});

describe("shouldEscalate", () => {
  const base: EscalationInput = {
    intent: "wants_call",
    confidence: 0.9,
    threadStatus: "active",
    text: "Sounds good",
    language: "en",
    agentRepliesInThread: 0,
  };
  it("lets confident, normal replies through", () => {
    expect(shouldEscalate(base).escalate).toBe(false);
  });
  it.each<[string, Partial<EscalationInput>]>([
    ["unsure", { intent: "unsure" }],
    ["low confidence", { confidence: 0.5 }],
    ["human took over", { threadStatus: "human" }],
    ["legal wording", { text: "Our lawyer will be in touch" }],
    ["hostile", { text: "this is a scam" }],
    ["hostile intent", { intent: "hostile" }],
    ["non-English", { language: "fr" }],
    ["outside KB", { intent: "question", answerableFromKb: false }],
    ["validator failed twice", { validatorFailures: 2 }],
    ["long thread", { agentRepliesInThread: 4 }],
  ])("escalates: %s", (_n, patch) => expect(shouldEscalate({ ...base, ...patch }).escalate).toBe(true));
});
