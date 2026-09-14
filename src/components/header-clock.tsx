"use client";

import { useEffect, useState } from "react";
import { LiveClock } from "@/components/live-clock";

export function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const timeout = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(id);
    };
  }, []);

  if (!now) {
    return (
      <span className="hidden font-mono text-xs text-slate-400 sm:inline">
        Europe/Amsterdam
      </span>
    );
  }

  return <LiveClock now={now} />;
}
