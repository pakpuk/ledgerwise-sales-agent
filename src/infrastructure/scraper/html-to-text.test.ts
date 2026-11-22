import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-to-text";

describe("htmlToText", () => {
  it("drops scripts/styles and keeps readable text", () => {
    const html = `<html><head><title>x</title><style>.a{}</style></head><body>
      <script>alert("ignore me")</script><h1>Acme&nbsp;Goods</h1><p>We&rsquo;re hiring a <b>Staff Accountant</b>.</p></body></html>`;
    const t = htmlToText(html);
    expect(t).toContain("Acme Goods");
    expect(t).toContain("We’re hiring a Staff Accountant .");
    expect(t).not.toContain("alert");
  });
});
