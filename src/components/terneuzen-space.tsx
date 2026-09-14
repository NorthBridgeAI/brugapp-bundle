"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IsoMap } from "@/components/iso-map";
import { StatusCard } from "@/components/status-card";
import { StatusDot } from "@/components/status-dot";
import { ServiceRules } from "@/components/service-rules";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { deriveBridgeView } from "@/lib/status";
import { crossingList } from "@/lib/terneuzen";
import { formatTime } from "@/lib/time";
import type { Catalog, LiveCrossingHit, LiveSnapshot, RoadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROAD_COPY: Record<RoadStatus, string> = {
  clear: "Weg vrij",
  wait: "Weg dicht",
  soon: "Let op — opening verwacht",
  unknown: "Geen live NDW",
};

export function TerneuzenSpace({
  catalog,
  initialNow,
  initialLive,
}: {
  catalog: Catalog;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  const now = useNow(initialNow);
  const live = useLiveSnapshot(initialLive);
  const bridge = catalog.bridges.find((item) => item.slug === "terneuzen");
  const crossings = crossingList(live);
  const view = bridge ? deriveBridgeView(bridge, catalog, now, live) : null;
  const liveAt = live?.fetchedAt ? new Date(live.fetchedAt) : null;

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-canal"
      >
        <ArrowLeft className="size-4" />
        Alle bruggen
      </Link>

      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-canal uppercase">
          Noordzeesluizen
        </p>
        <h1 className="font-serif text-3xl leading-tight text-slate-50 sm:text-4xl">
          Terneuzen
        </h1>
        <p className="max-w-lg text-sm leading-6 text-slate-400">
          Driedimensionale kaart van het sluiscomplex. Alleen de twee
          Buitenhaven-ISRS kleuren live; sluizen zelf hebben geen vrije NDW-code.
        </p>
      </header>

      {view ? <StatusCard view={view} now={now} linked={false} /> : null}

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-slate-50">Sluiscomplex</h2>
        <IsoMap crossings={crossings} />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-slate-50">Oversteken</h2>
        <ul className="grid gap-2">
          {crossings.map((crossing) => (
            <CrossingRow key={crossing.id} crossing={crossing} />
          ))}
        </ul>
      </section>

      {bridge ? (
        <section className="space-y-3">
          <h2 className="font-serif text-xl text-slate-50">Bedientijden</h2>
          <ServiceRules catalog={catalog} bridge={bridge} />
        </section>
      ) : null}

      <p className="text-xs leading-5 text-slate-400">
        {live?.ok
          ? `Bron: NDW${live.stale ? " (cache)" : ""}${liveAt ? ` · laatste stand ${formatTime(liveAt)}` : ""} · laatst bijgewerkt · auto elke 30s. ${catalog.status.disclaimer}`
          : `${catalog.status.disclaimer} Auto elke 30s.`}
      </p>
    </div>
  );
}

function CrossingRow({ crossing }: { crossing: LiveCrossingHit }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-2xl border border-white/8 bg-slate-900/50 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm text-slate-100">
          <StatusDot
            status={crossing.road}
            pulse={crossing.road === "wait" || crossing.road === "soon"}
          />
          {crossing.label}
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {crossing.hasNdw
            ? crossing.seen
              ? `Live NDW · ${crossing.isrs}`
              : `Catalogus-ISRS, nu geen situatie · ${crossing.isrs}`
            : "Geen live NDW — OSM-oversteek, alleen ter oriëntatie"}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-sm font-medium",
          crossing.road === "clear" && "text-status-clear",
          crossing.road === "wait" && "text-status-wait",
          crossing.road === "soon" && "text-status-soon",
          crossing.road === "unknown" && "text-slate-300",
        )}
      >
        {ROAD_COPY[crossing.road]}
      </p>
    </li>
  );
}
