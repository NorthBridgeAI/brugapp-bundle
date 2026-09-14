"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { ArrowLeft, Info, LocateFixed, Map, Route, X } from "lucide-react";
import { ConceptChip } from "@/components/lock-hud";
import {
  A3_BRIDGE_COPY,
  A3_CHAMBERS,
  A3_DECKS,
  A3_ROADS,
  A3_ROUNDABOUTS,
  A3_WATER,
  A3_BEARING,
  a3FitBounds,
  a3MaxBounds,
  bridgePoints,
  decksWithPaint,
  lockLabelPoints,
  type LngLat,
} from "@/lib/a3-geo";
import { recommendA3Route, routeLineGeoJSON } from "@/lib/a3-routes";
import {
  A3_NDW_ISRS,
  A3_PAINT_LABEL,
  type A3Advice,
  type A3BridgeId,
  type A3Paint,
} from "@/lib/a3-status";
import {
  A5_BRIDGE_LABEL,
  SCENARIO_B,
  SIM_PAINTS,
  SIM_PAINT_LABEL,
  parseSimSearch,
  resolveA5Route,
  simSearchString,
  type SimOverrides,
  type SimPaint,
} from "@/lib/a5-sim";
import { DARK_RASTER_STYLE } from "@/lib/map-styles";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, LiveSnapshot } from "@/lib/types";
import type { StyleSpecification } from "maplibre-gl";

type PickKind =
  | { kind: "bridge"; id: A3BridgeId }
  | { kind: "lock"; id: string }
  | null;

const LOCK_LABEL: Record<string, string> = {
  westsluis: "WESTSLUIS",
  "nieuwe-sluis": "NIEUWE SLUIS",
  oostsluis: "OOSTSLUIS",
};

const A5_FILL: Record<A3Paint, string> = {
  open: "#22c55e",
  closed: "#e11d48",
  "no-live-data": "#64748b",
};

const A5_STYLE: StyleSpecification = {
  ...DARK_RASTER_STYLE,
  name: "brugapp-a5",
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#071018" } },
    {
      id: "base",
      type: "raster",
      source: "base",
      paint: {
        "raster-opacity": 0.4,
        "raster-saturation": -0.45,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.52,
      },
    },
  ],
};

function a5FitBounds(): [[number, number], [number, number]] {
  const [[west, south], [east, north]] = a3FitBounds();
  const extra = 0.00135;
  return [
    [west, south - extra],
    [east, north + extra],
  ];
}

function a5Center(): LngLat {
  const [[west, south], [east, north]] = a5FitBounds();
  return [(west + east) / 2, (south + north) / 2];
}

function a5Pitch(): number {
  if (typeof window === "undefined") return 16;
  return window.matchMedia("(max-width: 640px)").matches ? 16 : 24;
}

function project(lng: number, lat: number, width: number, height: number): { x: number; y: number } {
  const [[west, south], [east, north]] = a5FitBounds();
  const padX = width * 0.08;
  const padY = height * 0.06;
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

function deckBarrier(ring: LngLat[]): LngLat[] {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const cx = (minLng + maxLng) / 2;
  const cy = (minLat + maxLat) / 2;
  if (maxLng - minLng >= maxLat - minLat) {
    return [
      [minLng, cy],
      [maxLng, cy],
    ];
  }
  return [
    [cx, minLat],
    [cx, maxLat],
  ];
}

function overlayLineGeoJSON(paints: Record<A3BridgeId, A3Paint>) {
  return {
    type: "FeatureCollection" as const,
    features: A3_DECKS.features.flatMap((feature) => {
      const id = String(feature.properties.id) as A3BridgeId;
      const paint = paints[id] ?? "no-live-data";
      if (paint === "open") return [];
      return [
        {
          type: "Feature" as const,
          properties: { id, paint },
          geometry: {
            type: "LineString" as const,
            coordinates: deckBarrier(feature.geometry.coordinates[0]),
          },
        },
      ];
    }),
  };
}

function compassOf(id: A3BridgeId): "Noord" | "Zuid" {
  return id.includes("zuid") || id.includes("binnenhoofd") ? "Zuid" : "Noord";
}

function contextLabelPoints() {
  const [[west, south], [east, north]] = a5FitBounds();
  return [
    { id: "noordzee", title: "Noordzee", detail: "", lng: (west + east) / 2, lat: north - 0.00018 },
    { id: "westerschelde", title: "Westerschelde", detail: "", lng: west + 0.0024, lat: north - 0.00115 },
    { id: "n61", title: "N61", detail: "Vlissingen · Breskens", lng: west + 0.0004, lat: (south + north) / 2 + 0.0004 },
    { id: "terneuzen", title: "Terneuzen", detail: "", lng: east - 0.00045, lat: (south + north) / 2 + 0.0011 },
    { id: "n62", title: "N62", detail: "Goes · Gent", lng: east - 0.0004, lat: south + 0.0024 },
    { id: "gent", title: "Gent", detail: "Kanaal Gent–Terneuzen", lng: (west + east) / 2 + 0.0016, lat: south + 0.00028 },
  ];
}

function makeHtmlLabel({
  html,
  onClick,
  z = 2,
}: {
  html: string;
  onClick?: () => void;
  z?: number;
}) {
  const el = document.createElement(onClick ? "button" : "div");
  if (onClick) {
    (el as HTMLButtonElement).type = "button";
    el.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
  }
  el.style.cssText = `position:relative;display:flex;align-items:center;justify-content:center;padding:0;border:0;background:transparent;cursor:${onClick ? "pointer" : "default"};z-index:${z};`;
  el.innerHTML = html;
  return el;
}

function paintStatic(map: maplibregl.Map) {
  if (map.getSource("a5-water")) return;
  map.addSource("a5-water", { type: "geojson", data: A3_WATER });
  map.addLayer({
    id: "a5-water",
    type: "fill",
    source: "a5-water",
    paint: { "fill-color": "#0b6a8a", "fill-opacity": 0.78 },
  });
  map.addLayer({
    id: "a5-water-line",
    type: "line",
    source: "a5-water",
    paint: { "line-color": "#67e8f9", "line-width": 0.8, "line-opacity": 0.35 },
  });
  map.addSource("a5-roads", { type: "geojson", data: A3_ROADS });
  map.addLayer({
    id: "a5-roads-case",
    type: "line",
    source: "a5-roads",
    paint: {
      "line-color": "#020617",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 4.5, 15, 9],
      "line-opacity": 0.9,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a5-roads",
    type: "line",
    source: "a5-roads",
    paint: {
      "line-color": "#e2e8f0",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2.1, 15, 4.4],
      "line-opacity": 0.96,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a5-roundabouts", { type: "geojson", data: A3_ROUNDABOUTS });
  map.addLayer({
    id: "a5-roundabouts-case",
    type: "line",
    source: "a5-roundabouts",
    paint: { "line-color": "#020617", "line-width": 6.5, "line-opacity": 0.9 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a5-roundabouts",
    type: "line",
    source: "a5-roundabouts",
    paint: { "line-color": "#f8fafc", "line-width": 3.2, "line-opacity": 0.95 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a5-chambers", { type: "geojson", data: A3_CHAMBERS });
  map.addLayer({
    id: "a5-chambers-fill",
    type: "fill",
    source: "a5-chambers",
    paint: { "fill-color": "#155e75", "fill-opacity": 0.55 },
  });
  map.addLayer({
    id: "a5-chambers-ex",
    type: "fill-extrusion",
    source: "a5-chambers",
    paint: {
      "fill-extrusion-color": "#22d3ee",
      "fill-extrusion-opacity": 0.42,
      "fill-extrusion-height": 1.6,
      "fill-extrusion-base": 0,
    },
  });
  map.addLayer({
    id: "a5-chambers-line",
    type: "line",
    source: "a5-chambers",
    paint: { "line-color": "#a5f3fc", "line-width": 2.2 },
  });
  const empty = decksWithPaint({
    "oostsluis-buitenhoofd": "no-live-data",
    "oostsluis-binnenhoofd": "no-live-data",
    "westsluis-noord": "no-live-data",
    "westsluis-zuid": "no-live-data",
    "nieuwe-sluis-buitenhoofd": "no-live-data",
    "nieuwe-sluis-binnenhoofd": "no-live-data",
  });
  map.addSource("a5-decks", { type: "geojson", data: empty });
  map.addLayer({
    id: "a5-decks-fill",
    type: "fill",
    source: "a5-decks",
    paint: {
      "fill-color": [
        "match",
        ["get", "paint"],
        "open",
        A5_FILL.open,
        "closed",
        A5_FILL.closed,
        A5_FILL["no-live-data"],
      ],
      "fill-opacity": 0.92,
    },
  });
  map.addLayer({
    id: "a5-decks-ex",
    type: "fill-extrusion",
    source: "a5-decks",
    paint: {
      "fill-extrusion-color": [
        "match",
        ["get", "paint"],
        "open",
        A5_FILL.open,
        "closed",
        A5_FILL.closed,
        A5_FILL["no-live-data"],
      ],
      "fill-extrusion-opacity": 0.88,
      "fill-extrusion-height": 6,
      "fill-extrusion-base": 1.4,
    },
  });
  map.addLayer({
    id: "a5-decks-line",
    type: "line",
    source: "a5-decks",
    paint: { "line-color": "#020617", "line-width": 1.4 },
  });
  map.addSource("a5-overlay", { type: "geojson", data: overlayLineGeoJSON(empty.features.reduce((acc, feature) => {
    acc[String(feature.properties.id) as A3BridgeId] = "no-live-data";
    return acc;
  }, {} as Record<A3BridgeId, A3Paint>)) });
  map.addLayer({
    id: "a5-overlay-unknown",
    type: "line",
    source: "a5-overlay",
    filter: ["==", ["get", "paint"], "no-live-data"],
    paint: {
      "line-color": "#94a3b8",
      "line-width": 3.4,
      "line-dasharray": [1.4, 1.4],
      "line-opacity": 0.9,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a5-overlay-closed",
    type: "line",
    source: "a5-overlay",
    filter: ["==", ["get", "paint"], "closed"],
    paint: { "line-color": "#fb7185", "line-width": 7, "line-opacity": 0.96 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a5-route", { type: "geojson", data: routeLineGeoJSON([]) });
  map.addLayer({
    id: "a5-route-case",
    type: "line",
    source: "a5-route",
    paint: { "line-color": "#083344", "line-width": 11, "line-opacity": 0.7 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a5-route-halo",
    type: "line",
    source: "a5-route",
    paint: { "line-color": "#22d3ee", "line-width": 7.5, "line-opacity": 0.85 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a5-route",
    type: "line",
    source: "a5-route",
    paint: { "line-color": "#4ade80", "line-width": 4.4, "line-opacity": 0.98 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function watchA5Size(map: maplibregl.Map, paddingOf: () => maplibregl.PaddingOptions) {
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
    const top = Math.max(52, padding.top ?? 0);
    const bottom = Math.max(72, padding.bottom ?? 0);
    const left = Math.max(10, padding.left ?? 0);
    const right = Math.max(10, padding.right ?? 0);
    const pitch = phone ? 16 : 24;
    if (top + bottom > 0.55 * box.height) {
      map.jumpTo({
        center: a5Center(),
        zoom: phone ? 12.95 : 13.55,
        bearing: A3_BEARING,
        pitch,
      });
      return;
    }
    map.fitBounds(a5FitBounds(), {
      padding: { top, bottom, left, right },
      bearing: A3_BEARING,
      pitch,
      maxZoom: phone ? 13.7 : 14.35,
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

function FallbackSvg({
  paints,
  route,
  overlays,
  pick,
  onPickBridge,
  onPickLock,
}: {
  paints: Record<A3BridgeId, A3Paint>;
  route: LngLat[];
  overlays: ReturnType<typeof overlayLineGeoJSON>;
  pick: PickKind;
  onPickBridge: (id: A3BridgeId) => void;
  onPickLock: (id: string) => void;
}) {
  const width = 390;
  const height = 844;
  const decks = decksWithPaint(paints);
  return (
    <div className="absolute inset-0 z-[1] bg-[#071018]" data-testid="a5-span-fallback" aria-label="Noordzeesluizen A5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img">
        <rect width={width} height={height} fill="#071018" />
        {A3_CHAMBERS.features.map((chamber) => (
          <polygon
            key={String(chamber.properties.id)}
            points={ringPoints(chamber.geometry.coordinates[0], width, height)}
            fill="#22d3ee"
            fillOpacity="0.34"
            stroke="#a5f3fc"
            strokeWidth="2"
            onClick={() => onPickLock(String(chamber.properties.lockId ?? chamber.properties.id))}
            style={{ cursor: "pointer" }}
          />
        ))}
        {decks.features.map((deck) => (
          <polygon
            key={String(deck.properties.id)}
            points={ringPoints(deck.geometry.coordinates[0], width, height)}
            fill={A5_FILL[(deck.properties.paint as A3Paint) ?? "no-live-data"]}
            fillOpacity="0.92"
            stroke="#020617"
            strokeWidth="1.4"
            onClick={() => onPickBridge(String(deck.properties.id) as A3BridgeId)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {overlays.features.map((line) => {
          const pts = line.geometry.coordinates
            .map(([lng, lat]) => {
              const p = project(lng, lat, width, height);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ");
          const closed = line.properties.paint === "closed";
          return (
            <polyline
              key={line.properties.id}
              points={pts}
              fill="none"
              stroke={closed ? "#fb7185" : "#64748b"}
              strokeWidth={closed ? 6 : 3.5}
              strokeLinecap="round"
              strokeDasharray={closed ? undefined : "6 5"}
            />
          );
        })}
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
            opacity="0.94"
          />
        ) : null}
        {lockLabelPoints().map((lock) => {
          const p = project(lock.lng, lock.lat, width, height);
          const selected = pick?.kind === "lock" && pick.id === lock.id;
          const name = LOCK_LABEL[lock.id] ?? lock.full.toUpperCase();
          const x = lock.offset === "left" ? p.x - 14 : lock.offset === "right" ? p.x + 14 : p.x;
          const anchor = lock.offset === "left" ? "end" : lock.offset === "right" ? "start" : "middle";
          return (
            <text
              key={lock.id}
              x={x}
              y={p.y + 4}
              textAnchor={anchor}
              fill={selected ? "#fde68a" : "#f8fafc"}
              fontSize="11"
              fontWeight="700"
              letterSpacing="1.4"
              fontFamily="ui-sans-serif, system-ui"
              onClick={() => onPickLock(lock.id)}
              style={{ cursor: "pointer" }}
            >
              {name}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function DraftA5Map({
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
  const liveRoute = useMemo(() => recommendA3Route(live), [live]);
  const [overrides, setOverrides] = useState<SimOverrides>({});
  const [debug, setDebug] = useState(false);
  const [simOpen, setSimOpen] = useState(true);
  const route = useMemo(() => resolveA5Route(live, overrides), [live, overrides]);
  const overlays = useMemo(() => overlayLineGeoJSON(route.paints), [route.paints]);
  const clock = formatTime(now);
  const container = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<(next: PickKind) => void>(() => undefined);
  const padRef = useRef({ top: 72, bottom: 92, left: 12, right: 12 });
  const refitRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [pick, setPick] = useState<PickKind>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chromePad, setChromePad] = useState(padRef.current);
  pickRef.current = setPick;
  padRef.current = chromePad;

  useEffect(() => {
    const parsed = parseSimSearch(window.location.search);
    setDebug(parsed.debug);
    setOverrides(parsed.overrides);
    setSimOpen(true);
  }, []);

  useEffect(() => {
    if (!debug) return;
    const next = simSearchString(true, overrides);
    const url = `${window.location.pathname}${next}`;
    window.history.replaceState(null, "", url);
  }, [debug, overrides]);

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const phone = window.matchMedia("(max-width: 640px)").matches;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: A5_STYLE,
        center: a5Center(),
        zoom: phone ? 12.95 : 13.55,
        minZoom: 12.2,
        bearing: A3_BEARING,
        pitch: a5Pitch(),
        maxPitch: 45,
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
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: true }), "top-right");
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
    const watch = watchA5Size(map, () => padRef.current);
    refitRef.current = watch.refit;
    map.on("load", () => {
      window.clearTimeout(timeout);
      paintStatic(map);
      watch.refit();
      setReady(true);
    });
    map.on("click", (event) => {
      if (map.getLayer("a5-decks-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a5-decks-fill", "a5-decks-ex"] });
        const id = hits[0]?.properties?.id;
        if (id) {
          pickRef.current({ kind: "bridge", id: String(id) as A3BridgeId });
          setInfoOpen(false);
          return;
        }
      }
      if (map.getLayer("a5-chambers-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a5-chambers-fill", "a5-chambers-ex"] });
        const lockId = hits[0]?.properties?.lockId ?? hits[0]?.properties?.id;
        if (lockId) {
          pickRef.current({ kind: "lock", id: String(lockId) });
          setInfoOpen(false);
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
    const decks = map.getSource("a5-decks") as maplibregl.GeoJSONSource | undefined;
    decks?.setData(decksWithPaint(route.paints));
    const overlay = map.getSource("a5-overlay") as maplibregl.GeoJSONSource | undefined;
    overlay?.setData(overlays);
    const line = map.getSource("a5-route") as maplibregl.GeoJSONSource | undefined;
    line?.setData(routeLineGeoJSON(route.advice.showRoute ? route.coordinates : []));
  }, [route, overlays, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((marker) => marker.remove());
    const next: maplibregl.Marker[] = [];
    for (const lock of lockLabelPoints()) {
      const selected = pick?.kind === "lock" && pick.id === lock.id;
      const name = LOCK_LABEL[lock.id] ?? lock.full.toUpperCase();
      const shift =
        lock.offset === "left"
          ? "translate(-112%, -50%)"
          : lock.offset === "right"
            ? "translate(12%, -50%)"
            : lock.offset === "top"
              ? "translate(-50%, -130%)"
              : "translate(-50%, 30%)";
      const ring = selected ? "#fde68a" : "rgba(248,250,252,0.22)";
      next.push(
        new maplibregl.Marker({
          element: makeHtmlLabel({
            html: `<span style="transform:${shift};display:inline-block;padding:5px 8px;border-radius:6px;background:#020617e6;color:#f8fafc;border:1px solid ${ring};font:700 11px/1.1 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.16em;white-space:nowrap;text-shadow:0 1px 2px #000">${name}</span>`,
            onClick: () => setPick({ kind: "lock", id: lock.id }),
          }),
          anchor: "center",
        }).setLngLat([lock.lng, lock.lat]).addTo(map),
      );
    }
    for (const bridge of bridgePoints()) {
      const paint = route.paints[bridge.id];
      const stale = route.staleIds.includes(bridge.id);
      const selected = pick?.kind === "bridge" && pick.id === bridge.id;
      const status = stale ? "Verouderd" : A3_PAINT_LABEL[paint];
      const color = stale ? "#fbbf24" : A5_FILL[paint];
      const compass = compassOf(bridge.id);
      const lockName = bridge.id.startsWith("west") ? "WESTSLUIS" : bridge.id.startsWith("nieuwe") ? "NIEUWE SLUIS" : "OOSTSLUIS";
      const dy = compass === "Noord" ? "-128%" : "28%";
      next.push(
        new maplibregl.Marker({
          element: makeHtmlLabel({
            html: `<span style="transform:translate(-50%, ${dy});display:block;min-width:108px;padding:5px 8px;border-radius:8px;background:#020617f0;color:#f8fafc;border:1px solid ${selected ? "#fde68a" : "rgba(248,250,252,0.16)"};box-shadow:0 8px 20px #0008;text-align:left"><span style="display:block;font:700 10px/1.1 ui-sans-serif,system-ui;letter-spacing:0.12em">${lockName}</span><span style="display:flex;align-items:center;gap:6px;margin-top:3px;font:600 11px/1.2 ui-sans-serif,system-ui"><span style="width:7px;height:7px;border-radius:99px;background:${color};box-shadow:0 0 8px ${color}"></span>${compass} · ${status}</span></span>`,
            onClick: () => setPick({ kind: "bridge", id: bridge.id }),
            z: 3,
          }),
          anchor: "center",
        }).setLngLat([bridge.lng, bridge.lat]).addTo(map),
      );
    }
    for (const label of contextLabelPoints()) {
      next.push(
        new maplibregl.Marker({
          element: makeHtmlLabel({
            html: `<span style="transform:translate(-50%,-50%);display:block;color:#cbd5e1;text-shadow:0 1px 4px #020617;font:700 10px/1.15 ui-sans-serif,system-ui;letter-spacing:0.14em;text-align:center;white-space:nowrap;opacity:0.9">${label.title}${label.detail ? `<span style="display:block;margin-top:2px;font:500 9px/1.1 ui-sans-serif,system-ui;letter-spacing:0.02em;color:#94a3b8">${label.detail}</span>` : ""}</span>`,
            z: 1,
          }),
          anchor: "center",
        }).setLngLat([label.lng, label.lat]).addTo(map),
      );
    }
    markers.current = next;
  }, [pick, ready, route.paints, route.staleIds]);

  useEffect(() => {
    const header = hudRef.current;
    const card = cardRef.current;
    const sync = () => {
      const phone = window.innerWidth < 640;
      const top = header?.getBoundingClientRect().height ?? (phone ? 64 : 72);
      const bottom = card?.getBoundingClientRect().height ?? (phone ? 88 : 80);
      const next = {
        top: Math.ceil(top + 6),
        bottom: Math.ceil(bottom + 8),
        left: phone ? 8 : 40,
        right: phone ? 8 : 40,
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
  }, [route.advice.title, pick, infoOpen, debug, simOpen, route.simulated]);

  const banner =
    route.advice.tone === "closed"
      ? "border-red-400/80 bg-red-950/92 text-red-50"
      : route.advice.tone === "open"
        ? "border-emerald-400/70 bg-emerald-950/90 text-emerald-50"
        : "border-white/20 bg-slate-950/92 text-slate-100";

  const cardBody = cardCopy(pick, route.paints, route.advice, debug, route.simulated, route.staleIds);

  const setSim = (id: A3BridgeId, value: SimPaint | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (!value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const flyHome = () => refitRef.current();
  const flyMe = () => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 14.2,
        duration: 800,
      });
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#071018] text-slate-100">
      <div ref={container} className="absolute inset-0 h-full w-full" data-testid="a5-map" />
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
            overlays={overlays}
            pick={pick}
            onPickBridge={(id) => setPick({ kind: "bridge", id })}
            onPickLock={(id) => setPick({ kind: "lock", id })}
          />
        </div>
      )}
      <header ref={hudRef} className="pointer-events-none absolute inset-x-0 top-0 z-20" data-testid="a5-top-hud">
        {debug ? (
          <div className="pointer-events-auto mx-auto w-full max-w-xl px-2 pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-4" data-testid="a5-sim-banner">
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400/70 bg-amber-950/95 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-50">
              <span>SIMULATION MODE</span>
              <span className="font-normal text-amber-100/80">client-only · schrijft geen DATEX</span>
            </div>
          </div>
        ) : null}
        <div className="pointer-events-auto mx-auto flex w-full max-w-xl items-start justify-between gap-2 px-2 pt-[max(0.35rem,env(safe-area-inset-top))] sm:px-4 sm:pt-3">
          <div className="flex min-w-0 items-start">
            <Link
              href="/terneuzen"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-slate-300 hover:text-cyan-200"
              aria-label="Terug naar IsoMap"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0 pt-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">Noordzeesluizen</p>
              <h1 className="truncate font-serif text-[22px] leading-none text-slate-50 sm:text-2xl">Terneuzen</h1>
              <p className="mt-1 text-[11px] text-slate-300">Veilig en voorbereid onderweg</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pt-1">
            {debug ? <ConceptChip letter="A5" /> : null}
            <p
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/45 bg-slate-950/80 px-2.5 py-1 font-mono text-[10px] tracking-wide text-emerald-100"
              data-testid="a5-live"
            >
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_#6ee7b7] motion-safe:animate-pulse" aria-hidden />
              LIVE <span data-testid="a5-live-clock">{clock}</span>
            </p>
            <button
              type="button"
              onClick={() => setInfoOpen((open) => !open)}
              className="inline-flex size-11 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"
              aria-expanded={infoOpen}
              aria-controls="a5-info-panel"
              aria-label="Legenda en bron"
              data-testid="a5-info"
            >
              <Info className="size-4" />
            </button>
          </div>
        </div>
        {infoOpen ? (
          <div id="a5-info-panel" className="pointer-events-auto mx-auto mt-1 w-full max-w-xl px-2 sm:px-4" data-testid="a5-info-panel">
            <div className="rounded-lg border border-white/15 bg-slate-950/92 px-3 py-2 text-[12px] leading-4 text-slate-200 backdrop-blur-md">
              <ul className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-slate-100">
                {(["open", "closed", "no-live-data"] as A3Paint[]).map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full ring-1 ring-black/20" style={{ background: A5_FILL[item] }} aria-hidden />
                    {A3_PAINT_LABEL[item]}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-slate-300" title={catalog.status.disclaimer}>
                Dekkleur = oversteek. Groene NWB-route alleen over OPEN dekken. Geen live NDW = grijs, geen omweg. Op afroep. {catalog.status.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
        {debug && simOpen ? (
          <div className="pointer-events-auto mx-auto mt-1 w-full max-w-xl px-2 sm:px-4" data-testid="a5-sim-panel">
            <div className="rounded-lg border border-amber-400/40 bg-slate-950/95 p-2 text-[11px] text-amber-50 backdrop-blur-md">
              <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className="rounded-md border border-amber-300/50 bg-amber-900/70 px-2 py-1 font-semibold"
                  onClick={() => setOverrides({ ...SCENARIO_B })}
                >
                  Scenario B · Nieuwe OPEN
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/20 px-2 py-1"
                  onClick={() => setOverrides({})}
                >
                  Reset live
                </button>
                <button type="button" className="ml-auto rounded-md px-2 py-1 text-slate-300" onClick={() => setSimOpen(false)}>
                  Verberg
                </button>
              </div>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {(Object.keys(A5_BRIDGE_LABEL) as A3BridgeId[]).map((id) => {
                  const current = overrides[id] ?? null;
                  const livePaint = liveRoute.paints[id];
                  return (
                    <li key={id} className="flex items-center justify-between gap-2 rounded-md bg-black/30 px-2 py-1">
                      <span className="font-semibold tracking-wide">
                        {A5_BRIDGE_LABEL[id]}
                        <span className="ml-1 font-normal text-slate-400">live {A3_PAINT_LABEL[livePaint]}</span>
                      </span>
                      <span className="flex gap-0.5">
                        {SIM_PAINTS.map((value) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setSim(id, current === value ? null : value)}
                            className={cn(
                              "rounded px-1 py-0.5 text-[9px] font-bold",
                              current === value ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-200",
                            )}
                          >
                            {SIM_PAINT_LABEL[value]}
                          </button>
                        ))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        ) : debug ? (
          <div className="pointer-events-auto mx-auto mt-1 w-full max-w-xl px-2 sm:px-4">
            <button
              type="button"
              className="rounded-md border border-amber-400/40 bg-slate-950/90 px-2 py-1 text-[11px] text-amber-100"
              onClick={() => setSimOpen(true)}
            >
              Toon simulatie
            </button>
          </div>
        ) : null}
      </header>
      <footer
        ref={cardRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-3"
        data-testid="a5-bottom-card"
      >
        <div className={cn("pointer-events-auto mx-auto w-full max-w-xl rounded-xl border px-3 py-2 backdrop-blur-md transition-colors duration-300", banner)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-current/80">
                {route.advice.tone === "closed" ? "Geen bevestigde route" : route.advice.tone === "open" ? "Route" : "Geen live data"}
              </p>
              <p className="text-[13px] font-semibold leading-tight sm:text-sm">{cardBody.title}</p>
              <p className="mt-0.5 text-[11px] leading-4 text-current/90">{cardBody.detail}</p>
              {cardBody.isrs ? (
                <p className="mt-0.5 font-mono text-[10px] text-current/70">{cardBody.isrs}</p>
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
            ) : (
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className="shrink-0 self-center text-[11px] font-semibold underline-offset-2 hover:underline"
              >
                Details
              </button>
            )}
          </div>
        </div>
        <div className="pointer-events-auto mx-auto mt-1.5 grid w-full max-w-xl grid-cols-3 gap-1 text-[10px] font-medium text-slate-200">
          <button type="button" onClick={flyMe} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-slate-950/70">
            <LocateFixed className="size-3.5" /> Mijn locatie
          </button>
          <button type="button" onClick={flyHome} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-slate-950/70">
            <Map className="size-3.5" /> Volledige kaart
          </button>
          <button type="button" onClick={() => setInfoOpen(true)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-slate-950/70">
            <Route className="size-3.5" /> Route opties
          </button>
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
  debug: boolean,
  simulated: boolean,
  staleIds: A3BridgeId[],
): { title: string; detail: string; isrs?: string } {
  if (pick?.kind === "bridge") {
    const copy = A3_BRIDGE_COPY[pick.id];
    const paint = paints[pick.id];
    const ndw = A3_NDW_ISRS[pick.id as keyof typeof A3_NDW_ISRS];
    const stale = staleIds.includes(pick.id);
    return {
      title: `${copy.full} · ${stale ? "Verouderd" : A3_PAINT_LABEL[paint]}`,
      detail: ndw
        ? "Live NDW op dit dek. Status volgt de BGT-oversteek."
        : simulated
          ? "Geen live NDW. Simulatie mag OPEN zetten; productie nooit."
          : "Geen live NDW. Geen groene omweg.",
      isrs: debug && ndw ? ndw : undefined,
    };
  }
  if (pick?.kind === "lock") {
    const locks: Record<string, { title: string; detail: string }> = {
      westsluis: { title: "WESTSLUIS", detail: "Beide dekken zonder live NDW." },
      "nieuwe-sluis": { title: "NIEUWE SLUIS", detail: "RWS 5-hoek kolk. Beide dekken zonder live NDW." },
      oostsluis: { title: "OOSTSLUIS", detail: "Live NDW op binnen- en buitenhoofd." },
    };
    return locks[pick.id] ?? { title: pick.id, detail: "Sluis." };
  }
  if (advice.tone === "open") {
    return {
      title: advice.title,
      detail: simulated
        ? "Simulatie: groene NWB-centerline alleen over OPEN dekken."
        : advice.caution
          ? "Via Oostsluis. NDW verwacht een opening."
          : "Via Oostsluis, live bevestigd.",
    };
  }
  if (advice.tone === "closed") {
    return {
      title: advice.title.includes("dicht") ? advice.detail.split(".")[0] + "." : advice.title,
      detail: simulated
        ? "Rood = dicht dek. Geen groene route over grijs of dicht."
        : "Rood op het dichte dek. Voor de andere routes is geen actuele live status beschikbaar.",
    };
  }
  return {
    title: advice.title,
    detail: "Grijs dek: geen live data. We raden geen route aan.",
  };
}
