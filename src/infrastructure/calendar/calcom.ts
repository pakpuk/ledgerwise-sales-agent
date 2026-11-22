// Cal.com API v2: real availability + real bookings.
// Docs: GET /v2/slots (cal-api-version 2024-09-04), POST /v2/bookings (cal-api-version 2024-08-13).
import { z } from "zod";
import type { CalendarPort } from "@/application/ports";
import type { Slot } from "@/domain/entities";

const BASE = "https://api.cal.com/v2";
const DURATION_MIN = Number(process.env.CAL_EVENT_DURATION_MIN ?? 30);

const SlotsResponse = z.object({
  status: z.string(),
  data: z.record(z.string(), z.array(z.object({ start: z.string() }).or(z.object({ time: z.string() })))),
});
const BookingResponse = z.object({ status: z.string(), data: z.object({ uid: z.string().optional(), id: z.number().optional() }).passthrough() });

export class CalComCalendar implements CalendarPort {
  readonly simulated = false;
  constructor(
    private apiKey: string,
    private eventTypeId: number,
  ) {}

  private headers(version: string) {
    return { Authorization: `Bearer ${this.apiKey}`, "cal-api-version": version, "Content-Type": "application/json" };
  }

  async availableSlots({ from, days, timezone }: { from: Date; days: number; timezone: string }): Promise<Slot[]> {
    const start = new Date(+from + 12 * 3600_000); // 12h notice, same as the simulated calendar
    const end = new Date(+from + days * 86400_000);
    const url = `${BASE}/slots?eventTypeId=${this.eventTypeId}&start=${start.toISOString()}&end=${end.toISOString()}&timeZone=${encodeURIComponent(timezone)}`;
    const res = await fetch(url, { headers: this.headers("2024-09-04"), signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`Cal.com slots HTTP ${res.status}`);
    const body = SlotsResponse.parse(await res.json());
    // Only offer business hours (9:00-17:00) in the prospect's timezone: the Cal.com schedule may be
    // set in another timezone (found live: a Europe-based schedule produced 3 AM Eastern slots).
    const hourIn = (d: Date) => Number(new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(d)) % 24;
    const starts = Object.values(body.data)
      .flat()
      .map((s) => new Date("start" in s ? s.start : s.time))
      .filter((d) => hourIn(d) >= 9 && hourIn(d) < 17);
    // One slot per day first so the 3 offered times are on different days.
    const byDay = new Map<string, Date[]>();
    for (const s of starts.sort((a, b) => +a - +b)) {
      const k = s.toISOString().slice(0, 10);
      byDay.set(k, [...(byDay.get(k) ?? []), s]);
    }
    const spread = [...[...byDay.values()].map((d) => d[0]), ...[...byDay.values()].flatMap((d) => d.slice(1))];
    return spread.map((s) => ({ start: s, end: new Date(+s + DURATION_MIN * 60_000), timezone, simulated: false }));
  }

  async book(args: { start: Date; end: Date; email: string; name: string; timezone: string; idempotencyKey: string }) {
    const res = await fetch(`${BASE}/bookings`, {
      method: "POST",
      headers: this.headers("2024-08-13"),
      body: JSON.stringify({
        start: args.start.toISOString(),
        eventTypeId: this.eventTypeId,
        attendee: { name: args.name, email: args.email, timeZone: args.timezone, language: "en" },
        metadata: { idempotencyKey: args.idempotencyKey.slice(0, 500), source: "ledgerwise-agent" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Cal.com booking HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = BookingResponse.parse(await res.json());
    return { externalId: body.data.uid ?? (body.data.id ? String(body.data.id) : null) };
  }
}
