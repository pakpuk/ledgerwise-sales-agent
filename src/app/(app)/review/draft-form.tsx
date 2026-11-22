"use client";

import { useActionState } from "react";
import { reviewAction, type ActionState } from "@/app/actions/review";
import { Button, Input, Textarea } from "@/components/ui";

export function DraftForm({ messageId, subject, body }: { messageId: string; subject: string; body: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewAction, {});
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="messageId" value={messageId} />
      <label className="text-xs font-medium text-zinc-500">Subject</label>
      <Input name="subject" defaultValue={subject} required />
      <label className="text-xs font-medium text-zinc-500">Email</label>
      <Textarea name="body" defaultValue={body} rows={9} required />
      <div className="flex flex-wrap items-center gap-2">
        <Button name="intent" value="approve" disabled={pending}>
          Approve &amp; send
        </Button>
        <Button name="intent" value="save" variant="outline" disabled={pending}>
          Save edits
        </Button>
        <Button name="intent" value="reject" variant="ghost" className="text-red-700" disabled={pending} formNoValidate>
          Reject
        </Button>
        {pending && <span className="text-sm text-zinc-500">Working…</span>}
        {state.ok && <span className="text-sm text-green-700">{state.ok}</span>}
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}
