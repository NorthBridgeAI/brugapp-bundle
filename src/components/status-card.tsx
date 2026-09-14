import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/status-dot";
import { nextEventLabel } from "@/lib/status";
import { formatTime } from "@/lib/time";
import type { BridgeView, RoadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tone: Record<
  RoadStatus,
  { bar: string; text: string; glow: string; label: string }
> = {
  clear: {
    bar: "bg-status-clear",
    text: "text-status-clear",
    glow: "shadow-[inset_0_0_80px_oklch(0.76_0.17_163/0.12)]",
    label: "Weg is open",
  },
  soon: {
    bar: "bg-status-soon",
    text: "text-status-soon",
    glow: "shadow-[inset_0_0_80px_oklch(0.83_0.19_84/0.12)]",
    label: "Opening verwacht",
  },
  wait: {
    bar: "bg-status-wait",
    text: "text-status-wait",
    glow: "shadow-[inset_0_0_80px_oklch(0.70_0.19_22/0.14)]",
    label: "Weg is dicht",
  },
  unknown: {
    bar: "bg-slate-500",
    text: "text-slate-300",
    glow: "",
    label: "Geen stand",
  },
};

export function StatusCard({
  view,
  now,
  linked = true,
}: {
  view: BridgeView;
  now: Date;
  linked?: boolean;
}) {
  const colors = tone[view.road];
  const body = (
      <div className="flex flex-col gap-5 px-5 py-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-slate-400 uppercase">
              {view.bridge.locality} · {view.bridge.country}
            </p>
            <h2 className="mt-1 font-serif text-2xl leading-tight text-slate-50">
              {view.bridge.shortName}
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
            <StatusDot
              status={view.road}
              pulse={view.road === "wait" || view.road === "soon"}
            />
            Stand
          </span>
        </div>

        <div aria-live="polite">
          <p
            className={cn(
              "font-serif text-5xl leading-none tracking-tight sm:text-6xl",
              colors.text,
            )}
          >
            {view.headline}
          </p>
          <p className="mt-2 max-w-prose text-sm leading-6 text-slate-300">
            {view.detail}
          </p>
          {view.source === "ndw" ? (
            <p className="mt-2 text-xs text-slate-400">
              Bron: NDW
              {view.liveStale ? " (cache)" : ""}
              {view.liveAt ? ` · ${formatTime(view.liveAt)}` : ""}
              {" · laatst bijgewerkt · auto elke 30s"}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-4 text-sm text-slate-400">
          <p>
            {view.nextEvent
              ? nextEventLabel(view.nextEvent, now)
              : view.inRushHold
                ? "Spitsvrij — wegverkeer eerst"
                : colors.label}
          </p>
          {linked ? (
            <span className="inline-flex items-center gap-0.5 text-canal">
              {view.bridge.slug === "terneuzen" ? "Kaart" : "Schema"}
              <ChevronRight className="size-4" />
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              {view.source === "manual"
                ? "Handmatig"
                : view.source === "ndw"
                  ? `Bron: NDW${view.liveStale ? " (cache)" : ""}${view.liveAt ? ` · ${formatTime(view.liveAt)}` : ""}`
                  : view.inRushHold
                    ? "Spitsvrij"
                    : "Op afroep"}
            </span>
          )}
        </div>
      </div>
  );

  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden bg-slate-900/80 py-0 ring-1 ring-white/10",
        colors.glow,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1.5", colors.bar)}
      />
      {linked ? (
        <Link
          href={
            view.bridge.slug === "terneuzen"
              ? "/terneuzen"
              : `/brug/${view.bridge.slug}`
          }
          className="block focus-visible:ring-2 focus-visible:ring-canal"
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}
