// A teammate takes over a thread (the agent stops replying) or hands it back.
// Human replies still go through send-message, so the business rules apply to people too.

import type { MailPort, SalesRepository } from "@/application/ports";
import { sendMessage, type SendResult } from "./send-message";

export async function setOwner(deps: { repo: SalesRepository }, threadId: string, owner: "human" | "agent") {
  const view = await deps.repo.getThread(threadId);
  if (!view) throw new Error("Thread not found");
  if (view.thread.status === "stopped" || view.thread.status === "booked") return; // final states
  await deps.repo.setThreadStatus(threadId, owner === "human" ? "human" : "active");
}

export async function humanReply(deps: { repo: SalesRepository; mail: MailPort }, threadId: string, body: string): Promise<SendResult> {
  const view = await deps.repo.getThread(threadId);
  if (!view) throw new Error("Thread not found");
  const subject = view.messages.find((m) => m.subject)?.subject ?? view.company.name;
  const msg = await deps.repo.saveMessage({
    threadId,
    direction: "outbound",
    status: "approved",
    subject: `Re: ${subject.replace(/^Re:\s*/i, "")}`,
    body,
    meta: { byHuman: true },
  });
  const r = await sendMessage(deps, msg.id);
  if (!r.ok) await deps.repo.updateMessage(msg.id, { status: "rejected" });
  return r;
}
