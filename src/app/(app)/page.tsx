import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SetupBanner } from "@/components/setup-banner";
import { threadState, ThreadStatusBadge } from "@/components/thread-status";
import { Card, EmptyState } from "@/components/ui";
import { formatSlot } from "@/domain/rules/slots";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";

export default async function HomePage() {
  await connection();
  const data = hasDb() ? await load() : null;

  return (
    <>
      <PageHeader title="Needs your attention" description="What the agent couldn't or shouldn't do alone." />
      <SetupBanner />
      {!data ? (
        <EmptyState title="Database not connected">Set DATABASE_URL to see your pipeline.</EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Emails to review" value={data.drafts} href="/review" />
            <Stat label="Conversations need you" value={data.needsYou.length} href="/inbox" />
            <Stat label="Upcoming calls" value={data.upcoming.length} href="/calls" />
            <Stat label="Good-fit companies" value={data.qualified} href="/companies" />
          </div>

          <section>
            <h2 className="mb-2 text-sm font-medium text-zinc-500">Conversations waiting for you</h2>
            {data.needsYou.length === 0 ? (
              <Card className="text-sm text-zinc-500">Nothing waiting. The agent is handling everything else.</Card>
            ) : (
              <Card className="divide-y divide-zinc-100 p-0">
                {data.needsYou.map((v) => {
                  const reason = [...v.messages].reverse().find((m) => m.meta.reason)?.meta.reason;
                  return (
                    <Link key={v.thread.id} href={`/inbox/${v.thread.id}`} className="flex items-center gap-3 p-4 hover:bg-zinc-50">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{v.company.name}</p>
                        <p className="truncate text-sm text-amber-800">{reason ?? "Open to see why"}</p>
                      </div>
                      <ThreadStatusBadge view={v} />
                    </Link>
                  );
                })}
              </Card>
            )}
          </section>

          {data.upcoming.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-zinc-500">Next calls</h2>
              <Card className="divide-y divide-zinc-100 p-0">
                {data.upcoming.slice(0, 5).map((b) => (
                  <div key={b.id} className="p-4 text-sm">
                    <span className="font-medium">{formatSlot(b)}</span>
                    <span className="text-zinc-500"> · {b.company}</span>
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href}>
      <Card className="hover:border-zinc-400">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
        <p className="text-sm text-zinc-500">{label}</p>
      </Card>
    </Link>
  );
}

async function load() {
  const { repo } = container();
  const [threads, bookings, companies] = await Promise.all([repo.listThreads(), repo.listBookings(), repo.listCompanies()]);
  const drafts = threads.reduce((n, v) => n + v.messages.filter((m) => m.status === "draft" && m.direction === "outbound").length, 0);
  const needsYou = threads.filter((v) => v.thread.status === "human" && threadState(v).needsYou);
  const now = Date.now();
  const upcoming = bookings
    .filter((b) => +b.start >= now)
    .map((b) => ({ ...b, company: threads.find((t) => t.thread.id === b.threadId)?.company.name ?? "" }));
  return { drafts, needsYou, upcoming, qualified: companies.filter((c) => c.status === "qualified").length };
}
