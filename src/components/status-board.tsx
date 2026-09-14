"use client";

import { StatusCard } from "@/components/status-card";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { activeBridges, deriveBridgeView } from "@/lib/status";
import { formatDate, formatTime } from "@/lib/time";
import type { Catalog, LiveSnapshot } from "@/lib/types";

export function StatusBoard({
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
  const views = activeBridges(catalog).map((bridge) =>
    deriveBridgeView(bridge, catalog, now, live),
  );
  const liveAt = live?.fetchedAt ? new Date(live.fetchedAt) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-canal uppercase">
          {catalog.region}
        </p>
        <h1 className="font-serif text-3xl leading-tight text-slate-50 sm:text-4xl">
          Kun je oversteken?
        </h1>
        <p className="max-w-lg text-sm leading-6 text-slate-400">
          Stand van de Noordzeesluizen, Draaibrug Sluiskil en Draaibrug Sas van
          Gent op het {catalog.waterway}. {formatDate(now)}.
        </p>
      </header>

      <div className="grid gap-4">
        {views.map((view) => (
          <StatusCard key={view.bridge.id} view={view} now={now} />
        ))}
      </div>

      <p className="text-xs leading-5 text-slate-400">
        {live?.ok
          ? `Bron: NDW${live.stale ? " (cache)" : ""}${liveAt ? ` · laatste stand ${formatTime(liveAt)}` : ""} · laatst bijgewerkt · auto elke 30s. ${catalog.status.disclaimer}`
          : `${catalog.status.disclaimer} Auto elke 30s.`}
      </p>
    </div>
  );
}
