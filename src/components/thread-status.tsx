import type { ThreadView } from "@/application/ports";
import { Badge } from "@/components/ui";

type Tone = "default" | "green" | "red" | "amber" | "blue";

/** Plain-language state of a conversation, for non-technical users. */
export function threadState(v: ThreadView): { label: string; tone: Tone; needsYou: boolean } {
  const last = v.messages.at(-1);
  if (v.thread.status === "stopped") return { label: "Opted out", tone: "red", needsYou: false };
  if (v.thread.status === "booked") return { label: "Call booked", tone: "green", needsYou: false };
  if (v.thread.status === "human") return { label: "Needs you", tone: "amber", needsYou: last?.direction === "inbound" || Boolean(last?.meta.needsHuman) };
  if (v.messages.some((m) => m.status === "draft")) return { label: "Draft in review", tone: "blue", needsYou: true };
  if (last?.direction === "outbound" && last.status === "sent") return { label: "Waiting for reply", tone: "default", needsYou: false };
  return { label: "Agent handling", tone: "default", needsYou: false };
}

export function ThreadStatusBadge({ view }: { view: ThreadView }) {
  const s = threadState(view);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const ROUTE_LABEL: Record<string, string> = {
  stop: "Opt-out: added to do-not-contact list",
  human: "Handed to a human",
  out_of_office: "Out-of-office: no reply needed",
  pricing: "Pricing question: fixed answer + times",
  bot_question: "Asked if AI: honest answer",
  offer_slots: "Wants a call: offered times",
  booked: "Booked a call",
  answer: "Answered from the knowledge base",
  not_now: "Not now: closed politely",
};

export const routeLabel = (r: string | undefined) => (r ? (ROUTE_LABEL[r] ?? r) : undefined);
