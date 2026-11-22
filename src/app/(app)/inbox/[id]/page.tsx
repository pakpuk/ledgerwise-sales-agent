import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";
import { takeOver } from "@/app/actions/inbox";
import { routeLabel, ThreadStatusBadge } from "@/components/thread-status";
import { Badge, Button, Card } from "@/components/ui";
import { hasDb } from "@/infrastructure/db/client";
import { container } from "@/infrastructure/container";
import { cn } from "@/lib/utils";
import { HumanReplyForm, SimulateReplyForm } from "./forms";

export default async function ThreadPage({ params }: PageProps<"/inbox/[id]">) {
  await connection();
  const { id } = await params;
  if (!hasDb() || !z.string().uuid().safeParse(id).success) notFound();
  const view = await container().repo.getThread(id);
  if (!view) notFound();
  const { thread, company, contact, messages } = view;
  const final = thread.status === "stopped" || thread.status === "booked";

  return (
    <>
      <Link href="/inbox" className="text-sm text-zinc-500 hover:underline">
        ← Inbox
      </Link>
      <div className="mb-4 mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{company.name}</h1>
        <span className="text-sm text-zinc-500">
          {contact.name} · {contact.email}
        </span>
        <Badge tone="blue">sandbox inbox</Badge>
        <ThreadStatusBadge view={view} />
        {!final && (
          <form action={takeOver} className="ml-auto">
            <input type="hidden" name="threadId" value={thread.id} />
            <input type="hidden" name="to" value={thread.status === "human" ? "agent" : "human"} />
            <Button size="sm" variant={thread.status === "human" ? "outline" : "default"}>
              {thread.status === "human" ? "Hand back to agent" : "Take over"}
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {messages.map((m) => {
          const inbound = m.direction === "inbound";
          return (
            <div key={m.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
              <Card className={cn("max-w-[85%] whitespace-pre-wrap text-sm", inbound ? "bg-white" : "bg-zinc-900 text-zinc-50", m.status === "cancelled" || m.status === "rejected" ? "opacity-50" : "")}>
                <div className={cn("mb-1 flex flex-wrap items-center gap-2 text-xs", inbound ? "text-zinc-500" : "text-zinc-400")}>
                  <span>{inbound ? contact.name : m.meta.byHuman ? "You" : "Agent"}</span>
                  <span>{new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                  {!inbound && m.status !== "sent" && <Badge tone={m.status === "draft" ? "amber" : "default"}>{m.status === "draft" ? "not sent: in review" : m.status}</Badge>}
                </div>
                {m.subject && !inbound && <p className="mb-1 font-medium">{m.subject}</p>}
                {m.body}
                {inbound && (m.meta.route || m.meta.reason) && (
                  <p className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-500">
                    {routeLabel(m.meta.route)}
                    {m.meta.reason && <span className="text-amber-700"> · {m.meta.reason}</span>}
                    {typeof m.meta.confidence === "number" && <span> · confidence {Math.round(m.meta.confidence * 100)}%</span>}
                  </p>
                )}
                {!inbound && m.meta.slots?.some((s) => s.simulated) && <p className="mt-2 text-xs text-zinc-400">Times come from the simulated calendar.</p>}
              </Card>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-2 font-medium">Simulate a prospect reply</p>
          <p className="mb-2 text-xs text-zinc-500">No real emails are sent. Type what the prospect would answer and watch how the agent handles it.</p>
          <SimulateReplyForm threadId={thread.id} disabled={thread.status === "stopped"} />
        </Card>
        {thread.status === "human" && (
          <Card>
            <p className="mb-2 font-medium">Your reply</p>
            <HumanReplyForm threadId={thread.id} />
          </Card>
        )}
      </div>
    </>
  );
}
