import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SetupBanner } from "@/components/setup-banner";
import { Badge, Card, EmptyState } from "@/components/ui";
import { formatSlot } from "@/domain/rules/slots";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";

export default async function CallsPage() {
  await connection();
  const rows = hasDb() ? await load() : [];
  const now = Date.now();
  const upcoming = rows.filter((r) => +r.booking.start >= now);
  const past = rows.filter((r) => +r.booking.start < now);

  return (
    <>
      <PageHeader title="Calls" description="Intro calls the agent booked. Times are shown in the prospect's timezone." />
      <SetupBanner />
      {rows.length === 0 ? (
        <EmptyState title="No calls booked yet">When a prospect picks one of the offered times, the call shows up here.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <Section title={`Upcoming (${upcoming.length})`} rows={upcoming} />
          {past.length > 0 && <Section title={`Past (${past.length})`} rows={past} />}
        </div>
      )}
    </>
  );
}

type Row = Awaited<ReturnType<typeof load>>[number];

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-zinc-500">{title}</h2>
      <Card className="divide-y divide-zinc-100 p-0">
        {rows.map(({ booking, view }) => (
          <div key={booking.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{formatSlot(booking)}</p>
              <p className="text-sm text-zinc-600">
                {view ? `${view.company.name} · ${view.contact.name}` : "Unknown thread"} · 30 min
              </p>
            </div>
            {booking.provider === "calcom" ? <Badge tone="green">In Cal.com</Badge> : <Badge tone="amber">Simulated calendar</Badge>}
            {view && (
              <Link href={`/inbox/${view.thread.id}`} className="text-sm text-blue-700 hover:underline">
                Conversation →
              </Link>
            )}
          </div>
        ))}
      </Card>
    </section>
  );
}

async function load() {
  const { repo } = container();
  const [bookings, threads] = await Promise.all([repo.listBookings(), repo.listThreads()]);
  return bookings.map((booking) => ({ booking, view: threads.find((t) => t.thread.id === booking.threadId) ?? null }));
}
