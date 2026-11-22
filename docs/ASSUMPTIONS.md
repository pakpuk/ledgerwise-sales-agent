# Assumptions to confirm with the client (Ledgerwise)

Everything below was invented or assumed to build the MVP. Each item needs a yes/no from Ledgerwise before real use.

## Knowledge base (`src/application/knowledge-base.ts`) — to confirm with the client
The reply agent may only answer from these entries. All of them are placeholders:
- **What we do:** monthly bookkeeping for US e-commerce brands (categorise, reconcile, monthly close, P&L / balance sheet / cash view).
- **Who it's for:** Shopify / Amazon / own-site brands, ~$1M-$10M revenue, small team.
- **E-commerce specifics:** payout matching, fees/refunds, inventory & COGS, sales-tax visibility.
- **Tools:** QuickBooks Online or Xero; connects to Shopify, Amazon Seller Central, payment processors.
- **How the call works:** 20-30 min video call, no prep, honest fit check.
- **Onboarding:** read-only access, review of past months, clean-up if needed, then monthly close.
- **Objection answers:** "we already have a bookkeeper", "not a priority right now".
- **Pricing:** never quoted; "we cover pricing on a call".

## Fixed texts — to confirm
- Bot-question answer (`domain/rules/bot-question.ts`): says yes, an AI assistant drafts messages, a person reviews outreach, offers a human.
- Pricing answer (`domain/rules/price-guard.ts`): "we cover pricing on a short call" + slots.
- Opt-out line on every first email (`domain/rules/email-rules.ts`).

## Process assumptions
- No real emails are sent and no real contact addresses are collected: every prospect gets a labelled sandbox inbox; prospect replies are simulated from the Inbox.
- "Not interested" is treated as stop (suppress email + company domain, cancel drafts, never contact again).
- First emails always need human approval; replies that pass all rules are sent by the agent automatically; anything unsure goes to a human.
- Calls are 30 minutes, offered on weekdays in US Eastern time when Cal.com is not connected (simulated slots).
- Fit score weights (US e-commerce 35, trigger 25, revenue 15, team size 15, contact 10; "unknown" = 40% credit; qualified ≥ 60) are a first guess.
