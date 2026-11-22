import { describe, expect, it } from "vitest";
import { formatSlot, matchSlot } from "./slots";

const tz = "America/New_York";
// Tue 2026-12-01 15:00Z = 10:00 ET ; Tue 19:00Z = 14:00 ET ; Thu 2026-12-03 15:00Z = 10:00 ET
const slots = [
  { start: new Date("2026-12-01T15:00:00Z"), timezone: tz },
  { start: new Date("2026-12-01T19:00:00Z"), timezone: tz },
  { start: new Date("2026-12-03T15:00:00Z"), timezone: tz },
];

describe("slots", () => {
  it("formats with the timezone", () => {
    expect(formatSlot(slots[0])).toMatch(/Tuesday, Dec 1.*10:00 AM EST/);
  });
  it("matches a day", () => {
    expect(matchSlot(slots, "Thursday works for me")).toBe(slots[2]);
  });
  it("matches day + part of day", () => {
    expect(matchSlot(slots, "Tuesday afternoon is good")).toBe(slots[1]);
    expect(matchSlot(slots, "tuesday at 10am")).toBe(slots[0]);
  });
  it("is null when ambiguous or impossible", () => {
    expect(matchSlot(slots, "sure, let's talk")).toBeNull();
    expect(matchSlot(slots, "Friday works")).toBeNull();
  });
  it("accepts 'the first one'", () => {
    expect(matchSlot(slots, "the first one works")).toBe(slots[0]);
  });
});
