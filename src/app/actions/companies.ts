"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { container } from "@/infrastructure/container";
import { qualifyCompany } from "@/application/use-cases/qualify-company";
import { requireSession } from "./auth";

export async function scoreCompany(form: FormData) {
  await requireSession();
  const id = z.string().uuid().parse(form.get("companyId"));
  await qualifyCompany(container(), id);
  revalidatePath("/companies");
}
