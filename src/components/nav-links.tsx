"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/companies", label: "Companies" },
  { href: "/review", label: "Review" },
  { href: "/inbox", label: "Inbox" },
  { href: "/calls", label: "Calls" },
] as const;

/** Top navigation with the current page highlighted. */
export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {NAV.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
              active ? "bg-zinc-900 font-medium text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {n.label}
          </Link>
        );
      })}
    </>
  );
}
