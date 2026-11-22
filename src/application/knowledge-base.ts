// The ONLY source the reply agent may answer questions from.
// Invented for the case study: every entry is listed in docs/ASSUMPTIONS.md as "to confirm with the client".
// Deliberately no prices, no guarantees, no customer names.

export interface KbEntry {
  id: string;
  topic: string;
  answer: string;
}

export const KNOWLEDGE_BASE: KbEntry[] = [
  {
    id: "what-we-do",
    topic: "What Ledgerwise does",
    answer:
      "Ledgerwise is a US bookkeeping firm. We do monthly bookkeeping for e-commerce brands: categorising transactions, reconciling bank, card and payout accounts, and closing the books each month so you get a P&L, balance sheet and cash view you can trust.",
  },
  {
    id: "who-for",
    topic: "Who it is for",
    answer:
      "We work with US e-commerce brands selling on Shopify, Amazon and their own site, usually somewhere between $1M and $10M in yearly revenue with a small team, where the founder or COO is still doing or overseeing the books.",
  },
  {
    id: "ecommerce-specifics",
    topic: "E-commerce specifics",
    answer:
      "We handle the e-commerce parts that generic bookkeepers often miss: matching Shopify and Amazon payouts to orders, fees and refunds, tracking inventory and cost of goods, and keeping sales tax liabilities visible.",
  },
  {
    id: "tools",
    topic: "Tools and integrations",
    answer:
      "We work inside QuickBooks Online or Xero and connect to Shopify, Amazon Seller Central and the usual payment processors. If you already use a tool, we usually keep it.",
  },
  {
    id: "how-call-works",
    topic: "How the intro call works",
    answer:
      "The first call is 20-30 minutes on video. We ask how your books are done today, which channels you sell on and what's painful, then tell you honestly whether we're a fit and what working together would look like. No preparation needed.",
  },
  {
    id: "onboarding",
    topic: "Getting started",
    answer:
      "If it's a fit, we start with a short onboarding: read-only access to your accounts, a review of past months, and a clean-up if needed. After that we close your books every month.",
  },
  {
    id: "already-have-bookkeeper",
    topic: "Objection: we already have a bookkeeper or accountant",
    answer:
      "That's common. Many brands we talk to have a CPA for taxes and someone part-time on the books. The call is a useful second opinion on whether your monthly numbers are e-commerce ready, with no pressure to switch.",
  },
  {
    id: "not-a-priority",
    topic: "Objection: timing / not a priority",
    answer:
      "Understood. Clean monthly books matter most right before fundraising, a new channel launch or a busy season, so if one of those is coming up, a short call now can save a scramble later. Happy to leave it if not.",
  },
  {
    id: "pricing",
    topic: "Pricing",
    answer: "Pricing depends on order volume, channels and the state of the books, so we cover it on a call.",
  },
];

export function kbById(id: string | null | undefined): KbEntry | undefined {
  return KNOWLEDGE_BASE.find((e) => e.id === id);
}
