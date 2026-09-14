"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BackLink,
  ConceptChip,
  Disclaimer,
  StatusLegend,
  StatusPanel,
  type MapPick,
} from "@/components/lock-hud";
import { makeHtmlPin, makeStatusMarker } from "@/components/lock-markers";
import { addChamberLayers } from "@/lib/lock-layers";
import {
  LOCK_CHAMBERS,
  LOCK_COPY,
  LOCK_FRAME,
  liveNdwPins,
  type LockId,
} from "@/lib/lock-map";
import { LIGHT_RASTER_STYLE } from "@/lib/map-styles";
import { watchLockMapSize } from "@/lib/watch-lock-map";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, LiveCrossingHit, LiveSnapshot } from "@/lib/types";

function OpsCard({
  pin,
  selected,
  onSelect,
}: {
  pin: LiveCrossingHit;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = {
    clear: "#15803d",
    wait: "#b91c1c",
    soon: "#a16207",
    unknown: "#475569",
  }[pin.road];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-2xl border-2 border-slate-900 bg-white p-4 text-left",
        pin.road === "wait" && "bg-red-50",
        pin.road === "clear" && "bg-emerald-50",
        selected && "ring-2 ring-slate-950",
      )}
    >
      <p className="text-xs font-medium tracking-[0.16em] text-slate-600 uppercase">
        Live NDW
      </p>
      <div className="mt-1 flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold leading-tight">{pin.label}</h2>
        <span
          className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-white"
          style={{ background: tone }}
        >
          {pin.road === "wait" ? "Dicht" : pin.road === "clear" ? "Open" : pin.road === "soon" ? "Let op" : "Geen NDW"}
        </span>
      </div>
      <p className="mt-2 font-mono text-xs text-slate-600">{pin.isrs}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">Op afroep</p>
    </button>
  );
}

export function DraftBOps({
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
  const pins = liveNdwPins(live);
  const liveAt = live?.fetchedAt
    ? formatTime(new Date(live.fetchedAt))
    : formatTime(now);
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const ndwMarkers = useRef<maplibregl.Marker[]>([]);
  const lockMarkers = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<(next: MapPick) => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState<MapPick>(null);
  pickRef.current = setPick;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    const map = new maplibregl.Map({
      container: container.current,
      style: LIGHT_RASTER_STYLE,
      center: phone ? LOCK_FRAME.phoneCenter : LOCK_FRAME.center,
      zoom: phone ? LOCK_FRAME.phoneZoom : LOCK_FRAME.zoom,
      minZoom: 12.8,
      bearing: LOCK_FRAME.bearing,
      pitch: 0,
      attributionControl: false,
    });
    map.getContainer().classList.add("draft-lock-map");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    if (!phone) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }
    const timeout = window.setTimeout(() => {
      if (!map.loaded()) setFailed(true);
    }, 10_000);
    const unwatch = watchLockMapSize(map);
    map.on("load", () => {
      window.clearTimeout(timeout);
      addChamberLayers(map, "#0f766e", "#0f172a");
      setReady(true);
    });
    map.on("click", (event) => {
      if (!map.getLayer("chambers-fill")) return;
      const hits = map.queryRenderedFeatures(event.point, { layers: ["chambers-fill"] });
      const id = hits[0]?.properties?.id;
      if (id) {
        pickRef.current({ kind: "lock", id: String(id) });
        return;
      }
      const target = event.originalEvent.target as HTMLElement | null;
      if (!target?.closest("button")) pickRef.current(null);
    });
    mapRef.current = map;
    return () => {
      ndwMarkers.current.forEach((marker) => marker.remove());
      lockMarkers.current.forEach((marker) => marker.remove());
      window.clearTimeout(timeout);
      unwatch();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    lockMarkers.current.forEach((marker) => marker.remove());
    lockMarkers.current = LOCK_CHAMBERS.map((chamber) => {
      const copy = LOCK_COPY[chamber.id as LockId];
      const element = makeStatusMarker({
        title: `${copy.full} — landmark, geen live NDW`,
        short: copy.short,
        fill: "#475569",
        light: true,
        offset: copy.offset,
        selected: pick?.kind === "lock" && pick.id === chamber.id,
        onClick: () => setPick({ kind: "lock", id: chamber.id }),
      });
      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([chamber.coordinates.lng, chamber.coordinates.lat])
        .addTo(map);
    });
  }, [pick, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    ndwMarkers.current.forEach((marker) => marker.remove());
    ndwMarkers.current = pins.map((pin) =>
      new maplibregl.Marker({
        element: makeHtmlPin(pin, true, pick?.kind === "ndw" && pick.id === pin.id, () =>
          setPick({ kind: "ndw", id: pin.id }),
        ),
        anchor: "center",
      })
        .setLngLat([pin.coordinates.lng, pin.coordinates.lat])
        .addTo(map),
    );
  }, [pins, pick, ready]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f4f1ea] text-slate-950">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300 px-4 py-3 sm:px-6">
        <div>
          <BackLink light />
          <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-slate-600 uppercase">
            Bediening · sluiscomplex
          </p>
          <h1 className="font-serif text-2xl text-slate-950 sm:text-3xl">Terneuzen</h1>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ConceptChip letter="B" light />
          <p className="font-mono text-sm text-slate-800">Live {liveAt}</p>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <section className="relative min-h-0 flex-1 border-b-2 border-slate-900 bg-white lg:border-b-0 lg:border-r-2">
          <div ref={container} className="absolute inset-0 h-full w-full" />
          {ready || failed ? null : (
            <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-slate-700">
              Kaart laden…
            </p>
          )}
          {failed ? (
            <p className="absolute inset-x-6 top-1/2 -translate-y-1/2 text-center text-sm text-red-700">
              Open-tegels niet bereikbaar.
            </p>
          ) : null}
          <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-white px-2 py-1 text-[12px] font-semibold text-slate-900 ring-1 ring-slate-900">
            Westerschelde ↑ · kanaal ↓
          </p>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-3 lg:hidden">
            <div className="pointer-events-auto space-y-2">
              <StatusPanel pick={pick} pins={pins} light onClose={() => setPick(null)} />
              <div className="rounded-xl border-2 border-slate-900 bg-white px-3 py-2">
                <StatusLegend light />
                <p className="mt-1 text-[12px] font-medium text-slate-900">Op afroep</p>
              </div>
            </div>
          </div>
        </section>
        <aside className="hidden min-h-0 overflow-y-auto p-4 lg:flex lg:flex-col lg:gap-3">
          {pins.map((pin) => (
            <OpsCard
              key={pin.id}
              pin={pin}
              selected={pick?.kind === "ndw" && pick.id === pin.id}
              onSelect={() => setPick({ kind: "ndw", id: pin.id })}
            />
          ))}
          <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
            <h2 className="text-sm font-semibold tracking-wide uppercase">Landmarks</h2>
            <ul className="mt-2 space-y-1">
              {LOCK_CHAMBERS.map((chamber) => {
                const selected = pick?.kind === "lock" && pick.id === chamber.id;
                return (
                  <li key={chamber.id}>
                    <button
                      type="button"
                      onClick={() => setPick({ kind: "lock", id: chamber.id })}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left",
                        selected && "bg-slate-200",
                      )}
                    >
                      <span>
                        <span className="block font-semibold">
                          {LOCK_COPY[chamber.id as LockId].full}
                        </span>
                        <span className="text-xs text-slate-600">{chamber.note}</span>
                      </span>
                      <span className="text-sm font-medium text-slate-600">Geen NDW</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <StatusPanel pick={pick} pins={pins} light onClose={() => setPick(null)} />
          <div className="rounded-2xl border-2 border-slate-900 bg-white p-4">
            <StatusLegend light />
            <p className="mt-2 text-sm text-slate-800">
              Geen vaste bedientijden. Terneuzen wordt op afroep bediend.
            </p>
            <Disclaimer
              light
              text={catalog.status.disclaimer}
              liveAt={liveAt}
              stale={live?.stale}
              ok={live?.ok}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
