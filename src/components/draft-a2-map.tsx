"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  BackLink,
  ConceptChip,
  HudCorners,
  StatusLegend,
  StatusPanel,
  type MapPick,
} from "@/components/lock-hud";
import { makeFullNameMarker, makeStatusMarker } from "@/components/lock-markers";
import { addChamberLayers, lockMaxBounds } from "@/lib/lock-layers";
import {
  LOCK_CHAMBERS,
  LOCK_COPY,
  LOCK_FRAME,
  PIN_COPY,
  ROAD_TONE,
  chambersGeoJSON,
  corridorGeoJSON,
  complexFitBounds,
  liveSpanHits,
  routeAdvice,
  spansGeoJSON,
  type LockId,
  type MarkerOffset,
} from "@/lib/lock-map";
import { DARK_RASTER_STYLE } from "@/lib/map-styles";
import { watchComplexMapSize } from "@/lib/watch-lock-map";
import { useLiveSnapshot } from "@/hooks/use-live-snapshot";
import { useNow } from "@/hooks/use-now";
import { formatTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { Catalog, LiveCrossingHit, LiveSnapshot } from "@/lib/types";

const LABEL_SHIFT: Record<MarkerOffset, { x: number; y: number }> = {
  left: { x: -8, y: 0 },
  right: { x: 8, y: 0 },
  top: { x: 0, y: -10 },
  bottom: { x: 0, y: 10 },
};

function projectSpan(
  lng: number,
  lat: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const [[west, south], [east, north]] = complexFitBounds(true);
  const padX = width * 0.08;
  const padY = height * 0.05;
  return {
    x: padX + ((lng - west) / (east - west)) * (width - 2 * padX),
    y: padY + ((north - lat) / (north - south)) * (height - 2 * padY),
  };
}

function pointsAttr(
  coords: [number, number][],
  width: number,
  height: number,
): string {
  return coords
    .map(([lng, lat]) => {
      const point = projectSpan(lng, lat, width, height);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function SpanFallbackSvg({
  spans,
  pick,
  onPickSpan,
  onPickLock,
}: {
  spans: LiveCrossingHit[];
  pick: MapPick;
  onPickSpan: (id: string) => void;
  onPickLock: (id: string) => void;
}) {
  const width = 390;
  const height = 844;
  const geo = spansGeoJSON(spans);
  const corridor = corridorGeoJSON().features[0]?.geometry.coordinates ?? [];
  const chambers = chambersGeoJSON();
  return (
    <div
      className="absolute inset-0 z-[1] bg-[#1b2a3d]"
      data-testid="a2-span-fallback"
      aria-label="Buitenhaven-oversteken"
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
      >
        <rect width={width} height={height} fill="#1b2a3d" />
        <text x="28" y="36" fill="#67e8f9" fontSize="11" fontFamily="ui-sans-serif, system-ui" letterSpacing="1.6">
          Westerschelde ↑
        </text>
        <text x="28" y="828" fill="#94a3b8" fontSize="11" fontFamily="ui-sans-serif, system-ui" letterSpacing="1.6">
          kanaal ↓
        </text>
        <polyline
          points={pointsAttr(corridor as [number, number][], width, height)}
          fill="none"
          stroke="#64748b"
          strokeWidth="4"
          strokeDasharray="8 9"
          strokeLinecap="round"
          opacity="0.55"
        />
        {chambers.features.map((chamber) => {
          const ring = chamber.geometry.coordinates[0]
            .map(([lng, lat]) => {
              const point = projectSpan(lng, lat, width, height);
              return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
            })
            .join(" ");
          const selected = pick?.kind === "lock" && pick.id === chamber.properties.id;
          return (
            <polygon
              key={String(chamber.properties.id)}
              points={ring}
              fill={selected ? "#67e8f9" : "#22d3ee"}
              fillOpacity={0.35}
              stroke="#a5f3fc"
              strokeWidth="2"
            />
          );
        })}
        {geo.features.map((feature) => {
          const ndw = Number(feature.properties.hasNdw) > 0;
          const color = String(feature.properties.color);
          const pts = pointsAttr(feature.geometry.coordinates, width, height);
          return (
            <g key={String(feature.properties.id)}>
              <polyline
                points={pts}
                fill="none"
                stroke="#020617"
                strokeWidth={ndw ? 34 : 22}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pts}
                fill="none"
                stroke="#f8fafc"
                strokeWidth={ndw ? 24 : 15}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={ndw ? 16 : 9}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}
        {LOCK_CHAMBERS.map((chamber) => {
          const copy = LOCK_COPY[chamber.id as LockId];
          const offset = copy.offset;
          const point = projectSpan(chamber.coordinates.lng, chamber.coordinates.lat, width, height);
          const shift = LABEL_SHIFT[offset];
          const selected = pick?.kind === "lock" && pick.id === chamber.id;
          const anchor = offset === "left" ? "end" : offset === "right" ? "start" : "middle";
          return (
            <g
              key={chamber.id}
              transform={`translate(${point.x} ${point.y})`}
              onClick={() => onPickLock(chamber.id)}
              style={{ cursor: "pointer" }}
            >
              <circle r="22" fill={selected ? "#fde68a33" : "#22d3ee22"} />
              <circle r="8" fill="#cbd5e1" stroke="#020617" strokeWidth="2" />
              <text
                x={shift.x + (offset === "left" ? -18 : offset === "right" ? 18 : 0)}
                y={shift.y + (offset === "top" ? -18 : offset === "bottom" ? 28 : 4)}
                textAnchor={anchor}
                fill="#f8fafc"
                fontSize="13"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui"
              >
                {copy.full}
              </text>
            </g>
          );
        })}
        {spans.map((span) => {
          const copy = PIN_COPY[span.id];
          const tone = ROAD_TONE[span.hasNdw ? (span.road === "soon" ? "clear" : span.road) : "unknown"];
          const point = projectSpan(span.coordinates.lng, span.coordinates.lat, width, height);
          const offset = copy?.offset ?? "right";
          const shift = LABEL_SHIFT[offset];
          const selected =
            (pick?.kind === "span" || pick?.kind === "ndw") && pick.id === span.id;
          const anchor = offset === "left" ? "end" : offset === "right" ? "start" : "middle";
          const labelX = shift.x + (offset === "left" ? -18 : offset === "right" ? 18 : 0);
          const labelY = shift.y + (offset === "top" ? -20 : offset === "bottom" ? 30 : 4);
          return (
            <g
              key={span.id}
              transform={`translate(${point.x} ${point.y})`}
              onClick={() => onPickSpan(span.id)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {span.hasNdw
                  ? `${copy?.full ?? span.label}: ${tone.label}`
                  : `${copy?.full ?? span.label}: geen live NDW`}
              </title>
              <circle r="22" fill={selected ? `${tone.fill}55` : `${tone.fill}22`} />
              <circle r="9" fill={tone.fill} stroke="#020617" strokeWidth="2" />
              <text
                x={labelX}
                y={labelY}
                textAnchor={anchor}
                fill="#f8fafc"
                fontSize="13"
                fontWeight="700"
                fontFamily="ui-sans-serif, system-ui"
              >
                {copy?.full ?? span.label}
              </text>
              {span.hasNdw ? null : (
                <text
                  x={labelX}
                  y={labelY + 14}
                  textAnchor={anchor}
                  fill="#cbd5e1"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  geen live NDW
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function paintSpans(map: maplibregl.Map, data: ReturnType<typeof spansGeoJSON>) {
  const source = map.getSource("spans") as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource("corridor", { type: "geojson", data: corridorGeoJSON() });
  map.addLayer({
    id: "corridor-casing",
    type: "line",
    source: "corridor",
    paint: {
      "line-color": "#020617",
      "line-width": 10,
      "line-opacity": 0.55,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "corridor-fill",
    type: "line",
    source: "corridor",
    paint: {
      "line-color": "#64748b",
      "line-width": 3.5,
      "line-dasharray": [1.2, 1.4],
      "line-opacity": 0.7,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addSource("spans", { type: "geojson", data });
  map.addLayer({
    id: "spans-halo",
    type: "line",
    source: "spans",
    paint: {
      "line-color": "#020617",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["case", [">", ["get", "hasNdw"], 0], 36, 22],
        15.2,
        ["case", [">", ["get", "hasNdw"], 0], 26, 16],
      ],
      "line-opacity": 0.9,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "spans-casing",
    type: "line",
    source: "spans",
    paint: {
      "line-color": "#f8fafc",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["case", [">", ["get", "hasNdw"], 0], 26, 16],
        15.2,
        ["case", [">", ["get", "hasNdw"], 0], 18, 11],
      ],
      "line-opacity": 0.92,
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "spans-fill",
    type: "line",
    source: "spans",
    paint: {
      "line-color": ["get", "color"],
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        13,
        ["case", [">", ["get", "hasNdw"], 0], 18, 10],
        15.2,
        ["case", [">", ["get", "hasNdw"], 0], 13, 7],
      ],
    },
    layout: { "line-cap": "round", "line-join": "round" },
  });
  map.addLayer({
    id: "spans-hit",
    type: "line",
    source: "spans",
    paint: { "line-color": "#000000", "line-width": 44, "line-opacity": 0 },
    layout: { "line-cap": "round", "line-join": "round" },
  });
}

export function DraftA2Map({
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
  const spans = liveSpanHits(live);
  const advice = routeAdvice(spans);
  const liveAt = live?.fetchedAt
    ? formatTime(new Date(live.fetchedAt))
    : formatTime(now);
  const container = useRef<HTMLDivElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const spanMarkers = useRef<maplibregl.Marker[]>([]);
  const lockMarkers = useRef<maplibregl.Marker[]>([]);
  const pickRef = useRef<(next: MapPick) => void>(() => undefined);
  const padRef = useRef({ top: 176, bottom: 12, left: 20, right: 20 });
  const refitRef = useRef<() => void>(() => undefined);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [webglOk, setWebglOk] = useState(true);
  const [pick, setPick] = useState<MapPick>(null);
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
        center: LOCK_FRAME.center,
        zoom: phone ? 13.25 : 13.7,
        minZoom: 12.55,
        bearing: LOCK_FRAME.bearing,
        pitch: LOCK_FRAME.pitch2d,
        attributionControl: false,
        maxBounds: lockMaxBounds(),
      });
    } catch {
      setWebglOk(false);
      return;
    }
    const onWindowError = (event: ErrorEvent) => {
      const message = String(event.message ?? event.error ?? "");
      if (
        message.includes("WebGL") ||
        message.includes("webgl") ||
        message.includes("Failed to initialize")
      ) {
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
      if (
        message.includes("WebGL") ||
        message.includes("webgl") ||
        message.includes("Failed to initialize")
      ) {
        setWebglOk(false);
        return;
      }
      if (message.includes("wood-pattern") || message.includes("image")) return;
      if (message.includes("source") || message.includes("tile") || message.includes("ajax")) {
        setFailed(true);
      }
    });
    const watch = watchComplexMapSize(map, () => padRef.current);
    refitRef.current = watch.refit;
    map.on("load", () => {
      window.clearTimeout(timeout);
      addChamberLayers(map, "#22d3ee", "#a5f3fc");
      paintSpans(map, spansGeoJSON(spans));
      watch.refit();
      setReady(true);
    });
    const pickFromEvent = (event: maplibregl.MapMouseEvent) => {
      if (map.getLayer("spans-hit")) {
        const spanHits = map.queryRenderedFeatures(event.point, { layers: ["spans-hit"] });
        const spanId = spanHits[0]?.properties?.id;
        if (spanId) {
          pickRef.current({ kind: "span", id: String(spanId) });
          return true;
        }
      }
      if (map.getLayer("chambers-fill")) {
        const lockHits = map.queryRenderedFeatures(event.point, { layers: ["chambers-fill"] });
        const lockId = lockHits[0]?.properties?.id;
        if (lockId) {
          pickRef.current({ kind: "lock", id: String(lockId) });
          return true;
        }
      }
      return false;
    };
    map.on("click", (event) => {
      if (pickFromEvent(event)) return;
      const target = event.originalEvent.target as HTMLElement | null;
      if (!target?.closest("button")) pickRef.current(null);
    });
    mapRef.current = map;
    return () => {
      spanMarkers.current.forEach((marker) => marker.remove());
      lockMarkers.current.forEach((marker) => marker.remove());
      spanMarkers.current = [];
      lockMarkers.current = [];
      window.clearTimeout(timeout);
      window.removeEventListener("error", onWindowError);
      watch.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // spans are applied after load via the data-sync effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    paintSpans(map, spansGeoJSON(spans));
  }, [spans, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    lockMarkers.current.forEach((marker) => marker.remove());
    lockMarkers.current = LOCK_CHAMBERS.map((chamber) => {
      const copy = LOCK_COPY[chamber.id as LockId];
      const offset = copy.offset;
      const element = makeStatusMarker({
        title: `${copy.full} — landmark, geen live NDW`,
        short: copy.full,
        fill: "#cbd5e1",
        offset,
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
    spanMarkers.current.forEach((marker) => marker.remove());
    spanMarkers.current = spans.map((span) =>
      new maplibregl.Marker({
        element: makeFullNameMarker(
          span,
          (pick?.kind === "span" || pick?.kind === "ndw") && pick.id === span.id,
          () => setPick({ kind: "span", id: span.id }),
        ),
        anchor: "center",
      })
        .setLngLat([span.coordinates.lng, span.coordinates.lat])
        .addTo(map),
    );
  }, [spans, pick, ready]);

  useEffect(() => {
    const el = hudRef.current;
    const sync = () => {
      const phone = window.innerWidth < 640;
      const height = el?.getBoundingClientRect().height ?? (phone ? 168 : 156);
      const next = {
        top: Math.ceil(height + 10),
        bottom: phone ? 10 : 18,
        left: phone ? 16 : 48,
        right: phone ? 16 : 48,
      };
      padRef.current = next;
      setChromePad(next);
      refitRef.current();
    };
    sync();
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [advice.title]);

  const banner =
    advice.tone === "closed"
      ? "border-red-400/70 bg-red-950/90 text-red-50"
      : advice.tone === "open"
        ? "border-emerald-400/70 bg-emerald-950/90 text-emerald-50"
        : advice.tone === "mixed"
          ? "border-amber-300/70 bg-slate-950/92 text-amber-100"
          : "border-white/20 bg-slate-950/90 text-slate-100";

  return (
    <div className="fixed inset-0 z-50 bg-[#05080d] text-slate-100">
      <div ref={container} className="absolute inset-0 h-full w-full" data-testid="a2-map" />
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
          <SpanFallbackSvg
            spans={spans}
            pick={pick}
            onPickSpan={(id) => setPick({ kind: "span", id })}
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
        data-testid="a2-top-hud"
      >
        <div className="pointer-events-auto mx-auto w-full max-w-xl space-y-1 px-3 pt-2.5 sm:space-y-1.5 sm:px-5 sm:pt-4">
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
              <ConceptChip letter="A2" />
              <p className="font-mono text-[11px] text-cyan-200">{liveAt}</p>
            </div>
          </div>
          <div className={cn("rounded-lg border px-3 py-1 sm:py-1.5 backdrop-blur-md", banner)}>
            <p className="text-[10px] font-semibold tracking-[0.16em] uppercase text-current/80">
              Route nu
            </p>
            <p className="text-sm font-semibold leading-tight sm:text-base">{advice.title}</p>
            <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-current/90 sm:line-clamp-2">
              {advice.detail}
            </p>
          </div>
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-lg border border-white/15 bg-slate-950/78 px-2.5 py-1 backdrop-blur-md sm:py-1.5"
            title={catalog.status.disclaimer}
          >
            <StatusLegend />
            <p className="text-[11px] leading-4 text-slate-300">
              Op afroep · groene/rode balken = live NDW
            </p>
          </div>
        </div>
      </header>
      {pick ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3 sm:px-5 sm:pb-4">
          <div className="pointer-events-auto mx-auto w-full max-w-xl">
            <StatusPanel pick={pick} pins={spans} onClose={() => setPick(null)} />
          </div>
        </div>
      ) : null}
      {webglOk && !ready && !failed ? (
        <p className="pointer-events-none absolute left-1/2 top-[48%] -translate-x-1/2 font-mono text-xs text-cyan-200/80">
          Esri-basemap laden…
        </p>
      ) : null}
      {failed && webglOk ? (
        <p className="absolute left-1/2 top-[48%] max-w-xs -translate-x-1/2 text-center text-sm text-amber-200">
          Open-tegels niet bereikbaar. Oversteken blijven zichtbaar.
        </p>
      ) : null}
    </div>
  );
}
