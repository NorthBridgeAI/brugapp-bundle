"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CircleDot, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Status", icon: CircleDot },
  { href: "/schedule", label: "Schema", icon: CalendarClock },
  { href: "/about", label: "Info", icon: Info },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/95 backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-3 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium tracking-wide",
                  active ? "text-canal" : "text-slate-400 hover:text-slate-200",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Hoofdnavigatie" className="hidden items-center gap-1 md:flex">
      {items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-canal/15 text-canal"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
