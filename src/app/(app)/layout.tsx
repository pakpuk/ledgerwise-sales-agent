import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { Button } from "@/components/ui";
import { NavLinks } from "@/components/nav-links";

// Internal tool: pages read live DB data, so allow blocking navigations.
export const instant = false;

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2.5">
          <Link href="/" className="mr-2 flex items-center gap-2 sm:mr-5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-sm font-bold text-white">L</span>
            <span className="hidden font-semibold tracking-tight sm:inline">Ledgerwise</span>
          </Link>
          <NavLinks />
          <form action={logout} className="ml-auto">
            <Button variant="ghost" size="sm">
              Log out
            </Button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
