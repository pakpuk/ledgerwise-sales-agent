"use client";

import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, {});
  const [show, setShow] = useState(false);
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-lg font-bold text-white shadow-lg">L</div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-zinc-500">Ledgerwise Sales Agent · team workspace</p>
      </div>
      <form action={action} className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-zinc-700">Team password</span>
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              name="password"
              placeholder="Enter the shared team password"
              autoFocus
              required
              autoComplete="current-password"
              className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 pr-16 text-sm outline-none transition focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-2 my-auto h-7 rounded-md px-2 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {state.error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}. Check with your admin for the current team password.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-lg bg-zinc-900 text-sm font-medium text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-6 text-center text-xs text-zinc-400">Research · Qualify · Write · Reply · Book. Every email is reviewed by a person before it goes out.</p>
    </div>
  );
}
