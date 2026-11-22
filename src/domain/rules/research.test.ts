import { describe, expect, it } from "vitest";
import { quoteAppearsIn } from "./quote-check";
import { enforceEvidence, scoreFit } from "./scoring";
import type { QualificationReason } from "@/domain/entities";

describe("quoteAppearsIn", () => {
  const page = "Acme Goods  is hiring a Senior   Accountant to join our\nfinance team. We ship across the U.S.";
  it("matches despite whitespace and case", () => {
    expect(quoteAppearsIn("hiring a senior accountant to join our finance team", page)).toBe(true);
  });
  it("matches smart quotes", () => {
    expect(quoteAppearsIn("We’re growing fast in retail", "we're growing fast in retail stores")).toBe(true);
  });
  it("rejects invented or too-short quotes", () => {
    expect(quoteAppearsIn("hiring a CFO to lead finance", page)).toBe(false);
    expect(quoteAppearsIn("Acme", page)).toBe(false);
  });
});

const r = (criterion: QualificationReason["criterion"], verdict: QualificationReason["verdict"], evidence = true) =>
  ({
    criterion,
    verdict,
    reason: "x",
    factId: evidence ? "f1" : null,
    quote: evidence ? "some quote here" : null,
    sourceUrl: evidence ? "https://a.com" : null,
  }) satisfies QualificationReason;

describe("scoring", () => {
  it("gives 100 when every criterion is met", () => {
    expect(
      scoreFit([r("us_ecommerce", "meets"), r("trigger", "meets"), r("revenue_range", "meets"), r("team_size", "meets"), r("contact_role", "meets")]),
    ).toBe(100);
  });
  it("gives partial credit for unknown", () => {
    expect(scoreFit([r("us_ecommerce", "meets"), r("trigger", "unknown", false)])).toBe(Math.round(35 + 0.25 * 25));
  });
  it("caps non-ecommerce companies", () => {
    expect(scoreFit([r("us_ecommerce", "fails"), r("trigger", "meets"), r("revenue_range", "meets")])).toBe(20);
  });
  it("downgrades verdicts without evidence to unknown", () => {
    expect(enforceEvidence(r("trigger", "meets", false)).verdict).toBe("unknown");
    expect(enforceEvidence(r("trigger", "meets")).verdict).toBe("meets");
  });
});
