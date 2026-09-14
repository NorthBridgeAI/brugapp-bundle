"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { ArrowLeft, Info, LocateFixed, Map, Route, X } from "lucide-react";
import {
  A3_BRIDGE_COPY,
  A3_CHAMBERS,
  A3_DECKS,
  A3_LOCKS,
  A3_ROADS,
  A3_ROUNDABOUTS,
  A3_WATER,
  A3_BEARING,
  a3FitBounds,
  a3MaxBounds,
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
  A6_BRIDGE_LABEL,
  A6_FILL,
  A6_TOKEN,
  SCENARIO_ALL_OPEN,
  SCENARIO_OOST_Z,
  SCENARIO_UNKNOWN,
  SIM_PAINTS,
  SIM_PAINT_LABEL,
  closedDeckCopy,
  lockEmphasis,
  parseA6SimSearch,
  recommendedViaLabel,
  resolveA6Route,
  simSearchString,
  type SimOverrides,
  type SimPaint,
} from "@/lib/a6-sim";
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

/** Pixel-free geographic nudges so WEST / NIEUWE never collide. Geometry itself is unchanged. */
const A6_LOCK_LAYOUT: Record<string, { lng: number; lat: number; transform: string }> = {
  westsluis: { lng: -0.00072, lat: 0.00028, transform: "translate(-100%, -40%)" },
  "nieuwe-sluis": { lng: 0.00008, lat: -0.00112, transform: "translate(-50%, 8%)" },
  oostsluis: { lng: 0.0007, lat: 0.00018, transform: "translate(4%, -50%)" },
};

const A6_STYLE: StyleSpecification = {
  ...DARK_RASTER_STYLE,
  name: "brugapp-a6",
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#071018" } },
    {
      id: "base",
      type: "raster",
      source: "base",
      paint: {
        "raster-opacity": 0.28,
        "raster-saturation": -0.7,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.38,
        "raster-contrast": -0.12,
      },
    },
  ],
};

function a6FitBounds(): [[number, number], [number, number]] {
  const [[west, south], [east, north]] = a3FitBounds();
  const extra = 0.00135;
  return [
    [west, south - extra],
    [east, north + extra],
  ];
}

function a6Center(): LngLat {
  const [[west, south], [east, north]] = a6FitBounds();
  return [(west + east) / 2, (south + north) / 2];
}

function a6Pitch(): number {
  if (typeof window === "undefined") return 16;
  return window.matchMedia("(max-width: 640px)").matches ? 16 : 24;
}

function unionFitBounds(route: LngLat[]): [[number, number], [number, number]] {
  const [[west0, south0], [east0, north0]] = a6FitBounds();
  let west = west0;
  let south = south0;
  let east = east0;
  let north = north0;
  for (const [lng, lat] of route) {
    west = Math.min(west, lng);
    east = Math.max(east, lng);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [
    [west, south],
    [east, north],
  ];
}

function project(lng: number, lat: number, width: number, height: number): { x: number; y: number } {
  const [[west, south], [east, north]] = a6FitBounds();
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
  if (map.getSource("a6-water")) return;
  map.addSource("a6-water", { type: "geojson", data: A3_WATER });
  map.addLayer({
    id: "a6-water",
    type: "fill",
    source: "a6-water",
    paint: { "fill-color": A6_TOKEN.water, "fill-opacity": 0.88 },
  });
  map.addLayer({
    id: "a6-water-line",
    type: "line",
    source: "a6-water",
    paint: { "line-color": A6_TOKEN.waterLine, "line-width": 0.6, "line-opacity": 0.45 },
  });
  map.addSource("a6-quay", { type: "geojson", data: A3_LOCKS });
  map.addLayer({
    id: "a6-quay",
    type: "fill",
    source: "a6-quay",
    paint: { "fill-color": A6_TOKEN.quay, "fill-opacity": 0.42 },
  });
  map.addLayer({
    id: "a6-quay-line",
    type: "line",
    source: "a6-quay",
    paint: { "line-color": "#334155", "line-width": 1.1, "line-opacity": 0.7 },
  });
  map.addSource("a6-roads", { type: "geojson", data: A3_ROADS });
  map.addLayer({
    id: "a6-roads-case",
    type: "line",
    source: "a6-roads",
    paint: {
      "line-color": "#020617",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 3.2, 15, 6.4],
      "line-opacity": 0.55,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-roads",
    type: "line",
    source: "a6-roads",
    filter: ["!=", ["get", "sttNaam"], "Buitenhaven"],
    paint: {
      "line-color": A6_TOKEN.roadNormal,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.35, 15, 2.6],
      "line-opacity": 0.62,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-roads-important",
    type: "line",
    source: "a6-roads",
    filter: ["==", ["get", "sttNaam"], "Buitenhaven"],
    paint: {
      "line-color": A6_TOKEN.roadImportant,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 1.7, 15, 3.3],
      "line-opacity": 0.78,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a6-roundabouts", { type: "geojson", data: A3_ROUNDABOUTS });
  map.addLayer({
    id: "a6-roundabouts-case",
    type: "line",
    source: "a6-roundabouts",
    paint: { "line-color": "#020617", "line-width": 4.4, "line-opacity": 0.5 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-roundabouts",
    type: "line",
    source: "a6-roundabouts",
    paint: { "line-color": A6_TOKEN.roadImportant, "line-width": 2.2, "line-opacity": 0.74 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a6-chambers", { type: "geojson", data: A3_CHAMBERS });
  map.addLayer({
    id: "a6-chambers-fill",
    type: "fill",
    source: "a6-chambers",
    paint: { "fill-color": A6_TOKEN.chamberInner, "fill-opacity": 0.92 },
  });
  map.addLayer({
    id: "a6-chambers-line",
    type: "line",
    source: "a6-chambers",
    paint: { "line-color": A6_TOKEN.chamberLine, "line-width": 2.4, "line-opacity": 0.9 },
  });
  const empty = decksWithPaint({
    "oostsluis-buitenhoofd": "no-live-data",
    "oostsluis-binnenhoofd": "no-live-data",
    "westsluis-noord": "no-live-data",
    "westsluis-zuid": "no-live-data",
    "nieuwe-sluis-buitenhoofd": "no-live-data",
    "nieuwe-sluis-binnenhoofd": "no-live-data",
  });
  map.addSource("a6-decks", { type: "geojson", data: empty });
  map.addLayer({
    id: "a6-decks-fill",
    type: "fill",
    source: "a6-decks",
    paint: {
      "fill-color": [
        "match",
        ["get", "paint"],
        "open",
        A6_FILL.open,
        "closed",
        A6_FILL.closed,
        A6_FILL["no-live-data"],
      ],
      "fill-opacity": ["match", ["get", "paint"], "closed", 0.96, "open", 0.72, 0.88],
    },
  });
  map.addLayer({
    id: "a6-decks-line",
    type: "line",
    source: "a6-decks",
    paint: {
      "line-color": ["match", ["get", "paint"], "closed", "#fecdd3", "#020617"],
      "line-width": ["match", ["get", "paint"], "closed", 2.2, 1.1],
    },
  });
  map.addLayer({
    id: "a6-decks-closed-glow",
    type: "line",
    source: "a6-decks",
    filter: ["==", ["get", "paint"], "closed"],
    paint: {
      "line-color": A6_TOKEN.closedGlow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 9, 15, 15],
      "line-opacity": 0.48,
      "line-blur": 2.2,
    },
  });
  map.addSource("a6-selected", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
  map.addLayer({
    id: "a6-selected",
    type: "line",
    source: "a6-selected",
    paint: {
      "line-color": A6_TOKEN.selected,
      "line-width": 3.4,
      "line-opacity": 0.95,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a6-overlay", {
    type: "geojson",
    data: overlayLineGeoJSON(
      empty.features.reduce(
        (acc, feature) => {
          acc[String(feature.properties.id) as A3BridgeId] = "no-live-data";
          return acc;
        },
        {} as Record<A3BridgeId, A3Paint>,
      ),
    ),
  });
  map.addLayer({
    id: "a6-overlay-closed-glow",
    type: "line",
    source: "a6-overlay",
    filter: ["==", ["get", "paint"], "closed"],
    paint: {
      "line-color": A6_TOKEN.closedGlow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 12, 15, 20],
      "line-opacity": 0.46,
      "line-blur": 2.4,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-overlay-closed",
    type: "line",
    source: "a6-overlay",
    filter: ["==", ["get", "paint"], "closed"],
    paint: {
      "line-color": A6_TOKEN.closedGlow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 8, 15, 11],
      "line-opacity": 0.98,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("a6-route", { type: "geojson", data: routeLineGeoJSON([]) });
  map.addLayer({
    id: "a6-route-glow",
    type: "line",
    source: "a6-route",
    paint: {
      "line-color": A6_TOKEN.routeGlow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 14, 15, 22],
      "line-opacity": 0.42,
      "line-blur": 2.2,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-route-case",
    type: "line",
    source: "a6-route",
    paint: {
      "line-color": "#042f2e",
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 9.5, 15, 14.5],
      "line-opacity": 0.82,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-route-halo",
    type: "line",
    source: "a6-route",
    paint: {
      "line-color": A6_TOKEN.routeGlow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 7.2, 15, 11.5],
      "line-opacity": 0.72,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "a6-route",
    type: "line",
    source: "a6-route",
    paint: {
      "line-color": A6_TOKEN.route,
      "line-width": ["interpolate", ["linear"], ["zoom"], 12, 5.2, 15, 8],
      "line-opacity": 1,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

function watchA6Size(
  map: maplibregl.Map,
  paddingOf: () => maplibregl.PaddingOptions,
  routeOf: () => LngLat[],
) {
  let touched = false;
  const mark = () => {
    touched = true;
  };
  const canvas = map.getCanvas();
  canvas.addEventListener("pointerdown", mark, { passive: true });
  canvas.addEventListener("wheel", mark, { passive: true });
  canvas.addEventListener("touchstart", mark, { passive: true });

  const sync = (opts?: { duration?: number; ignoreTouch?: boolean }) => {
    const box = map.getContainer().getBoundingClientRect();
    if (box.width < 80 || box.height < 80) return;
    map.resize();
    if (opts?.ignoreTouch) touched = false;
    if (touched && !opts?.ignoreTouch) return;
    const phone = box.width < 640;
    const padding = paddingOf();
    const route = routeOf();
    const hasRoute = route.length > 1;
    const top = Math.max(52, padding.top ?? 0);
    const bottom = Math.max(72, padding.bottom ?? 0);
    const left = Math.max(10, padding.left ?? 0);
    const right = Math.max(10, padding.right ?? 0);
    const pitch = phone ? 16 : 24;
    if (top + bottom > 0.55 * box.height) {
      map.jumpTo({
        center: a6Center(),
        zoom: phone ? 12.95 : 13.55,
        bearing: A3_BEARING,
        pitch,
      });
      return;
    }
    map.fitBounds(unionFitBounds(route), {
      padding: { top, bottom, left, right },
      bearing: A3_BEARING,
      pitch,
      maxZoom: hasRoute ? (phone ? 13.35 : 13.95) : phone ? 13.7 : 14.35,
      duration: opts?.duration ?? 0,
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
    frameRoute: () => sync({ duration: 700, ignoreTouch: true }),
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
  via,
  overlays,
  pick,
  onPickBridge,
  onPickLock,
}: {
  paints: Record<A3BridgeId, A3Paint>;
  route: LngLat[];
  via: readonly A3BridgeId[];
  overlays: ReturnType<typeof overlayLineGeoJSON>;
  pick: PickKind;
  onPickBridge: (id: A3BridgeId) => void;
  onPickLock: (id: string) => void;
}) {
  const width = 390;
  const height = 844;
  const decks = decksWithPaint(paints);
  return (
    <div className="absolute inset-0 z-[1] bg-[#071018]" data-testid="a6-span-fallback" aria-label="Noordzeesluizen A6">
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
            fill={A6_FILL[(deck.properties.paint as A3Paint) ?? "no-live-data"]}
            fillOpacity="0.92"
            stroke="#020617"
            strokeWidth="1.4"
            onClick={() => onPickBridge(String(deck.properties.id) as A3BridgeId)}
            style={{ cursor: "pointer" }}
          />
        ))}
        {overlays.features
          .filter((line) => line.properties.paint === "closed")
          .map((line) => {
          const pts = line.geometry.coordinates
            .map(([lng, lat]) => {
              const p = project(lng, lat, width, height);
              return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <g key={line.properties.id}>
              <polyline
                points={pts}
                fill="none"
                stroke={A6_TOKEN.closedGlow}
                strokeWidth={14}
                strokeLinecap="round"
                opacity="0.38"
              />
              <polyline
                points={pts}
                fill="none"
                stroke={A6_TOKEN.closedGlow}
                strokeWidth={8}
                strokeLinecap="round"
              />
            </g>
          );
        })}
        {route.length > 1 ? (
          <>
            <polyline
              points={route
                .map(([lng, lat]) => {
                  const p = project(lng, lat, width, height);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ")}
              fill="none"
              stroke={A6_TOKEN.routeGlow}
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.38"
            />
            <polyline
              points={route
                .map(([lng, lat]) => {
                  const p = project(lng, lat, width, height);
                  return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
                })
                .join(" ")}
              fill="none"
              stroke={A6_TOKEN.route}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="1"
            />
          </>
        ) : null}
        {lockLabelPoints().map((lock) => {
          const layout = A6_LOCK_LAYOUT[lock.id] ?? { lng: 0, lat: 0, transform: "translate(-50%, -50%)" };
          const p = project(lock.lng + layout.lng, lock.lat + layout.lat, width, height);
          const selected = pick?.kind === "lock" && pick.id === lock.id;
          const name = LOCK_LABEL[lock.id] ?? lock.full.toUpperCase();
          const anchor = lock.id === "westsluis" ? "end" : lock.id === "oostsluis" ? "start" : "middle";
          const emphasis = lockEmphasis(lock.id, via, paints, route.length > 1);
          const problem =
            emphasis === "pop" &&
            Object.entries(paints).some(([id, paint]) => {
              if (paint !== "closed") return false;
              if (lock.id === "oostsluis") return id.startsWith("oost");
              if (lock.id === "westsluis") return id.startsWith("west");
              return id.startsWith("nieuwe");
            });
          return (
            <text
              key={lock.id}
              x={p.x}
              y={p.y + 4}
              textAnchor={anchor}
              fill={selected ? A6_TOKEN.selected : problem ? A6_TOKEN.closedGlow : emphasis === "pop" ? A6_TOKEN.route : "#f8fafc"}
              fontSize={emphasis === "pop" ? "12" : "11"}
              fontWeight={emphasis === "pop" ? "800" : "700"}
              letterSpacing="1.4"
              fontFamily="ui-sans-serif, system-ui"
              opacity={emphasis === "dim" ? 0.32 : 1}
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

export function DraftA6Map({
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
  const [simOpen, setSimOpen] = useState(false);
  const route = useMemo(() => resolveA6Route(live, overrides), [live, overrides]);
  const overlays = useMemo(() => overlayLineGeoJSON(route.paints), [route.paints]);
  const clock = formatTime(now);
  const freshness = live?.fetchedAt ? formatTime(new Date(live.fetchedAt)) : clock;
  const hasRoute = route.advice.showRoute;
  const container = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<(next: PickKind) => void>(() => undefined);
  const padRef = useRef({ top: 72, bottom: 92, left: 12, right: 12 });
  const refitRef = useRef<() => void>(() => undefined);
  const frameRouteRef = useRef<() => void>(() => undefined);
  const routeCoordsRef = useRef<LngLat[]>([]);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [pick, setPick] = useState<PickKind>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chromePad, setChromePad] = useState(padRef.current);
  pickRef.current = setPick;
  padRef.current = chromePad;
  routeCoordsRef.current = hasRoute ? route.coordinates : [];

  useEffect(() => {
    const parsed = parseA6SimSearch(window.location.search);
    setDebug(parsed.debug);
    setOverrides(parsed.overrides);
    setSimOpen(false);
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
        style: A6_STYLE,
        center: a6Center(),
        zoom: phone ? 12.95 : 13.55,
        minZoom: 12.2,
        bearing: A3_BEARING,
        pitch: a6Pitch(),
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
    const watch = watchA6Size(
      map,
      () => padRef.current,
      () => routeCoordsRef.current,
    );
    refitRef.current = watch.refit;
    frameRouteRef.current = watch.frameRoute;
    map.on("load", () => {
      window.clearTimeout(timeout);
      paintStatic(map);
      watch.refit();
      setReady(true);
    });
    map.on("click", (event) => {
      if (map.getLayer("a6-decks-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a6-decks-fill"] });
        const id = hits[0]?.properties?.id;
        if (id) {
          pickRef.current({ kind: "bridge", id: String(id) as A3BridgeId });
          setInfoOpen(false);
          return;
        }
      }
      if (map.getLayer("a6-chambers-fill")) {
        const hits = map.queryRenderedFeatures(event.point, { layers: ["a6-chambers-fill"] });
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
    const decks = map.getSource("a6-decks") as maplibregl.GeoJSONSource | undefined;
    decks?.setData(decksWithPaint(route.paints));
    const overlay = map.getSource("a6-overlay") as maplibregl.GeoJSONSource | undefined;
    overlay?.setData(overlays);
    const line = map.getSource("a6-route") as maplibregl.GeoJSONSource | undefined;
    line?.setData(routeLineGeoJSON(route.advice.showRoute ? route.coordinates : []));
    const selected = map.getSource("a6-selected") as maplibregl.GeoJSONSource | undefined;
    if (pick?.kind === "bridge") {
      const feature = A3_DECKS.features.find((item) => String(item.properties.id) === pick.id);
      selected?.setData({
        type: "FeatureCollection",
        features: feature ? [feature] : [],
      });
    } else if (pick?.kind === "lock") {
      const feature = A3_CHAMBERS.features.find(
        (item) => String(item.properties.lockId ?? item.properties.id) === pick.id,
      );
      selected?.setData({
        type: "FeatureCollection",
        features: feature ? [feature] : [],
      });
    } else {
      selected?.setData({ type: "FeatureCollection", features: [] });
    }
  }, [route, overlays, ready, pick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markers.current.forEach((marker) => marker.remove());
    const next: maplibregl.Marker[] = [];
    for (const lock of lockLabelPoints()) {
      const selected = pick?.kind === "lock" && pick.id === lock.id;
      const name = LOCK_LABEL[lock.id] ?? lock.full.toUpperCase();
      const layout = A6_LOCK_LAYOUT[lock.id] ?? { lng: 0, lat: 0, transform: "translate(-50%, -50%)" };
      const emphasis = lockEmphasis(lock.id, route.via, route.paints, hasRoute);
      const problem =
        emphasis === "pop" &&
        Object.entries(route.paints).some(([id, paint]) => {
          if (paint !== "closed") return false;
          if (lock.id === "oostsluis") return id.startsWith("oost");
          if (lock.id === "westsluis") return id.startsWith("west");
          return id.startsWith("nieuwe");
        });
      const ring = selected
        ? A6_TOKEN.selected
        : problem
          ? A6_TOKEN.closedGlow
          : emphasis === "pop"
            ? A6_TOKEN.route
            : "rgba(248,250,252,0.22)";
      const opacity = emphasis === "dim" ? "0.32" : "1";
      const weight = emphasis === "pop" ? "800" : "700";
      next.push(
        new maplibregl.Marker({
          element: makeHtmlLabel({
            html: `<span style="transform:${layout.transform};display:inline-block;padding:4px 8px;border-radius:6px;background:#020617cc;color:${problem ? A6_TOKEN.closedGlow : "#f8fafc"};border:1px solid ${ring};font:${weight} 11px/1.05 ui-sans-serif,system-ui,sans-serif;letter-spacing:0.14em;white-space:nowrap;text-shadow:0 1px 2px #000;opacity:${opacity}">${name}</span>`,
            onClick: () => setPick({ kind: "lock", id: lock.id }),
            z: emphasis === "pop" ? 6 : 4,
          }),
          anchor: "center",
        })
          .setLngLat([lock.lng + layout.lng, lock.lat + layout.lat])
          .addTo(map),
      );
    }
    markers.current = next;
  }, [pick, ready, route.via, route.paints, hasRoute]);

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
  }, [route.advice.title, pick, infoOpen, debug, simOpen, route.simulated, hasRoute]);

  const banner =
    route.advice.tone === "closed"
      ? "border-red-400/80 bg-red-950/92 text-red-50"
      : route.advice.tone === "open"
        ? "border-emerald-400/70 bg-emerald-950/90 text-emerald-50"
        : "border-white/20 bg-slate-950/92 text-slate-100";

  const cardBody = cardCopy(pick, route.paints, route.advice, debug, route.simulated, route.staleIds, route.via);

  const setSim = (id: A3BridgeId, value: SimPaint | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (!value) delete next[id];
      else next[id] = value;
      return next;
    });
  };

  const flyHome = () => frameRouteRef.current();
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
      <div ref={container} className="absolute inset-0 h-full w-full" data-testid="a6-map" />
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
            via={route.via}
            overlays={overlays}
            pick={pick}
            onPickBridge={(id) => setPick({ kind: "bridge", id })}
            onPickLock={(id) => setPick({ kind: "lock", id })}
          />
        </div>
      )}
      <header ref={hudRef} className="pointer-events-none absolute inset-x-0 top-0 z-20" data-testid="a6-top-hud">
        {debug ? (
          <div className="pointer-events-auto mx-auto w-full max-w-xl px-2 pt-[max(0.3rem,env(safe-area-inset-top))] sm:px-4" data-testid="a6-sim-banner">
            <div className="flex items-center justify-between gap-2 rounded-md border border-amber-400/70 bg-amber-950/95 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-50">
              <span>SIMULATION MODE</span>
              <span className="truncate font-normal text-amber-100/80">alleen deze pagina</span>
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            "pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between gap-2 px-2 sm:px-4",
            debug ? "pt-1" : "pt-[max(0.35rem,env(safe-area-inset-top))] sm:pt-3",
          )}
        >
          <div className="flex min-w-0 items-center">
            <Link
              href="/terneuzen"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-slate-300 hover:text-cyan-200"
              aria-label="Terug naar IsoMap"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Noordzeesluizen</p>
              <h1 className="whitespace-nowrap font-serif text-[20px] leading-none text-slate-50 sm:text-2xl">Terneuzen</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <p
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/45 bg-slate-950/80 px-2 py-1 font-mono text-[10px] tracking-wide text-emerald-100"
              data-testid="a6-live"
              title={live?.fetchedAt ?? undefined}
            >
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_#6ee7b7] motion-safe:animate-pulse" aria-hidden />
              LIVE <span data-testid="a6-live-clock">{freshness}</span>
            </p>
            <button
              type="button"
              onClick={() => setInfoOpen((open) => !open)}
              className="inline-flex size-10 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"
              aria-expanded={infoOpen}
              aria-controls="a6-info-panel"
              aria-label="Legenda en bron"
              data-testid="a6-info"
            >
              <Info className="size-4" />
            </button>
          </div>
        </div>
        {infoOpen ? (
          <div id="a6-info-panel" className="pointer-events-auto mx-auto mt-1 w-full max-w-xl px-2 sm:px-4" data-testid="a6-info-panel">
            <div className="rounded-lg border border-white/15 bg-slate-950/92 px-3 py-2 text-[12px] leading-4 text-slate-200 backdrop-blur-md">
              <ul className="flex flex-wrap gap-x-3 gap-y-1 font-medium text-slate-100">
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: A6_TOKEN.route }} aria-hidden />
                  Aanbevolen route
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: A6_FILL.closed }} aria-hidden />
                  Dicht
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: A6_TOKEN.selected }} aria-hidden />
                  Geselecteerd
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: A6_FILL["no-live-data"] }} aria-hidden />
                  Geen live data
                </li>
              </ul>
              <p className="mt-1.5 text-slate-300" title={catalog.status.disclaimer}>
                Groen = aanbevolen route. Rood = dicht dek. Leigrijs = geen live data. Op afroep. {catalog.status.disclaimer}
              </p>
            </div>
          </div>
        ) : null}
        {debug ? (
          <div className="pointer-events-auto mx-auto mt-1 w-full max-w-xl px-2 sm:px-4" data-testid="a6-sim-panel">
            <div className="rounded-lg border border-amber-400/40 bg-slate-950/95 p-1.5 text-[11px] text-amber-50 backdrop-blur-md">
              <div className="flex flex-wrap items-center gap-1">
                <button type="button" className="rounded-md border border-white/20 px-2 py-1" onClick={() => setOverrides({ ...SCENARIO_UNKNOWN })}>
                  A onbekend
                </button>
                <button type="button" className="rounded-md border border-amber-300/50 bg-amber-900/70 px-2 py-1 font-semibold" onClick={() => setOverrides({ ...SCENARIO_OOST_Z })}>
                  B Oost-Z
                </button>
                <button type="button" className="rounded-md border border-white/20 px-2 py-1" onClick={() => setOverrides({ ...SCENARIO_ALL_OPEN })}>
                  C open
                </button>
                <button type="button" className="rounded-md border border-white/20 px-2 py-1" onClick={() => setOverrides({})}>
                  Reset
                </button>
                <button type="button" className="ml-auto rounded-md px-2 py-1 text-slate-300" onClick={() => setSimOpen((open) => !open)}>
                  {simOpen ? "Verberg dekken" : "Per dek"}
                </button>
              </div>
              {simOpen ? (
                <ul className="mt-1.5 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {(Object.keys(A6_BRIDGE_LABEL) as A3BridgeId[]).map((id) => {
                    const current = overrides[id] ?? null;
                    const livePaint = liveRoute.paints[id];
                    return (
                      <li key={id} className="flex items-center justify-between gap-2 rounded-md bg-black/30 px-2 py-1">
                        <span className="font-semibold tracking-wide">
                          {A6_BRIDGE_LABEL[id]}
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
              ) : null}
            </div>
          </div>
        ) : null}
      </header>
      <footer
        ref={cardRef}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(0.55rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-3"
        data-testid="a6-bottom-card"
      >
        <div className={cn("pointer-events-auto mx-auto w-full max-w-xl rounded-xl border px-3 py-2 backdrop-blur-md transition-colors duration-300", banner)}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-current/80">
                {cardBody.kicker}
              </p>
              <p className="text-[13px] font-semibold leading-tight sm:text-sm">{cardBody.title}</p>
              {cardBody.openBadge ? (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4ade80]">
                  <span className="inline-block size-2 rounded-full bg-[#4ade80] shadow-[0_0_8px_#4ade80]" aria-hidden />
                  OPEN
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] leading-4 text-current/90">{cardBody.detail}</p>
              )}
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
            ) : cardBody.frameRoute ? (
              <button
                type="button"
                onClick={() => frameRouteRef.current()}
                className="shrink-0 self-center rounded-md border border-current/25 bg-black/20 px-2.5 py-1.5 text-[11px] font-semibold"
              >
                Bekijk route
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
          <button
            type="button"
            onClick={() => {
              if (hasRoute) setInfoOpen(true);
            }}
            disabled={!hasRoute}
            aria-disabled={!hasRoute}
            className={cn(
              "inline-flex min-h-10 items-center justify-center gap-1 rounded-md bg-slate-950/70",
              !hasRoute && "cursor-not-allowed opacity-40",
            )}
          >
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
  _simulated: boolean,
  staleIds: A3BridgeId[],
  via: readonly A3BridgeId[],
): { kicker: string; title: string; detail: string; isrs?: string; openBadge?: boolean; frameRoute?: boolean } {
  if (pick?.kind === "bridge") {
    const copy = A3_BRIDGE_COPY[pick.id];
    const paint = paints[pick.id];
    const ndw = A3_NDW_ISRS[pick.id as keyof typeof A3_NDW_ISRS];
    const stale = staleIds.includes(pick.id);
    return {
      kicker: stale ? "Verouderd" : A3_PAINT_LABEL[paint],
      title: copy.full,
      detail: ndw
        ? "Live NDW op dit dek."
        : "Van dit dek is geen actuele live status beschikbaar.",
      isrs: debug && ndw ? ndw : undefined,
    };
  }
  if (pick?.kind === "lock") {
    const locks: Record<string, { title: string; detail: string }> = {
      westsluis: { title: "WESTSLUIS", detail: "Beide oversteekplaatsen zonder live status." },
      "nieuwe-sluis": { title: "NIEUWE SLUIS", detail: "Beide oversteekplaatsen zonder live status." },
      oostsluis: { title: "OOSTSLUIS", detail: "Live NDW op noord- en zuidhoofd." },
    };
    const hit = locks[pick.id] ?? { title: pick.id, detail: "Sluis." };
    return { kicker: "Sluis", ...hit };
  }
  if (advice.tone === "open" && advice.showRoute) {
    return {
      kicker: "Aanbevolen route",
      title: recommendedViaLabel(via),
      detail: "",
      openBadge: true,
      frameRoute: true,
    };
  }
  if (advice.tone === "closed") {
    return {
      kicker: "Geen bevestigde route",
      title: "GEEN BEVESTIGDE ROUTE",
      detail: `${closedDeckCopy(paints)} Voor de andere routes is geen actuele live status beschikbaar.`,
    };
  }
  return {
    kicker: "Geen live data",
    title: "GEEN LIVE DATA",
    detail:
      "De actuele status van de oversteekplaatsen is niet beschikbaar. We kunnen daarom geen route bevestigen.",
  };
}
