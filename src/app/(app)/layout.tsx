import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui";

// Internal tool: pages read live DB data, so allow blocking navigations.
export const instant = false;

const NAV = [
  { href: "/companies", label: "Companies" },
  { href: "/review", label: "Review" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calls", label: "Calls" },
] as const;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-2">
          <span className="mr-4 font-semibold">Ledgerwise</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-1.5 text-sm hover:bg-zinc-100">
              {n.label}
            </Link>
          ))}
          <form action={logout} className="ml-auto">
            <Button variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</main>
    </div>
  );
}
