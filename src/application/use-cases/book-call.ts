// Idempotent booking: the key is thread + slot start. Booking twice returns the same booking
// and never double-books the calendar.

import type { Slot } from "@/domain/entities";
import type { CalendarPort, SalesRepository } from "@/application/ports";

export const bookingKey = (threadId: string, start: Date) => `${threadId}:${new Date(start).toISOString()}`;

export async function bookCall(
  deps: { repo: SalesRepository; calendar: CalendarPort },
  threadId: string,
  slot: Pick<Slot, "start" | "end" | "timezone">,
) {
  const { repo, calendar } = deps;
  const key = bookingKey(threadId, slot.start);
  const existing = await repo.findBooking(key);
  if (existing) return { booking: existing, created: false };

  const view = await repo.getThread(threadId);
  if (!view) throw new Error("Thread not found");
  if (view.thread.status === "stopped") throw new Error("Prospect opted out: cannot book");

  // Re-check the slot is still free right before booking.
  const free = await calendar.availableSlots({ from: new Date(Date.now() - 60_000), days: 14, timezone: slot.timezone });
  if (!free.some((s) => +new Date(s.start) === +new Date(slot.start))) throw new Error("That slot is no longer available");

  const { externalId } = await calendar.book({
    start: new Date(slot.start),
    end: new Date(slot.end),
    email: view.contact.email,
    name: view.contact.name,
    timezone: slot.timezone,
    idempotencyKey: key,
  });
  const result = await repo.createBooking({
    threadId,
    start: new Date(slot.start),
    end: new Date(slot.end),
    timezone: slot.timezone,
    idempotencyKey: key,
    provider: calendar.simulated ? "simulated" : "calcom",
    externalId,
  });
  await repo.setThreadStatus(threadId, "booked");
  return result;
}
