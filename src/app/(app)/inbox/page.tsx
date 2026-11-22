import Link from "next/link";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { SetupBanner } from "@/components/setup-banner";
import { threadState, ThreadStatusBadge } from "@/components/thread-status";
import { Card, EmptyState } from "@/components/ui";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";

export default async function InboxPage() {
  await connection();
  const threads = hasDb() ? await container().repo.listThreads() : [];
  const sorted = [...threads].sort((a, b) => {
    const na = threadState(a).needsYou ? 1 : 0;
    const nb = threadState(b).needsYou ? 1 : 0;
    if (na !== nb) return nb - na;
    return +(b.messages.at(-1)?.createdAt ?? b.thread.createdAt) - +(a.messages.at(-1)?.createdAt ?? a.thread.createdAt);
  });

  return (
    <>
      <PageHeader title="Inbox" description="Every conversation. Threads that need you are at the top. Open one to read it, take over, or simulate a prospect reply." />
      <SetupBanner />
      {sorted.length === 0 ? (
        <EmptyState title="No conversations yet">Conversations start when you write an email for a company and approve it.</EmptyState>
      ) : (
        <Card className="divide-y divide-zinc-100 p-0">
          {sorted.map((v) => {
            const last = v.messages.at(-1);
            return (
              <Link key={v.thread.id} href={`/inbox/${v.thread.id}`} className="flex items-center gap-3 p-4 hover:bg-zinc-50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{v.company.name}</span>
                    <span className="truncate text-sm text-zinc-500">{v.contact.name}</span>
                  </div>
                  <p className="truncate text-sm text-zinc-600">
                    {last ? `${last.direction === "inbound" ? "They wrote" : "We wrote"}: ${last.body.replace(/\s+/g, " ").slice(0, 120)}` : "No messages"}
                  </p>
                </div>
                <span className="hidden text-xs text-zinc-400 sm:block">{last ? new Date(last.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                <ThreadStatusBadge view={v} />
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
