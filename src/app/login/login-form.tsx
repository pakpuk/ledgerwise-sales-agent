"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, Card, Input } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  return (
    <Card className="w-full max-w-sm">
      <form action={action} className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Ledgerwise Sales Agent</h1>
        <p className="text-sm text-zinc-500">Enter the team password.</p>
        <input type="hidden" name="next" value={next} />
        <Input type="password" name="password" placeholder="Password" autoFocus required />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
