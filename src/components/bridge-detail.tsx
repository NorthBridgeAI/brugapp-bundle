"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BridgeFacts } from "@/components/bridge-facts";
import { StatusCard } from "@/components/status-card";
import { ServiceRules } from "@/components/service-rules";
import { TodayTimeline } from "@/components/today-timeline";
import { useNow } from "@/hooks/use-now";
import { deriveBridgeView } from "@/lib/status";
import type { Catalog, LiveSnapshot } from "@/lib/types";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";

export function BridgeDetail({
  catalog,
  slug,
  initialNow,
  initialLive,
}: {
  catalog: Catalog;
  slug: string;
  initialNow: string;
  initialLive: LiveSnapshot | null;
}) {
  const now = useNow(initialNow);
  const live = useLiveSnapshot(initialLive);
  const bridge = catalog.bridges.find((item) => item.slug === slug);
  if (!bridge) return null;

  const view = deriveBridgeView(bridge, catalog, now, live);

  return (
    <div className="space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-canal"
      >
        <ArrowLeft className="size-4" />
        Alle bruggen
      </Link>

      <StatusCard view={view} now={now} linked={false} />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-xl text-slate-50">Vandaag</h2>
          {view.inRushHold ? (
            <Badge className="bg-canal/20 text-canal">Spitsvrij</Badge>
          ) : null}
        </div>
        <TodayTimeline
          events={view.todayEvents}
          now={now}
          emptyLabel="Geen spitsvrij vandaag. Openingen op afroep; live stand op Status."
        />
      </section>
      <section className="space-y-3">
        <h2 className="font-serif text-xl text-slate-50">Bedientijden</h2>
        <ServiceRules catalog={catalog} bridge={bridge} />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl text-slate-50">Gegevens</h2>
        <BridgeFacts bridge={bridge} />
      </section>
    </div>
  );
}
