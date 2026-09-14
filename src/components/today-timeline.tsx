import { StatusDot } from "@/components/status-dot";
import { formatTime } from "@/lib/time";
import type { TimedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayTimeline({
  events,
  now,
  emptyLabel = "Geen spitsvrij vandaag. Openingen op afroep; live stand op Status.",
}: {
  events: TimedEvent[];
  now: Date;
  emptyLabel?: string;
}) {
  const starts = events.filter(
    (event) => event.kind === "opening_start" || event.kind === "rush_start",
  );

  if (starts.length === 0) {
    return (
      <p className="rounded-xl bg-white/4 px-4 py-6 text-sm text-slate-400">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className="relative space-y-0 border-l border-white/10 pl-5">
      {starts.map((event) => {
        const active =
          Boolean(event.end) && now >= event.at && now < event.end!;
        const past = event.end ? now >= event.end : now >= event.at;
        const isRush = event.kind === "rush_start";
        return (
          <li key={`${event.kind}-${event.at.toISOString()}`} className="relative pb-5">
            <span
              className={cn(
                "absolute top-1.5 -left-[1.45rem] size-3 rounded-full ring-4 ring-slate-950",
                active
                  ? isRush
                    ? "bg-canal"
                    : "bg-status-wait"
                  : past
                    ? "bg-slate-600"
                    : isRush
                      ? "bg-canal"
                      : "bg-status-soon",
              )}
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-mono text-sm tabular-nums text-slate-200">
                {formatTime(event.at)}
                {event.end ? `–${formatTime(event.end)}` : ""}
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                <StatusDot
                  status={isRush ? "clear" : active ? "wait" : "soon"}
                />
                {isRush ? "Spitsvrij" : active ? "Nu dicht" : past ? "Geweest" : "Opening"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              {event.detail ?? event.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
