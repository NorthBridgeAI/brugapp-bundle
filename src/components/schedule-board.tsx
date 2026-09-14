"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceRules } from "@/components/service-rules";
import { TodayTimeline } from "@/components/today-timeline";
import { useNow } from "@/hooks/use-now";
import { activeBridges, deriveBridgeView } from "@/lib/status";
import { formatDate } from "@/lib/time";
import type { Catalog } from "@/lib/types";

export function ScheduleBoard({
  catalog,
  initialNow,
}: {
  catalog: Catalog;
  initialNow: string;
}) {
  const now = useNow(initialNow);
  const views = activeBridges(catalog).map((bridge) =>
    deriveBridgeView(bridge, catalog, now),
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-canal uppercase">
          Bedientijden
        </p>
        <h1 className="font-serif text-3xl text-slate-50">Schema</h1>
        <p className="max-w-lg text-sm leading-6 text-slate-400">
          Sluiskil, Sas van Gent en de Noordzeesluizen worden op afroep
          bediend. De live stand (Vrij / Let op / Wachten) staat op Status, bron
          NDW. Hier alleen echte regels: spitsvrij bij Sluiskil.
        </p>
        <p className="text-xs text-slate-400">{formatDate(now)}</p>
      </header>

      <Tabs defaultValue={views[0]?.bridge.id}>
        <TabsList className="h-auto min-h-8 w-full flex-wrap bg-slate-900">
          {views.map((view) => (
            <TabsTrigger key={view.bridge.id} value={view.bridge.id}>
              {view.bridge.shortName}
            </TabsTrigger>
          ))}
        </TabsList>
        {views.map((view) => {
          const hasTodayRules = view.todayEvents.some(
            (event) => event.kind === "rush_start",
          );
          return (
            <TabsContent
              key={view.bridge.id}
              value={view.bridge.id}
              className="mt-5 space-y-8"
            >
              <section className="space-y-3">
                <h2 className="text-sm font-medium text-slate-300">Regels</h2>
                <ServiceRules catalog={catalog} bridge={view.bridge} />
              </section>
              {hasTodayRules ? (
                <section className="space-y-3">
                  <h2 className="text-sm font-medium text-slate-300">
                    Vandaag
                  </h2>
                  <TodayTimeline
                    events={view.todayEvents}
                    now={now}
                    emptyLabel="Geen spitsvrij vandaag. Openingen op afroep; live stand op Status."
                  />
                </section>
              ) : null}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
