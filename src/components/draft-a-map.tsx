"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BackLink,
  ConceptChip,
  Disclaimer,
  HudCorners,
  StatusLegend,
  StatusPanel,
  type MapPick,
} from "@/components/lock-hud";
import { makeHtmlPin, makeStatusMarker } from "@/components/lock-markers";
import { addChamberLayers, lockMaxBounds } from "@/lib/lock-layers";
import {
  LOCK_CHAMBERS,
  LOCK_COPY,
  LOCK_FRAME,
  liveNdwPins,
  type LockId,
} from "@/lib/lock-map";
import { DARK_RASTER_STYLE } from "@/lib/map-styles";
import { watchLockMapSize } from "@/lib/watch-lock-map";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, LiveSnapshot } from "@/lib/types";

export function DraftAMap({
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
  const [tilt, setTilt] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pick, setPick] = useState<MapPick>(null);
  pickRef.current = setPick;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    const map = new maplibregl.Map({
      container: container.current,
      style: DARK_RASTER_STYLE,
      center: phone ? LOCK_FRAME.phoneCenter : LOCK_FRAME.center,
      zoom: phone ? LOCK_FRAME.phoneZoom : LOCK_FRAME.zoom,
      minZoom: 12.8,
      bearing: LOCK_FRAME.bearing,
      pitch: LOCK_FRAME.pitch2d,
      attributionControl: false,
      maxBounds: lockMaxBounds(),
    });
    map.getContainer().classList.add("draft-lock-map");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    if (!phone) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }
    const timeout = window.setTimeout(() => {
      if (!map.loaded()) setFailed(true);
    }, 10_000);
    map.on("error", (event) => {
      const message = String(event.error?.message ?? "");
      if (message.includes("wood-pattern") || message.includes("image")) return;
    });
    const unwatch = watchLockMapSize(map);
    map.on("load", () => {
      window.clearTimeout(timeout);
      addChamberLayers(map, "#22d3ee", "#a5f3fc");
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
      ndwMarkers.current = [];
      lockMarkers.current = [];
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
        fill: "#cbd5e1",
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
        element: makeHtmlPin(pin, false, pick?.kind === "ndw" && pick.id === pin.id, () =>
          setPick({ kind: "ndw", id: pin.id }),
        ),
        anchor: "center",
      })
        .setLngLat([pin.coordinates.lng, pin.coordinates.lat])
        .addTo(map),
    );
  }, [pins, pick, ready]);

  return (
    <div className="fixed inset-0 z-50 bg-[#05080d] text-slate-100">
      <div ref={container} className="absolute inset-0 h-full w-full" />
      <div className="hidden sm:contents">
        <HudCorners />
      </div>
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-6 sm:pt-4">
        <div className="pointer-events-auto flex items-start justify-between gap-2">
          <div className="min-w-0">
            <BackLink />
            <p className="mt-1 font-mono text-[10px] tracking-[0.22em] text-amber-300 uppercase">
              Noordzeesluizen
            </p>
            <h1 className="font-serif text-xl text-slate-50 sm:text-3xl">Terneuzen</h1>
            <p className="mt-1 hidden text-[11px] font-medium text-slate-300 sm:block">
              Westerschelde ↑ · kanaal ↓
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <ConceptChip letter="A" />
            <p className="font-mono text-[11px] text-cyan-200">{liveAt}</p>
          </div>
        </div>
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-6 sm:pb-4">
        <div className="pointer-events-auto mx-auto flex w-full max-w-xl flex-col gap-2">
          <StatusPanel pick={pick} pins={pins} onClose={() => setPick(null)} />
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/90 px-3 py-2 backdrop-blur-md">
              <StatusLegend />
              <Disclaimer
                text={catalog.status.disclaimer}
                liveAt={liveAt}
                stale={live?.stale}
                ok={live?.ok}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !tilt;
                setTilt(next);
                mapRef.current?.easeTo({
                  pitch: next ? LOCK_FRAME.pitch3d : LOCK_FRAME.pitch2d,
                  duration: 700,
                });
              }}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 font-mono text-[11px] tracking-[0.14em] uppercase",
                tilt
                  ? "border-amber-300/70 bg-amber-300 text-slate-950"
                  : "border-cyan-300/50 bg-slate-950/90 text-cyan-100",
              )}
            >
              {tilt ? "3D" : "2D"}
            </button>
          </div>
        </div>
      </div>
      {ready || failed ? null : (
        <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-xs text-cyan-200">
          Kaart laden…
        </p>
      )}
      {failed ? (
        <p className="absolute left-1/2 top-1/2 max-w-xs -translate-x-1/2 -translate-y-1/2 text-center text-sm text-red-300">
          Open-tegels niet bereikbaar. Controleer de verbinding.
        </p>
      ) : null}
    </div>
  );
}
