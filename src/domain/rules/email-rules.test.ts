import { describe, expect, it } from "vitest";
import { checkFirstEmail, OPT_OUT_LINE, withOptOut } from "./email-rules";

const facts = [{ id: "f1", quote: "We are hiring a Staff Accountant to join our finance team" }];
const claim = { text: "you're hiring a Staff Accountant", factId: "f1" };

describe("checkFirstEmail", () => {
  it("passes a short, backed, price-free email", () => {
    const body = withOptOut("Hi Sam, I saw you're hiring a Staff Accountant. Open to a 20-minute call next week?");
    expect(checkFirstEmail("Your finance hire", body, [claim], facts)).toEqual({ ok: true, violations: [] });
  });
  it("fails without any fact", () => {
    expect(checkFirstEmail("Hi", "Quick chat?", [], facts).ok).toBe(false);
  });
  it("fails on price, length and unbacked claims", () => {
    const long = "word ".repeat(130);
    const r = checkFirstEmail("Offer", `Hi, you're hiring a Staff Accountant. Plans from $99. ${long}`, [claim, { text: "Hi", factId: "nope" }], facts);
    expect(r.violations.join(" ")).toMatch(/pricing/);
    expect(r.violations.join(" ")).toMatch(/Too long/);
    expect(r.violations.join(" ")).toMatch(/not backed/);
  });
  it("appends the opt-out line once", () => {
    expect(withOptOut(withOptOut("Hi")).split(OPT_OUT_LINE)).toHaveLength(2);
  });
});
