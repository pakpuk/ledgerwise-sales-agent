"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { container } from "@/infrastructure/container";
import { qualifyCompany } from "@/application/use-cases/qualify-company";
import { requireSession } from "./auth";

/** Turns any failure into a plain-language notice instead of an error page. */
export async function friendlyError(e: unknown): Promise<string> {
  const msg = (e as Error).message ?? String(e);
  if (/429|quota/i.test(msg)) return "The AI quota is used up for now. Nothing was changed; try again later or do this step by hand.";
  if (/not configured|No LLM key/i.test(msg)) return "The AI is not connected, so this step needs a person.";
  return `That didn't work (${msg.slice(0, 120)}). Nothing was sent.`;
}

export async function scoreCompany(form: FormData) {
  await requireSession();
  const id = z.string().uuid().parse(form.get("companyId"));
  let notice: string | null = null;
  try {
    await qualifyCompany(container(), id);
  } catch (e) {
    notice = await friendlyError(e);
  }
  revalidatePath("/companies");
  if (notice) redirect(`/companies?notice=${encodeURIComponent(notice)}`);
}
