// Reply agent. Order matters:
// 1) stop / suppression check in code (no LLM)  2) classify with the fast model
// 3) route in code  4) every outgoing text goes through send-message (guards again).

import type { Message, MessageMeta, ReplyIntent, Slot } from "@/domain/entities";
import { detectStop } from "@/domain/rules/stop-detector";
import { BOT_ANSWER, isBotQuestion } from "@/domain/rules/bot-question";
import { isPricingQuestion, PRICING_ANSWER } from "@/domain/rules/price-guard";
import { shouldEscalate } from "@/domain/rules/escalation";
import { DEFAULT_TZ, formatSlot, matchSlot, slotsText } from "@/domain/rules/slots";
import { LlmOutputError, type CalendarPort, type LlmPort, type MailPort, type SalesRepository, type ThreadView } from "@/application/ports";
import { AnswerSchema, ANSWER_VERSION, answerPrompt, answerSystem, ClassifySchema, CLASSIFY_VERSION, classifyPrompt, classifySystem, type ClassifyOutput } from "@/application/prompts/reply";
import { sendMessage } from "./send-message";
import { bookCall } from "./book-call";

export type Deps = { repo: SalesRepository; llm: LlmPort; mail: MailPort; calendar: CalendarPort };

export type Route = "stop" | "ignored" | "human" | "out_of_office" | "pricing" | "bot_question" | "offer_slots" | "booked" | "answer" | "not_now";

export interface ReplyOutcome {
  route: Route;
  intent: ReplyIntent | null;
  reason?: string;
  replyId?: string;
  sent?: boolean;
  bookingId?: string;
}

const NOT_NOW_TEXT = "Understood, thanks for letting me know. I'll leave it here. If clean monthly books become a priority, just reply to this email.";
const SLOTS_OUTRO = "If none of these work, reply with a time that suits you and I'll find one.";

export async function handleReply(deps: Deps, threadId: string, text: string): Promise<ReplyOutcome> {
  const { repo } = deps;
  const view = await repo.getThread(threadId);
  if (!view) throw new Error("Thread not found");
  const inbound = await repo.saveMessage({ threadId, direction: "inbound", status: "received", body: text });
  const note = (meta: MessageMeta) => repo.updateMessage(inbound.id, { meta: { ...inbound.meta, ...meta } });

  // 1. Stop first, in code. Stop means stop.
  const stop = detectStop(text);
  const suppressed = await repo.findSuppression(view.contact.email, view.company.domain);
  if (stop.stop || suppressed) {
    await repo.addSuppression(view.contact.email, "email", `Replied: ${stop.matched ?? "suppressed"}`);
    await repo.addSuppression(view.company.domain, "domain", `Contact at company replied: ${stop.matched ?? "suppressed"}`);
    const cancelled = await repo.cancelPendingMessages(view.company.id);
    await repo.setThreadStatus(threadId, "stopped");
    await note({ route: "stop", intent: "stop", reason: `Opt-out ("${stop.matched ?? suppressed?.value}"). ${cancelled} pending message(s) cancelled.` });
    return { route: "stop", intent: "stop" };
  }
  if (view.thread.status === "stopped") return { route: "ignored", intent: null, reason: "Thread is stopped" };
  if (view.thread.status === "human") {
    await note({ route: "human", needsHuman: true, reason: "A teammate owns this thread" });
    return { route: "human", intent: null, reason: "A teammate owns this thread" };
  }

  // 2. Classify (fast model). Without an LLM, only the safe fixed answers are automatic.
  const lastOut = [...view.messages].reverse().find((m) => m.direction === "outbound" && m.status === "sent");
  const cls = await classify(deps.llm, text, lastOut?.body ?? null, threadId);
  if (isBotQuestion(text)) cls.intent = "bot_question"; // honesty is not left to the model

  // 3. Route.
  if (cls.intent === "out_of_office") {
    await note({ route: "out_of_office", intent: cls.intent, confidence: cls.confidence, reason: "Auto-reply, nothing to answer" });
    return { route: "out_of_office", intent: cls.intent };
  }

  const agentReplies = view.messages.filter((m) => m.direction === "outbound" && m.meta.route).length;
  const kbId = cls.kb_entry_id;
  const esc = shouldEscalate({
    intent: cls.intent,
    confidence: cls.confidence,
    threadStatus: view.thread.status,
    text,
    language: cls.language,
    agentRepliesInThread: agentReplies,
    answerableFromKb: cls.intent === "question" || cls.intent === "objection" ? Boolean(kbId) : undefined,
  });
  if (esc.escalate) return escalate(deps, view, inbound, cls, esc.reason ?? "Unsure");

  const base: MessageMeta = { intent: cls.intent, confidence: cls.confidence };

  switch (cls.intent) {
    case "bot_question":
      return reply(deps, view, inbound, BOT_ANSWER, { ...base, route: "bot_question" });
    case "pricing": {
      const slots = await offerSlots(deps, view);
      return reply(deps, view, inbound, `${PRICING_ANSWER}\n${slotsText(slots)}\n\n${SLOTS_OUTRO}`, { ...base, route: "pricing", slots: serialize(slots) });
    }
    case "wants_call": {
      const offered = lastOfferedSlots(view);
      const picked = offered.length ? matchSlot(offered, `${text} ${cls.preferred_time ?? ""}`) : null;
      if (picked) {
        try {
          const { booking } = await bookCall(deps, threadId, picked);
          const r = await reply(deps, view, inbound, `Great, you're booked for ${formatSlot(picked)}. A calendar invite will follow. Talk soon.`, { ...base, route: "booked", bookingId: booking.id });
          return { ...r, bookingId: booking.id };
        } catch (e) {
          base.reason = `Could not book: ${(e as Error).message}`;
        }
      }
      const slots = await offerSlots(deps, view);
      const lead = picked ? "Sorry, that time was just taken. Here are the next free times:" : "Great. Here are a few times that work:";
      return reply(deps, view, inbound, `${lead}\n${slotsText(slots)}\n\n${SLOTS_OUTRO}`, { ...base, route: "offer_slots", slots: serialize(slots) });
    }
    case "question":
    case "objection":
      return answerFromKb(deps, view, inbound, text, cls, base);
    case "not_now":
      return reply(deps, view, inbound, NOT_NOW_TEXT, { ...base, route: "not_now" });
    default:
      return escalate(deps, view, inbound, cls, "No safe automatic answer");
  }
}

async function classify(llm: LlmPort, text: string, lastOut: string | null, threadId: string): Promise<ClassifyOutput> {
  // Without a (valid) LLM answer, only the fixed, safe answers are automatic; everything else -> human.
  const fallback = (): ClassifyOutput => ({
    intent: isBotQuestion(text) ? "bot_question" : isPricingQuestion(text) ? "pricing" : "unsure",
    confidence: isBotQuestion(text) || isPricingQuestion(text) ? 0.9 : 0,
    language: "en",
    kb_entry_id: null,
    preferred_time: null,
  });
  if (!llm.available) return fallback();
  try {
    return await llm.json({ kind: "classify_reply", promptVersion: CLASSIFY_VERSION, tier: "fast", system: classifySystem, prompt: classifyPrompt(text, lastOut), schema: ClassifySchema, subjectId: threadId });
  } catch (e) {
    if (e instanceof LlmOutputError) return { ...fallback(), intent: "unsure", confidence: 0 };
    throw e;
  }
}

async function answerFromKb(deps: Deps, view: ThreadView, inbound: Message, text: string, cls: ClassifyOutput, base: MessageMeta) {
  const kbIds = [cls.kb_entry_id!, "how-call-works"];
  try {
    const out = await deps.llm.json({ kind: "answer_reply", promptVersion: ANSWER_VERSION, tier: "smart", system: answerSystem, prompt: answerPrompt(text, kbIds), schema: AnswerSchema, subjectId: view.thread.id });
    if (!out.answerable || !out.body.trim()) return escalate(deps, view, inbound, cls, "Question is outside the knowledge base");
    const slots = await offerSlots(deps, view);
    return reply(deps, view, inbound, `${out.body.trim()}\n\n${slotsText(slots)}`, { ...base, route: "answer", kbIds: out.kb_ids_used, slots: serialize(slots) });
  } catch (e) {
    if (e instanceof LlmOutputError) return escalate(deps, view, inbound, cls, "Answer failed validation twice");
    throw e;
  }
}

async function offerSlots(deps: Deps, view: ThreadView): Promise<Slot[]> {
  const tz = view.contact.timezone ?? DEFAULT_TZ;
  const all = await deps.calendar.availableSlots({ from: new Date(), days: 7, timezone: tz });
  return all.slice(0, 3);
}

function lastOfferedSlots(view: ThreadView): Slot[] {
  const m = [...view.messages].reverse().find((x) => x.direction === "outbound" && x.meta.slots?.length);
  return (m?.meta.slots ?? []).map((s) => ({ start: new Date(s.start), end: new Date(s.end), timezone: s.timezone, simulated: s.simulated }));
}

const serialize = (slots: Slot[]) => slots.map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), timezone: s.timezone, simulated: s.simulated }));

async function escalate(deps: Deps, view: ThreadView, inbound: Message, cls: ClassifyOutput, reason: string): Promise<ReplyOutcome> {
  await deps.repo.setThreadStatus(view.thread.id, "human");
  await deps.repo.updateMessage(inbound.id, { meta: { ...inbound.meta, route: "human", needsHuman: true, reason, intent: cls.intent, confidence: cls.confidence } });
  return { route: "human", intent: cls.intent, reason };
}

async function reply(deps: Deps, view: ThreadView, inbound: Message, body: string, meta: MessageMeta): Promise<ReplyOutcome> {
  const firstSubject = view.messages.find((m) => m.subject)?.subject ?? view.company.name;
  const msg = await deps.repo.saveMessage({ threadId: view.thread.id, direction: "outbound", status: "approved", subject: `Re: ${firstSubject.replace(/^Re:\s*/i, "")}`, body, meta });
  await deps.repo.updateMessage(inbound.id, { meta: { ...inbound.meta, route: meta.route, intent: meta.intent, confidence: meta.confidence } });
  const sent = await sendMessage(deps, msg.id);
  if (!sent.ok) {
    await deps.repo.updateMessage(msg.id, { status: "draft" });
    await deps.repo.setThreadStatus(view.thread.id, "human");
    return { route: "human", intent: (meta.intent as ReplyIntent) ?? null, reason: `Reply blocked: ${sent.blocked.join("; ")}`, replyId: msg.id, sent: false };
  }
  return { route: meta.route as Route, intent: (meta.intent as ReplyIntent) ?? null, replyId: msg.id, sent: true };
}
