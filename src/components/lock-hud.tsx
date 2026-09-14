"use client";

import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import {
  LOCK_CHAMBERS,
  LOCK_COPY,
  PIN_COPY,
  ROAD_TONE,
  type LockId,
} from "@/lib/lock-map";
import { cn } from "@/lib/utils";
import type { LiveCrossingHit, RoadStatus } from "@/lib/types";

export type MapPick =
  | { kind: "ndw"; id: string }
  | { kind: "lock"; id: string }
  | { kind: "span"; id: string }
  | null;

export function BackLink({
  light = false,
  href = "/terneuzen",
}: {
  light?: boolean;
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-sm font-medium",
        light
          ? "text-slate-700 hover:text-slate-950"
          : "text-slate-300 hover:text-cyan-200",
      )}
    >
      <ArrowLeft className="size-4" />
      Terug naar IsoMap
    </Link>
  );
}

export function ConceptChip({
  letter,
  light = false,
}: {
  letter: string;
  light?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[11px] tracking-[0.14em] uppercase",
        light
          ? "border-slate-300 bg-white text-slate-700"
          : "border-cyan-400/40 bg-slate-950/70 text-cyan-200",
      )}
    >
      Concept {letter}
    </span>
  );
}

export function Disclaimer({
  text,
  liveAt,
  stale,
  ok,
  light = false,
}: {
  text: string;
  liveAt?: string;
  stale?: boolean;
  ok?: boolean;
  light?: boolean;
}) {
  return (
    <p className={cn("max-w-xl text-[11px] leading-4", light ? "text-slate-700" : "text-slate-300")}>
      {ok
        ? `Bron: NDW${stale ? " (cache)" : ""}${liveAt ? ` · ${liveAt}` : ""} · auto elke 30s. `
        : ""}
      Op afroep. {text}
    </p>
  );
}

export function HudCorners() {
  const corner = "pointer-events-none absolute size-7 border-cyan-300/70";
  return (
    <>
      <span className={cn(corner, "left-3 top-3 border-l-2 border-t-2")} />
      <span className={cn(corner, "right-3 top-3 border-r-2 border-t-2")} />
      <span className={cn(corner, "bottom-3 left-3 border-b-2 border-l-2")} />
      <span className={cn(corner, "right-3 bottom-3 border-b-2 border-r-2")} />
    </>
  );
}

export function StatusLegend({ light = false }: { light?: boolean }) {
  const items: Array<{ status: RoadStatus; swatch: string }> = [
    { status: "clear", swatch: "bg-[#15803d]" },
    { status: "wait", swatch: "bg-[#b91c1c]" },
    { status: "unknown", swatch: "bg-[#475569]" },
  ];
  return (
    <ul
      className={cn(
        "flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium leading-4",
        light ? "text-slate-800" : "text-slate-100",
      )}
    >
      {items.map((item) => (
        <li key={item.status} className="inline-flex items-center gap-1.5">
          <span
            className={cn("size-3 rounded-full ring-1 ring-black/20", item.swatch)}
            aria-hidden
          />
          {ROAD_TONE[item.status].short}
        </li>
      ))}
    </ul>
  );
}

function panelCopy(pick: MapPick, pins: LiveCrossingHit[]) {
  if (!pick) return null;
  if (pick.kind === "ndw" || pick.kind === "span") {
    const pin = pins.find((item) => item.id === pick.id);
    if (!pin) return null;
    const copy = PIN_COPY[pin.id];
    const osmOnly = !pin.hasNdw;
    return {
      title: copy?.full ?? pin.label,
      note: osmOnly
        ? "Geen live NDW — OSM-oversteek, alleen ter oriëntatie."
        : pin.seen
          ? "Live NDW-situatie in deze snapshot."
          : "Live NDW-ISRS, nu geen situatie.",
      road: osmOnly ? ("unknown" as const) : pin.road,
      isrs: pin.isrs,
      kind: osmOnly ? "OSM" : "Live NDW",
    };
  }
  const lock = LOCK_CHAMBERS.find((item) => item.id === pick.id);
  if (!lock) return null;
  return {
    title: LOCK_COPY[lock.id as LockId]?.full ?? lock.label,
    note: `${lock.note} — landmark, geen live NDW.`,
    road: "unknown" as const,
    isrs: "",
    kind: "Landmark",
  };
}

export function StatusPanel({
  pick,
  pins,
  light = false,
  onClose,
}: {
  pick: MapPick;
  pins: LiveCrossingHit[];
  light?: boolean;
  onClose: () => void;
}) {
  const copy = panelCopy(pick, pins);
  if (!copy) return null;
  const tone = ROAD_TONE[copy.road];
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        light
          ? "border-slate-900 bg-white text-slate-950"
          : "border-white/15 bg-slate-950/92 text-slate-50 backdrop-blur-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-[10px] font-semibold tracking-[0.16em] uppercase",
              light ? "text-slate-600" : "text-slate-400",
            )}
          >
            {copy.kind}
          </p>
          <h2 className="text-lg font-semibold leading-tight">{copy.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-md",
            light ? "text-slate-700 hover:bg-slate-100" : "text-slate-200 hover:bg-white/10",
          )}
          aria-label="Sluit status"
        >
          <X className="size-4" />
        </button>
      </div>
      <p
        className="mt-2 inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-white"
        style={{ background: tone.fill }}
      >
        {copy.kind === "OSM" ? "geen live NDW" : tone.short}
      </p>
      <p className={cn("mt-2 text-sm leading-5", light ? "text-slate-700" : "text-slate-200")}>
        {copy.note}
      </p>
      {copy.isrs ? (
        <p className={cn("mt-1 font-mono text-[11px]", light ? "text-slate-600" : "text-slate-400")}>
          {copy.isrs}
        </p>
      ) : null}
      <p
        className={cn(
          "mt-2 text-sm font-medium",
          light ? "text-slate-900" : "text-amber-200",
        )}
      >
        Op afroep
      </p>
    </div>
  );
}
