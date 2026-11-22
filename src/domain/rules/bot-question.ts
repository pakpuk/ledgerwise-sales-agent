// Detects "are you a bot / AI / real person?" so we can answer honestly
// with a fixed text instead of letting the LLM improvise.

const BOT_PATTERNS: RegExp[] = [
  /\bare you (?:a |an )?(?:bot|robot|ai|a\.i\.|machine|human|real person|real)\b/i,
  /\b(?:is this|is that) (?:a |an )?(?:bot|robot|ai|automated|real person|human)\b/i,
  /\b(?:written|sent|generated) by (?:a |an )?(?:bot|ai|machine|chatgpt|gpt)\b/i,
  /\bam i (?:talking|speaking|chatting) (?:to|with) (?:a |an )?(?:bot|ai|human|real person|machine)\b/i,
  /\bautomated (?:email|message)\b/i,
];

export function isBotQuestion(text: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(text));
}

export const BOT_ANSWER =
  "Good question — yes, this message was drafted by an AI assistant working for the Ledgerwise team, and a person reviews outreach before it goes out. If you'd rather talk to a human directly, just say so and one of us will pick this up.";
