"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Posts" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-950/70 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:h-12 sm:px-4">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:mr-4 sm:flex-none">
          FB Rental Finder
        </span>
        {LINKS.map((l) => {
          const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(l.href));
          return (
            <Link
              key={l.href}
              href={l.href}
              className={
                "shrink-0 rounded-full px-3 py-1.5 text-sm transition-colors " +
                (active
                  ? "bg-blue-600 text-white"
                  : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800")
              }
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
