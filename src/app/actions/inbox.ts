"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { container } from "@/infrastructure/container";
import { handleReply } from "@/application/use-cases/handle-reply";
import { humanReply, setOwner } from "@/application/use-cases/take-over";
import { requireSession } from "./auth";

export type InboxState = { ok?: string; error?: string };
const Id = z.string().uuid();

function refresh(threadId: string) {
  revalidatePath(`/inbox/${threadId}`);
  revalidatePath("/inbox");
  revalidatePath("/calls");
  revalidatePath("/");
}

export async function simulateReply(_p: InboxState, form: FormData): Promise<InboxState> {
  await requireSession();
  const threadId = Id.parse(form.get("threadId"));
  const text = z.string().trim().min(1).max(4000).parse(form.get("text"));
  try {
    const r = await handleReply(container(), threadId, text);
    refresh(threadId);
    return { ok: `Agent route: ${r.route}${r.reason ? ` (${r.reason})` : ""}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function takeOver(form: FormData) {
  await requireSession();
  const threadId = Id.parse(form.get("threadId"));
  await setOwner(container(), threadId, form.get("to") === "agent" ? "agent" : "human");
  refresh(threadId);
}

export async function sendHumanReply(_p: InboxState, form: FormData): Promise<InboxState> {
  await requireSession();
  const threadId = Id.parse(form.get("threadId"));
  const body = z.string().trim().min(1).max(4000).parse(form.get("body"));
  const r = await humanReply(container(), threadId, body);
  refresh(threadId);
  return r.ok ? { ok: "Sent (sandbox)." } : { error: `Not sent: ${r.blocked.join("; ")}` };
}
