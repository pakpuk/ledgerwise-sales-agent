"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { container } from "@/infrastructure/container";
import { approveDraft, editDraft, rejectDraft } from "@/application/use-cases/review-draft";
import { draftEmail } from "@/application/use-cases/draft-email";
import { requireSession } from "./auth";
import { friendlyError } from "./companies";
import { redirect } from "next/navigation";

export type ActionState = { ok?: string; error?: string };

const Id = z.string().uuid();

function refresh() {
  revalidatePath("/review");
  revalidatePath("/inbox");
  revalidatePath("/");
}

export async function writeEmail(form: FormData) {
  await requireSession();
  let notice: string | null = null;
  try {
    // AI failures inside draftEmail already produce a "Needs you" draft; this catches everything else.
    await draftEmail(container(), Id.parse(form.get("companyId")));
  } catch (e) {
    notice = await friendlyError(e);
  }
  refresh();
  revalidatePath("/companies");
  redirect(notice ? `/companies?notice=${encodeURIComponent(notice)}` : "/review");
}

export async function reviewAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireSession();
  const id = Id.parse(form.get("messageId"));
  const intent = String(form.get("intent"));
  const deps = container();
  try {
    if (intent === "reject") {
      await rejectDraft(deps, id);
      refresh();
      return { ok: "Rejected." };
    }
    const subject = z.string().min(1).max(120).parse(form.get("subject"));
    const body = z.string().min(1).max(4000).parse(form.get("body"));
    await editDraft(deps, id, subject, body);
    if (intent === "save") {
      refresh();
      return { ok: "Saved." };
    }
    const r = await approveDraft(deps, id);
    refresh();
    return r.ok ? { ok: "Sent (sandbox)." } : { error: `Not sent: ${r.blocked.join("; ")}` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
