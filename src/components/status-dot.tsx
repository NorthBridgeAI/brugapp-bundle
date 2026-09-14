import { cn } from "@/lib/utils";
import type { RoadStatus } from "@/lib/types";

const tones: Record<RoadStatus, string> = {
  clear: "bg-status-clear",
  soon: "bg-status-soon",
  wait: "bg-status-wait",
  unknown: "bg-muted-foreground",
};

export function StatusDot({
  status,
  className,
  pulse = false,
}: {
  status: RoadStatus;
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span className={cn("relative inline-flex size-2.5", className)} aria-hidden>
      {pulse ? (
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-70 motion-safe:animate-ping",
            tones[status],
          )}
        />
      ) : null}
      <span className={cn("relative size-2.5 rounded-full", tones[status])} />
    </span>
  );
}
