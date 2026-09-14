"use client";

import { formatClock } from "@/lib/time";

export function LiveClock({ now }: { now: Date }) {
  return (
    <time
      dateTime={now.toISOString()}
      className="font-mono text-xs tracking-wide text-muted-foreground tabular-nums"
    >
      {formatClock(now)}
    </time>
  );
}
