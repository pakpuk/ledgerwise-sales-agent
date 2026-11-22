// Rule 5: anything the agent is not sure about goes to a human.

import type { ReplyIntent, ThreadStatus } from "@/domain/entities";

export interface EscalationInput {
  intent: ReplyIntent;
  confidence: number; // 0..1
  threadStatus: ThreadStatus;
  text: string;
  language: string; // ISO code from the classifier, e.g. "en"
  agentRepliesInThread: number;
  /** For "question" intent: did the classifier find the answer in the knowledge base? */
  answerableFromKb?: boolean;
  validatorFailures?: number;
}

export interface EscalationResult {
  escalate: boolean;
  reason: string | null;
}

export const MIN_CONFIDENCE = 0.7;
export const MAX_AGENT_REPLIES = 4;

const LEGAL = /\b(lawyer|attorney|legal action|lawsuit|sue|gdpr|ccpa|complain(?:t)?|report you|ftc|can-?spam|cease and desist)\b/i;
const HOSTILE = /\b(scam|spam(?:mer)?|f+u+c*k|shit|idiot|stupid|harass(?:ing|ment)?|go away|piss off)\b/i;

export function shouldEscalate(i: EscalationInput): EscalationResult {
  if (i.threadStatus === "human") return { escalate: true, reason: "A teammate took over this thread" };
  if (i.intent === "unsure") return { escalate: true, reason: "The agent wasn't sure what they meant" };
  if (i.intent === "hostile" || HOSTILE.test(i.text)) return { escalate: true, reason: "Hostile tone" };
  if (i.intent === "legal" || LEGAL.test(i.text)) return { escalate: true, reason: "Legal or complaint wording" };
  if (i.language.toLowerCase() !== "en") return { escalate: true, reason: `Reply is not in English (${i.language})` };
  if (i.confidence < MIN_CONFIDENCE) return { escalate: true, reason: `Low confidence (${i.confidence.toFixed(2)})` };
  if (i.intent === "question" && i.answerableFromKb === false)
    return { escalate: true, reason: "Question is outside the knowledge base" };
  if ((i.validatorFailures ?? 0) >= 2) return { escalate: true, reason: "Draft failed the rules twice" };
  if (i.agentRepliesInThread >= MAX_AGENT_REPLIES) return { escalate: true, reason: "Agent reply limit reached" };
  return { escalate: false, reason: null };
}
