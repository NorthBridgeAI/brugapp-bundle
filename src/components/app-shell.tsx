import Link from "next/link";
import { CanalMark } from "@/components/canal-mark";
import { BottomNav, DesktopNav } from "@/components/bottom-nav";
import { HeaderClock } from "@/components/header-clock";
import { SkipLink } from "@/components/skip-link";
import { SwRegister } from "@/components/sw-register";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      <SkipLink />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(120%_80%_at_50%_-10%,oklch(0.45_0.08_200/0.35),transparent_70%)]" />
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md focus-visible:ring-2 focus-visible:ring-canal"
          >
            <CanalMark className="size-8" />
            <span className="font-serif text-lg tracking-tight text-slate-50">
              Brugapp
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <HeaderClock />
            <DesktopNav />
          </div>
        </div>
      </header>
      <main
        id="inhoud"
        className="relative mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-5 md:pb-12"
      >
        {children}
      </main>
      <BottomNav />
      <SwRegister />
    </div>
  );
}
