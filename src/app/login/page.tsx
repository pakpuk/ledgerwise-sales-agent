import { Suspense } from "react";
import { LoginForm } from "./login-form";

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : "/companies"} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 p-6">
      <Suspense>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
