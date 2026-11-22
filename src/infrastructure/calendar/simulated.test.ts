import { describe, expect, it } from "vitest";
import { FakeRepo } from "@/application/use-cases/fakes";
import { formatSlot } from "@/domain/rules/slots";
import { SimulatedCalendar } from "./simulated";

describe("SimulatedCalendar", () => {
  it("offers weekday ET slots and skips booked ones", async () => {
    const repo = new FakeRepo();
    const cal = new SimulatedCalendar(repo);
    const from = new Date("2026-11-27T12:00:00Z"); // Friday
    const slots = await cal.availableSlots({ from, days: 7, timezone: "America/New_York" });
    expect(slots.length).toBeGreaterThan(3);
    expect(slots.every((s) => !/Saturday|Sunday/.test(formatSlot(s)))).toBe(true);
    expect(formatSlot(slots[0])).toMatch(/(10:00 AM|1:00 PM|3:00 PM) EST/);
    await repo.createBooking({ threadId: "t", start: slots[0].start, end: slots[0].end, timezone: "America/New_York", idempotencyKey: "k", provider: "simulated", externalId: null });
    const after = await cal.availableSlots({ from, days: 7, timezone: "America/New_York" });
    expect(after.some((s) => +s.start === +slots[0].start)).toBe(false);
  });
});
