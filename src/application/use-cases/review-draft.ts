// Human review actions on a draft: approve (-> send), edit, reject.

import { claimsInBody } from "@/domain/rules/claim-guard";
import { withOptOut } from "@/domain/rules/email-rules";
import type { MailPort, SalesRepository } from "@/application/ports";
import { sendMessage, type SendResult } from "./send-message";

type Deps = { repo: SalesRepository; mail: MailPort };

async function loadDraft(repo: SalesRepository, id: string) {
  const msg = await repo.getMessage(id);
  if (!msg || msg.status !== "draft") throw new Error("Draft not found or already handled");
  return msg;
}

export async function editDraft(deps: Deps, id: string, subject: string, body: string) {
  const msg = await loadDraft(deps.repo, id);
  const newBody = withOptOut(body);
  // Keep only claims still in the text, so the fact links stay truthful.
  const claims = msg.claims.filter((c) => claimsInBody(newBody, [c]).ok);
  await deps.repo.updateMessage(id, { subject, body: newBody, claims, meta: { ...msg.meta, editedByHuman: true } });
}

export async function approveDraft(deps: Deps, id: string): Promise<SendResult> {
  await loadDraft(deps.repo, id);
  await deps.repo.updateMessage(id, { status: "approved" });
  const result = await sendMessage(deps, id);
  if (!result.ok) await deps.repo.updateMessage(id, { status: "draft" }); // back to the queue with reasons
  return result;
}

export async function rejectDraft(deps: Deps, id: string) {
  const msg = await loadDraft(deps.repo, id);
  await deps.repo.updateMessage(id, { status: "rejected", meta: { ...msg.meta, needsHuman: false } });
}
