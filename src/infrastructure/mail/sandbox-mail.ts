import { randomUUID } from "node:crypto";
import type { MailPort } from "@/application/ports";

/** Never sends real email. The sent message is already stored in `messages`; this only assigns an id and logs. */
export class SandboxMail implements MailPort {
  async send(msg: { to: string; subject: string; body: string }) {
    const id = `sandbox-${randomUUID()}`;
    console.info(`[sandbox-mail] ${id} -> ${msg.to}: ${msg.subject}`);
    return { id };
  }
}
