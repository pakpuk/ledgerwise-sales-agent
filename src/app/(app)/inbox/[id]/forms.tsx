"use client";

import { useActionState, useRef } from "react";
import { sendHumanReply, simulateReply, type InboxState } from "@/app/actions/inbox";
import { Button, Textarea } from "@/components/ui";

const EXAMPLES = [
  "Sure, happy to chat. What times do you have?",
  "Tuesday afternoon works",
  "How much do you charge?",
  "Are you a bot?",
  "We already have a bookkeeper.",
  "Do you work with Xero?",
  "Maybe in a few months.",
  "Please stop emailing me.",
  "This is spam. I'll report you.",
  "Pouvez-vous m'envoyer plus d'infos ?",
  "I'm out of the office until Monday.",
];

export function SimulateReplyForm({ threadId, disabled }: { threadId: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState<InboxState, FormData>(simulateReply, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="threadId" value={threadId} />
      <div className="flex flex-wrap gap-1">
        {EXAMPLES.map((e) => (
          <button
            type="button"
            key={e}
            onClick={() => ref.current && (ref.current.value = e)}
            className="rounded-full border border-zinc-300 bg-white px-2 py-0.5 text-xs hover:bg-zinc-100"
          >
            {e.length > 28 ? `${e.slice(0, 28)}…` : e}
          </button>
        ))}
      </div>
      <Textarea ref={ref} name="text" rows={3} placeholder="Type what the prospect replies…" required disabled={disabled} />
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={pending || disabled}>
          {pending ? "Agent is thinking…" : "Simulate prospect reply"}
        </Button>
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

export function HumanReplyForm({ threadId }: { threadId: string }) {
  const [state, action, pending] = useActionState<InboxState, FormData>(sendHumanReply, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea name="body" rows={4} placeholder="Write your reply. The same rules apply (no prices, no opted-out contacts)." required />
      <div className="flex items-center gap-2">
        <Button disabled={pending}>{pending ? "Sending…" : "Send reply"}</Button>
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
