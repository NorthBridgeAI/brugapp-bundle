"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { X } from "lucide-react";
import { BackLink, ConceptChip, HudCorners } from "@/components/lock-hud";
import { makeStatusMarker } from "@/components/lock-markers";
import {
  A3_BRIDGE_COPY,
  A3_CHAMBERS,
  A3_ROADS,
  A3_ROUNDABOUTS,
  A3_WATER,
  A3_BEARING,
  a3Center,
  a3FitBounds,
  a3MaxBounds,
  bridgePoints,
  decksWithPaint,
  lockLabelPoints,
  type LngLat,
} from "@/lib/a3-geo";
import { recommendA3Route, routeLineGeoJSON } from "@/lib/a3-routes";
import {
  A3_PAINT_COLOR,
  A3_PAINT_LABEL,
  type A3Advice,
  type A3BridgeId,
  type A3Paint,
} from "@/lib/a3-status";
import { DARK_RASTER_STYLE } from "@/lib/map-styles";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, LiveSnapshot } from "@/lib/types";

type PickKind =
  | { kind: "bridge"; id: A3BridgeId }
  | { kind: "lock"; id: string }
  | null;

function project(
  lng: number,
  lat: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const [[west, south], [east, north]] = a3FitBounds();
  const padX = width * 0.1;
  const padY = height * 0.08;
  return {
    x: padX + ((lng - west) / (east - west)) * (width - 2 * padX),
    y: padY + ((north - lat) / (north - south)) * (height - 2 * padY),
  };
}

function ringPoints(ring: LngLat[], width: number, height: number): string {
  return ring
    .map(([lng, lat]) => {
      const p = project(lng, lat, width, height);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");
}

function FallbackSvg({
  paints,
  route,
  pick,
  onPickBridge,
  onPickLock,
}: {
  paints: Record<A3BridgeId, A3Paint>;
  route: LngLat[];
  pick: PickKind;
  onPickBridge: (id: A3BridgeId) => void;
  onPickLock: (id: string) => void;
}) {
  const width = 390;
  const height = 844;
  const decks = decksWithPaint(paints);
  return (
    <div
      className="absolute inset-0 z-[1] bg-[#1b2a3d]"
      data-testid="a3-span-fallback"
      aria-label="Noordzeesluizen A3"
    >
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img">
        <rect width={width} height={height} fill="#1b2a3d" />
        <text x="24" y="28" fill="#67e8f9" fontSize="11" fontFamily="ui-sans-serif, system-ui" letterSpacing="1.6">
          Westerschelde ↑
        </text>
        <text x="24" y="820" fill="#94a3b8" fontSize="11" fontFamily="ui-sans-serif, system-ui" letterSpacing="1.6">
          kanaal ↓
        </text>
        {A3_CHAMBERS.features.map((chamber) => (
          <polygon
            key={String(chamber.properties.id)}
            points={ringPoints(chamber.geometry.coordinates[0], width, height)}
            fill="#22d3ee"
            fillOpacity="0.32"
            stroke="#a5f3fc"
            strokeWidth="2"
          />
        ))}
        {decks.features.map((deck) => (
          <polygon
            key={String(deck.properties.id)}
            points={ringPoints(deck.geometry.coordinates[0], width, height)}
            fill={String(deck.properties.color)}
            fillOpacity="0.88"
            stroke="#020617"
            strokeWidth="1.5"
            onClick={() => onPickBridge(String(deck.properties.id) as A3BridgeId)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {route.length > 1 ? (
          <polyline
            points={route
              .map(([lng, lat]) => {
                const p = project(lng, lat, width, height);
                return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
              })
              .join(" ")}
            fill="none"
            stroke="#4ade80"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.92"
          />
        ) : null}
        {lockLabelPoints().map((lock) => {
          const p = project(lock.lng, lock.lat, width, height);
          const selected = pick?.kind === "lock" && pick.id === lock.id;
          return (
            <g key={lock.id} transform={`translate(${p.x} ${p.y})`} onClick={() => onPickLock(lock.id)} style={{ cursor: "pointer" }}>
              <circle r="8" fill={selected ? "#fde68a" : "#cbd5e1"} stroke="#020617" strokeWidth="2" />
              <text x={lock.offset === "left" ? -16 : 16} y="4" textAnchor={lock.offset === "left" ? "end" : "start"} fill="#f8fafc" fontSize="12" fontWeight="700" fontFamily="ui-sans-serif, system-ui">
                {lock.full}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function paintStatic(map: maplibregl.Map) {
  if (map.getSource("a3-water")) return;
  map.addSource("a3-water", { type: "geojson", data: A3_WATER });
  map.addLayer({
    id: "a3-water",
    type: "fill",
    source: "a3-water",
    paint: { "fill-color": "#0e7490", "fill-opacity": 0.28 },
  });
  map.addSource("a3-roads", { type: "geojson", data: A3_ROADS });
  map.addLayer({
    id: "a3-roads",
    type: "line",
    source: "a3-roads",
    paint: { "line-color": "#94a3b8", "line-width": 2.2, "line-opacity": 0.55 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a3-roundabouts", { type: "geojson", data: A3_ROUNDABOUTS });
  map.addLayer({
    id: "a3-roundabouts",
    type: "line",
    source: "a3-roundabouts",
    paint: { "line-color": "#cbd5e1", "line-width": 2.8, "line-opacity": 0.7 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a3-chambers", { type: "geojson", data: A3_CHAMBERS });
  map.addLayer({
    id: "a3-chambers-fill",
    type: "fill",
    source: "a3-chambers",
    paint: { "fill-color": "#22d3ee", "fill-opacity": 0.32 },
  });
  map.addLayer({
    id: "a3-chambers-line",
    type: "line",
    source: "a3-chambers",
    paint: { "line-color": "#a5f3fc", "line-width": 2.2 },
  });
  map.addSource("a3-decks", { type: "geojson", data: decksWithPaint({
    "oostsluis-buitenhoofd": "no-live-data",
    "oostsluis-binnenhoofd": "no-live-data",
    "westsluis-noord": "no-live-data",
    "westsluis-zuid": "no-live-data",
    "nieuwe-sluis-buitenhoofd": "no-live-data",
    "nieuwe-sluis-binnenhoofd": "no-live-data",
  }) });
  map.addLayer({
    id: "a3-decks-fill",
    type: "fill",
    source: "a3-decks",
    paint: { "fill-color": ["get", "color"], "fill-opacity": 0.9 },
  });
  map.addLayer({
    id: "a3-decks-line",
    type: "line",
    source: "a3-decks",
    paint: { "line-color": "#020617", "line-width": 1.4 },
  });
  map.addSource("a3-route", { type: "geojson", data: routeLineGeoJSON([]) });
  map.addLayer({
    id: "a3-route-halo",
    type: "line",
    source: "a3-route",
    paint: { "line-color": "#022c22", "line-width": 10, "line-opacity": 0.55 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a3-route",
    type: "line",
    source: "a3-route",
    paint: {
      "line-color": "#4ade80",
      "line-width": 5.5,
      "line-opacity": 0.95,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function watchA3Size(map: maplibregl.Map, paddingOf: () => maplibregl.PaddingOptions) {
  let touched = false;
  const mark = () => {
    touched = true;
  };
  const canvas = map.getCanvas();
  canvas.addEventListener("pointerdown", mark, { passive: true });
  canvas.addEventListener("wheel", mark, { passive: true });
  canvas.addEventListener("touchstart", mark, { passive: true });

  const sync = () => {
    const box = map.getContainer().getBoundingClientRect();
    if (box.width < 80 || box.height < 80) return;
    map.resize();
    if (touched) return;
    const phone = box.width < 640;
    const padding = paddingOf();
    const top = Math.max(72, padding.top ?? 0);
    const bottom = Math.max(88, padding.bottom ?? 0);
    const left = Math.max(16, padding.left ?? 0);
    const right = Math.max(16, padding.right ?? 0);
    if (top + bottom > 0.62 * box.height) {
      map.jumpTo({
        center: a3Center(),
        zoom: phone ? 13.2 : 13.7,
        bearing: A3_BEARING,
        pitch: 0,
      });
      return;
    }
    map.fitBounds(a3FitBounds(), {
      padding: { top, bottom, left, right },
      bearing: A3_BEARING,
      maxZoom: phone ? 14.1 : 14.5,
      duration: 0,
    });
  };

  const observer = new ResizeObserver(() => sync());
  observer.observe(map.getContainer());
  const frame = window.requestAnimationFrame(() => {
    window.requestAnimationFrame(sync);
  });
  map.once("idle", sync);

  return {
    refit: sync,
    disconnect: () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", mark);
      canvas.removeEventListener("wheel", mark);
      canvas.removeEventListener("touchstart", mark);
    },
  };
}

function Legend() {
  const items: A3Paint[] = ["open", "closed", "no-live-data"];
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium leading-4 text-slate-100">
      {items.map((item) => (
        <li key={item} className="inline-flex items-center gap-1.5">
          <span
            className="size-3 rounded-full ring-1 ring-black/20"
            style={{ background: A3_PAINT_COLOR[item] }}
            aria-hidden
          />
          {A3_PAINT_LABEL[item]}
        </li>
      ))}
    </ul>
  );
}

export function DraftA3Map({
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
  const route = useMemo(() => recommendA3Route(live), [live]);
  const liveAt = live?.fetchedAt ? formatTime(new Date(live.fetchedAt)) : formatTime(now);
  const container = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<(next: PickKind) => void>(() => undefined);
  const padRef = useRef({ top: 132, bottom: 148, left: 16, right: 16 });
  const refitRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [pick, setPick] = useState<PickKind>(null);
  const [chromePad, setChromePad] = useState(padRef.current);
  pickRef.current = setPick;
  padRef.current = chromePad;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: DARK_RASTER_STYLE,
        center: a3Center(),
        zoom: phone ? 13.2 : 13.7,
        minZoom: 12.4,
        bearing: A3_BEARING,
        pitch: 0,
        attributionControl: false,
        maxBounds: a3MaxBounds(),
      });
    } catch {
      setWebglOk(false);
      return;
    }
    const onWindowError = (event: ErrorEvent) => {
      const message = String(event.message ?? event.error ?? "");
      if (message.includes("WebGL") || message.includes("webgl") || message.includes("Failed to initialize")) {
        event.preventDefault();
        setWebglOk(false);
      }
    };
    window.addEventListener("error", onWindowError);
    map.getContainer().classList.add("draft-lock-map");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    if (!phone) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    }
    const timeout = window.setTimeout(() => {
      if (!map.loaded()) setFailed(true);
    }, 10_000);
    map.on("error", (event) => {
      const message = String(event.error?.message ?? event.error ?? "");
      if (message.includes("WebGL") || message.includes("webgl") || message.includes("Failed to initialize")) {
        setWebglOk(false);
        return;
      }
      if (message.includes("wood-pattern") || message.includes("image")) return;
      if (message.includes("source") || message.includes("tile") || message.includes("ajax")) {
        setFailed(true);
      }
    });
    const watch = watchA3Size(map, () => padRef.current);
    refitRef.current = watch.refit;
    map.on("load", () => {
      window.clearTimeout(timeout);
      paintStatic(map);
      watch.refit();
      setReady(true);
    });
    map.on("click", (event) => {
      if (map.getLayer("a3-decks-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a3-decks-fill"] });
        const id = hits[0]?.properties?.id;
        if (id) {
          pickRef.current({ kind: "bridge", id: String(id) as A3BridgeId });
          return;
        }
      }
      if (map.getLayer("a3-chambers-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a3-chambers-fill"] });
        const lockId = hits[0]?.properties?.lockId ?? hits[0]?.properties?.id;
        if (lockId) {
          pickRef.current({ kind: "lock", id: String(lockId) });
          return;
        }
      }
      const target = event.originalEvent.target as HTMLElement | null;
      if (!target?.closest("button")) pickRef.current(null);
    });
    mapRef.current = map;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      window.clearTimeout(timeout);
      window.removeEventListener("error", onWindowError);
      watch.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const decks = map.getSource("a3-decks") as maplibregl.GeoJSONSource | undefined;
    decks?.setData(decksWithPaint(route.paints));
    const line = map.getSource("a3-route") as maplibregl.GeoJSONSource | undefined;
    line?.setData(routeLineGeoJSON(route.advice.showRoute ? route.coordinates : []));
  }, [route, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((marker) => marker.remove());
    const lockMarks = lockLabelPoints().map((lock) => {
      const selected = pick?.kind === "lock" && pick.id === lock.id;
      const element = makeStatusMarker({
        title: `${lock.full} — ${lock.note}`,
        short: lock.full,
        fill: "#cbd5e1",
        offset: lock.offset,
        selected,
        onClick: () => setPick({ kind: "lock", id: lock.id }),
      });
      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([lock.lng, lock.lat])
        .addTo(map);
    });
    const bridgeMarks = bridgePoints().map((bridge) => {
      const copy = A3_BRIDGE_COPY[bridge.id];
      const paint = route.paints[bridge.id];
      const selected = pick?.kind === "bridge" && pick.id === bridge.id;
      const liveNdw = Boolean(bridge.ndwIsrs);
      const element = makeStatusMarker({
        title: liveNdw
          ? `${copy.full}: ${A3_PAINT_LABEL[paint]}${bridge.ndwIsrs ? ` · ${bridge.ndwIsrs}` : ""}`
          : `${copy.full}: geen live data`,
        short: copy.short,
        fill: A3_PAINT_COLOR[paint],
        offset: copy.offset,
        selected,
        onClick: () => setPick({ kind: "bridge", id: bridge.id }),
        sub: liveNdw ? undefined : "geen live data",
      });
      return new maplibregl.Marker({ element, anchor: "center" })
        .setLngLat([bridge.lng, bridge.lat])
        .addTo(map);
    });
    markers.current = [...lockMarks, ...bridgeMarks];
  }, [pick, ready, route.paints]);

  useEffect(() => {
    const header = hudRef.current;
    const card = cardRef.current;
    const sync = () => {
      const phone = window.innerWidth < 640;
      const top = header?.getBoundingClientRect().height ?? (phone ? 118 : 110);
      const bottom = card?.getBoundingClientRect().height ?? (phone ? 136 : 120);
      const next = {
        top: Math.ceil(top + 8),
        bottom: Math.ceil(bottom + 10),
        left: phone ? 14 : 48,
        right: phone ? 14 : 48,
      };
      padRef.current = next;
      setChromePad(next);
      refitRef.current();
    };
    sync();
    const observer = new ResizeObserver(sync);
    if (header) observer.observe(header);
    if (card) observer.observe(card);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [route.advice.title, pick]);

  const banner =
    route.advice.tone === "closed"
      ? "border-red-400/70 bg-red-950/90 text-red-50"
      : route.advice.tone === "open"
        ? "border-emerald-400/70 bg-emerald-950/90 text-emerald-50"
        : "border-white/20 bg-slate-950/90 text-slate-100";

  const cardBody = cardCopy(pick, route.paints, route.advice);

  return (
    <div className="fixed inset-0 z-50 bg-[#05080d] text-slate-100">
      <div ref={container} className="absolute inset-0 h-full w-full" data-testid="a3-map" />
      {(!webglOk || !ready) && (
        <div
          className="absolute z-[1]"
          style={{
            top: chromePad.top,
            right: chromePad.right,
            bottom: chromePad.bottom,
            left: chromePad.left,
          }}
        >
          <FallbackSvg
            paints={route.paints}
            route={route.advice.showRoute ? route.coordinates : []}
            pick={pick}
            onPickBridge={(id) => setPick({ kind: "bridge", id })}
            onPickLock={(id) => setPick({ kind: "lock", id })}
          />
        </div>
      )}
      <div className="hidden sm:contents">
        <HudCorners />
      </div>
      <header
        ref={hudRef}
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        data-testid="a3-top-hud"
      >
        <div className="pointer-events-auto mx-auto w-full max-w-xl space-y-1 px-3 pt-2.5 sm:px-5 sm:pt-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <BackLink />
              <p className="mt-0.5 font-mono text-[10px] tracking-[0.22em] text-amber-300 uppercase">
                Noordzeesluizen
              </p>
              <h1 className="font-serif text-base leading-tight text-slate-50 sm:text-2xl">
                Terneuzen
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              <ConceptChip letter="A3" />
              <p className="inline-flex items-center gap-1.5 font-mono text-[11px] text-cyan-200">
                <span
                  className="size-2 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9] motion-safe:animate-pulse"
                  aria-hidden
                />
                <span data-testid="a3-live-clock">{liveAt}</span>
              </p>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-white/15 bg-slate-950/78 px-2.5 py-1 backdrop-blur-md sm:py-1.5"
            title={catalog.status.disclaimer}
          >
            <Legend />
            <p className="text-[11px] leading-4 text-slate-300">Op afroep · NWB-wegen</p>
          </div>
        </div>
      </header>
      <footer
        ref={cardRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-4"
        data-testid="a3-bottom-card"
      >
        <div className={cn("pointer-events-auto mx-auto w-full max-w-xl rounded-xl border px-3 py-2.5 backdrop-blur-md transition-colors duration-300", banner)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-current/80">
                {cardBody.kicker}
              </p>
              <p className="text-sm font-semibold leading-tight sm:text-base">{cardBody.title}</p>
              <p className="mt-0.5 text-[12px] leading-4 text-current/90">{cardBody.detail}</p>
              {cardBody.isrs ? (
                <p className="mt-1 font-mono text-[10px] text-current/70">{cardBody.isrs}</p>
              ) : null}
            </div>
            {pick ? (
              <button
                type="button"
                onClick={() => setPick(null)}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-current hover:bg-white/10"
                aria-label="Sluit selectie"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </footer>
      {webglOk && !ready && !failed ? (
        <p className="pointer-events-none absolute left-1/2 top-[48%] -translate-x-1/2 font-mono text-xs text-cyan-200/80">
          Esri-basemap laden…
        </p>
      ) : null}
      {failed && webglOk ? (
        <p className="absolute left-1/2 top-[48%] max-w-xs -translate-x-1/2 text-center text-sm text-amber-200">
          Open-tegels niet bereikbaar. Officiële geometrie blijft zichtbaar.
        </p>
      ) : null}
    </div>
  );
}

function cardCopy(
  pick: PickKind,
  paints: Record<A3BridgeId, A3Paint>,
  advice: A3Advice,
): { kicker: string; title: string; detail: string; isrs?: string } {
  if (pick?.kind === "bridge") {
    const copy = A3_BRIDGE_COPY[pick.id];
    const paint = paints[pick.id];
    const ndw =
      pick.id === "oostsluis-buitenhoofd"
        ? "NLTNZ130B20497800009"
        : pick.id === "oostsluis-binnenhoofd"
          ? "NLTNZ130B20497600005"
          : null;
    return {
      kicker: ndw ? "Live NDW" : "Geen live NDW",
      title: copy.full,
      detail: ndw
        ? `${A3_PAINT_LABEL[paint]}. Alleen deze twee Oostsluis-oversteken zitten in de DATEX-fetch.`
        : "Geen bevestigde NDW-ISRS in de live fetch. Status blijft Geen live data — we raden niets.",
      isrs: ndw ?? undefined,
    };
  }
  if (pick?.kind === "lock") {
    const locks: Record<string, { title: string; detail: string }> = {
      westsluis: {
        title: "Westsluis",
        detail: "Officiële kolk 290×38 m. Beide bruggen zonder live NDW.",
      },
      "nieuwe-sluis": {
        title: "Nieuwe Sluis",
        detail: "Officiële sluis 427×55 m. Beide bruggen zonder live NDW. Geen Middensluis.",
      },
      oostsluis: {
        title: "Oostsluis",
        detail: "Officiële kolk 280×24 m. Live NDW op binnenhoofd en buitenhoofd.",
      },
    };
    const lock = locks[pick.id] ?? { title: pick.id, detail: "Landmark." };
    return { kicker: "Sluis", title: lock.title, detail: lock.detail };
  }
  return {
    kicker: "Aanbevolen route",
    title: advice.title,
    detail: advice.detail,
  };
}
