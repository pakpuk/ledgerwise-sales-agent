// THE ONLY way anything is sent. Re-checks every rule at send time, whatever happened before.

import { detectStop } from "@/domain/rules/stop-detector";
import { checkOutbound } from "@/domain/rules/email-rules";
import type { MailPort, SalesRepository } from "@/application/ports";

export type SendResult = { ok: true; mailId: string } | { ok: false; blocked: string[] };

export async function sendMessage(deps: { repo: SalesRepository; mail: MailPort }, messageId: string): Promise<SendResult> {
  const { repo, mail } = deps;
  const msg = await repo.getMessage(messageId);
  if (!msg) return { ok: false, blocked: ["Message not found"] };
  const view = await repo.getThread(msg.threadId);
  if (!view) return { ok: false, blocked: ["Thread not found"] };
  const { thread, contact, company } = view;

  const blocked: string[] = [];
  if (msg.direction !== "outbound") blocked.push("Not an outbound message");
  if (msg.status !== "approved") blocked.push(`Message is "${msg.status}", not approved`);
  if (thread.status === "stopped") blocked.push("Prospect asked to stop");
  const suppressed = await repo.findSuppression(contact.email, company.domain);
  if (suppressed) blocked.push(`On the do-not-contact list (${suppressed.kind}: ${suppressed.value})`);
  // Stop wins even if a stop reply arrived and wasn't processed yet.
  if (view.messages.some((m) => m.direction === "inbound" && detectStop(m.body).stop)) blocked.push("Prospect said stop in this thread");

  const facts = await repo.listFacts(company.id);
  const rules = checkOutbound(`${msg.subject ?? ""}\n${msg.body}`, msg.claims, facts);
  blocked.push(...rules.violations);

  if (blocked.length > 0) {
    await repo.updateMessage(msg.id, { meta: { ...msg.meta, needsHuman: true, reason: "Blocked at send time", violations: blocked } });
    return { ok: false, blocked };
  }

  const { id } = await mail.send({ to: contact.email, subject: msg.subject ?? `Re: ${company.name}`, body: msg.body });
  await repo.updateMessage(msg.id, { status: "sent", sentAt: new Date(), meta: { ...msg.meta, mailId: id, needsHuman: false } });
  return { ok: true, mailId: id };
}
