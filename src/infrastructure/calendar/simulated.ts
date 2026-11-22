// Fallback when Cal.com isn't configured: weekday slots in US Eastern time, minus booked ones.
// Shown in the UI as "simulated".
import type { CalendarPort, SalesRepository } from "@/application/ports";
import type { Slot } from "@/domain/entities";

const SLOT_HOURS_ET = [10, 13, 15]; // local Eastern hours
const DURATION_MIN = 30;
const TZ = "America/New_York";

/** UTC Date for a given Eastern wall-clock time on the same calendar day as `day`. */
function easternTime(day: Date, hour: number): Date {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(day);
  // Try both possible offsets (EST -5 / EDT -4) and keep the one that renders as `hour` in ET.
  for (const offset of [5, 4]) {
    const d = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
    d.setUTCHours(d.getUTCHours() + offset);
    const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false }).format(d)) % 24;
    if (h === hour) return d;
  }
  throw new Error("timezone conversion failed");
}

export class SimulatedCalendar implements CalendarPort {
  readonly simulated = true;
  constructor(private repo: SalesRepository) {}

  async availableSlots({ from, days, timezone }: { from: Date; days: number; timezone: string }): Promise<Slot[]> {
    const taken = new Set((await this.repo.listBookings()).map((b) => +new Date(b.start)));
    const minStart = +from + 12 * 3600_000; // at least 12h notice
    const slots: Slot[] = [];
    for (let i = 0; i <= days + 4 && slots.length < 9; i++) {
      const day = new Date(+from + i * 86400_000);
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(day);
      if (weekday === "Sat" || weekday === "Sun") continue;
      for (const h of SLOT_HOURS_ET) {
        const start = easternTime(day, h);
        if (+start < minStart || taken.has(+start)) continue;
        slots.push({ start, end: new Date(+start + DURATION_MIN * 60_000), timezone, simulated: true });
      }
    }
    // Spread the offer over different days: first slot of each day first.
    return slots.sort((a, b) => +a.start - +b.start);
  }

  async book(): Promise<{ externalId: string | null }> {
    return { externalId: null }; // the bookings row (unique idempotency key) IS the simulated calendar
  }
}
