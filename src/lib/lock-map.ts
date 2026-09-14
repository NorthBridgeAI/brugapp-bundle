import type { LiveCrossingHit, LiveSnapshot, RoadStatus } from "./types";

type LngLat = [number, number];
type LineString = { type: "LineString"; coordinates: LngLat[] };
type Polygon = { type: "Polygon"; coordinates: LngLat[][] };
type Feature<G> = {
  type: "Feature";
  properties: Record<string, string | number | boolean>;
  geometry: G;
};
type FeatureCollection<G> = { type: "FeatureCollection"; features: Feature<G>[] };

export const NDW_ISRS = [
  "NLTNZ130B20497600005",
  "NLTNZ130B20497800009",
] as const;

export type NdwIsrs = (typeof NDW_ISRS)[number];

export const LOCK_CHAMBERS = [
  {
    id: "oostsluis",
    label: "Oostsluis",
    note: "binnensluis · landmark",
    coordinates: { lat: 51.334719, lng: 3.8200931 },
    lengthM: 260,
    widthM: 38,
    headingDeg: 18,
  },
  {
    id: "nieuwe-sluis",
    label: "Nieuwe Sluis",
    note: "427×55 m · landmark",
    coordinates: { lat: 51.3294933, lng: 3.8188914 },
    lengthM: 427,
    widthM: 55,
    headingDeg: 12,
  },
  {
    id: "westsluis",
    label: "Westsluis",
    note: "zeesluis · landmark",
    coordinates: { lat: 51.3284182, lng: 3.8170477 },
    lengthM: 280,
    widthM: 40,
    headingDeg: 16,
  },
] as const;

export type LockId = (typeof LOCK_CHAMBERS)[number]["id"];

export const LOCK_COPY: Record<
  LockId,
  { short: string; full: string; offset: MarkerOffset }
> = {
  westsluis: { short: "West", full: "Westsluis", offset: "left" },
  "nieuwe-sluis": { short: "Nieuwe", full: "Nieuwe Sluis", offset: "bottom" },
  oostsluis: { short: "Oost", full: "Oostsluis", offset: "right" },
};

export const LOCK_FRAME = {
  center: [3.8188, 51.3323] as [number, number],
  zoom: 14.15,
  bearing: -6,
  pitch2d: 0,
  pitch3d: 48,
  phoneCenter: [3.8188, 51.3323] as [number, number],
  phoneZoom: 13.55,
  bounds: { west: 3.8148, south: 51.3266, east: 3.8232, north: 51.3382 },
};

export type MarkerOffset = "left" | "right" | "top" | "bottom";

export const PIN_COPY: Record<
  string,
  { short: string; full: string; offset: MarkerOffset }
> = {
  "buitenhaven-noord": {
    short: "BH noord",
    full: "Buitenhaven noord",
    offset: "top",
  },
  "buitenhaven-oostsluis": {
    short: "BH Oost",
    full: "Buitenhaven Oostsluis",
    offset: "left",
  },
  "buitenhaven-midden": {
    short: "BH midden",
    full: "Buitenhaven midden",
    offset: "right",
  },
  "buitenhaven-westsluis": {
    short: "BH West",
    full: "Buitenhaven Westsluis",
    offset: "left",
  },
  "buitenhaven-zuid": {
    short: "BH zuid",
    full: "Buitenhaven zuid",
    offset: "bottom",
  },
};

export const ROAD_TONE: Record<
  RoadStatus,
  { fill: string; label: string; short: string }
> = {
  clear: { fill: "#15803d", label: "Open — weg vrij", short: "Open" },
  wait: { fill: "#b91c1c", label: "Dicht — weg gesloten", short: "Dicht" },
  soon: { fill: "#a16207", label: "Let op — opening verwacht", short: "Let op" },
  unknown: { fill: "#475569", label: "Geen live NDW", short: "Geen NDW" },
};

/** OSM movable-bridge ways on Buitenhaven. Only two have NDW ISRS. */
export const BUITENHAVEN_SPANS = [
  {
    id: "buitenhaven-noord",
    label: "Buitenhaven noord",
    isrs: "NLTNZ130B20497800009" as const,
    osmWay: 7614741,
    hasNdw: true,
    coords: [
      [3.8195971, 51.3360219],
      [3.8199592, 51.3360568],
    ] as [number, number][],
  },
  {
    id: "buitenhaven-oostsluis",
    label: "Buitenhaven Oostsluis",
    isrs: "NLTNZ130B20497600005" as const,
    osmWay: 7614718,
    hasNdw: true,
    coords: [
      [3.820291, 51.3330268],
      [3.8206566, 51.3330576],
    ] as [number, number][],
  },
  {
    id: "buitenhaven-midden",
    label: "Buitenhaven midden",
    isrs: "" as const,
    osmWay: 1184744248,
    hasNdw: false,
    coords: [
      [3.8183694, 51.3319095],
      [3.8171467, 51.3316072],
    ] as [number, number][],
  },
  {
    id: "buitenhaven-westsluis",
    label: "Buitenhaven Westsluis",
    isrs: "" as const,
    osmWay: 7614690,
    hasNdw: false,
    coords: [
      [3.8157592, 51.3296126],
      [3.8163039, 51.3297833],
    ] as [number, number][],
  },
  {
    id: "buitenhaven-zuid",
    label: "Buitenhaven zuid",
    isrs: "" as const,
    osmWay: 7614035,
    hasNdw: false,
    coords: [
      [3.8180858, 51.3266823],
      [3.8186301, 51.3268541],
    ] as [number, number][],
  },
] as const;

export type SpanId = (typeof BUITENHAVEN_SPANS)[number]["id"];

function ndwFallback(isrs: string): LiveCrossingHit {
  const known =
    isrs === "NLTNZ130B20497600005"
      ? {
          id: "buitenhaven-oostsluis",
          label: "Buitenhaven Oostsluis",
          lat: 51.33302,
          lng: 3.820414,
        }
      : {
          id: "buitenhaven-noord",
          label: "Buitenhaven noord",
          lat: 51.336056,
          lng: 3.819774,
        };
  return {
    id: known.id,
    label: known.label,
    roadName: "Buitenhaven",
    coordinates: { lat: known.lat, lng: known.lng },
    road: "unknown",
    operatorStatus: null,
    start: null,
    end: null,
    updatedAt: new Date().toISOString(),
    isrs,
    nextPlannedStart: null,
    nextPlannedEnd: null,
    seen: false,
    hasNdw: true,
  };
}

export function liveNdwPins(live: LiveSnapshot | null | undefined): LiveCrossingHit[] {
  const hits = Object.values(live?.crossings ?? {});
  return NDW_ISRS.map((isrs) => hits.find((hit) => hit.isrs === isrs) ?? ndwFallback(isrs));
}

export function spanMidpoint(span: (typeof BUITENHAVEN_SPANS)[number]): {
  lat: number;
  lng: number;
} {
  const [a, b] = span.coords;
  return { lat: (a[1] + b[1]) / 2, lng: (a[0] + b[0]) / 2 };
}

export function liveSpanHits(live: LiveSnapshot | null | undefined): LiveCrossingHit[] {
  const hits = Object.values(live?.crossings ?? {});
  return BUITENHAVEN_SPANS.map((span) => {
    const hit = hits.find((item) => item.id === span.id || (span.isrs && item.isrs === span.isrs));
    const coordinates = spanMidpoint(span);
    if (hit) return { ...hit, label: span.label, hasNdw: span.hasNdw, coordinates };
    return {
      id: span.id,
      label: span.label,
      roadName: "Buitenhaven",
      coordinates,
      road: "unknown",
      operatorStatus: null,
      start: null,
      end: null,
      updatedAt: live?.fetchedAt ?? new Date().toISOString(),
      isrs: span.isrs,
      nextPlannedStart: null,
      nextPlannedEnd: null,
      seen: false,
      hasNdw: span.hasNdw,
    };
  });
}

function chamberPolygon(chamber: (typeof LOCK_CHAMBERS)[number]): [number, number][] {
  const { lat, lng } = chamber.coordinates;
  const heading = (chamber.headingDeg * Math.PI) / 180;
  const metersLat = 1 / 111320;
  const metersLng = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  const halfL = chamber.lengthM / 2;
  const halfW = chamber.widthM / 2;
  return [
    [-halfL, -halfW],
    [halfL, -halfW],
    [halfL, halfW],
    [-halfL, halfW],
    [-halfL, -halfW],
  ].map(([along, across]) => {
    const north = along * Math.cos(heading) - across * Math.sin(heading);
    const east = along * Math.sin(heading) + across * Math.cos(heading);
    return [lng + east * metersLng, lat + north * metersLat];
  });
}

export function chambersGeoJSON(): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: LOCK_CHAMBERS.map((chamber) => ({
      type: "Feature",
      properties: { id: chamber.id, label: chamber.label, note: chamber.note },
      geometry: { type: "Polygon", coordinates: [chamberPolygon(chamber)] },
    })),
  };
}

function thickenLine(coords: [number, number][], targetMeters: number): [number, number][] {
  if (coords.length < 2) return coords;
  const [lng0, lat0] = coords[0];
  const [lng1, lat1] = coords[coords.length - 1];
  const metersLat = 1 / 111320;
  const metersLng = 1 / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const dx = (lng1 - lng0) / metersLng;
  const dy = (lat1 - lat0) / metersLat;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const extra = Math.max(0, (targetMeters - len) / 2);
  return [
    [lng0 - ux * extra * metersLng, lat0 - uy * extra * metersLat],
    [lng1 + ux * extra * metersLng, lat1 + uy * extra * metersLat],
  ];
}

function spanFill(road: RoadStatus): string {
  if (road === "wait") return ROAD_TONE.wait.fill;
  if (road === "unknown") return ROAD_TONE.unknown.fill;
  return ROAD_TONE.clear.fill;
}

export function spansGeoJSON(
  hits: LiveCrossingHit[],
): FeatureCollection<LineString> {
  const byId = new Map(hits.map((hit) => [hit.id, hit]));
  return {
    type: "FeatureCollection",
    features: BUITENHAVEN_SPANS.map((span) => {
      const hit = byId.get(span.id);
      const road: RoadStatus = span.hasNdw ? (hit?.road ?? "unknown") : "unknown";
      const geometry: LineString = {
        type: "LineString",
        coordinates: thickenLine([...span.coords], span.hasNdw ? 170 : 120),
      };
      const feature: Feature<LineString> = {
        type: "Feature",
        properties: {
          id: span.id,
          label: span.label,
          isrs: span.isrs,
          hasNdw: span.hasNdw ? 1 : 0,
          road,
          color: spanFill(road),
          rank: span.hasNdw ? 2 : 1,
        },
        geometry,
      };
      return feature;
    }),
  };
}

export function corridorGeoJSON(): FeatureCollection<LineString> {
  const mids = BUITENHAVEN_SPANS.map((span) => {
    const [a, b] = span.coords;
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
  });
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: "buitenhaven-corridor" },
        geometry: { type: "LineString", coordinates: mids },
      },
    ],
  };
}

export type RouteAdvice = {
  tone: "open" | "closed" | "mixed" | "unknown";
  title: string;
  detail: string;
};

export function routeAdvice(hits: LiveCrossingHit[]): RouteAdvice {
  const ndw = hits.filter((hit) => hit.hasNdw);
  const open = ndw.filter((hit) => hit.road === "clear" || hit.road === "soon");
  const closed = ndw.filter((hit) => hit.road === "wait");
  const unseen = ndw.filter((hit) => hit.road === "unknown");

  if (closed.length === ndw.length && closed.length > 0) {
    return {
      tone: "closed",
      title: "Beide NDW-oversteken dicht",
      detail:
        "Buitenhaven noord en Buitenhaven Oostsluis zijn gesloten. Geen vrije live-route — we verzinnen geen omweg.",
    };
  }
  if (open.length === 1 && closed.length >= 1) {
    const pick = open[0];
    const blocked = closed.map((hit) => hit.label).join(" en ");
    return {
      tone: "mixed",
      title: `Neem ${pick.label}`,
      detail: `${blocked} is dicht. Alleen ${pick.label} is live vrij. Grijze oversteken hebben geen live NDW.`,
    };
  }
  if (open.length >= 2) {
    return {
      tone: "open",
      title: "Beide NDW-oversteken open",
      detail:
        "Buitenhaven noord en Buitenhaven Oostsluis zijn vrij. Kies de groene oversteek.",
    };
  }
  if (open.length === 1) {
    return {
      tone: "open",
      title: `Neem ${open[0].label}`,
      detail: `${open[0].label} is live vrij. De andere NDW-oversteek heeft nu geen situatie.`,
    };
  }
  if (unseen.length === ndw.length) {
    return {
      tone: "unknown",
      title: "Nog geen live NDW-situatie",
      detail:
        "Alleen Buitenhaven noord en Buitenhaven Oostsluis hebben NDW. Grijze oversteken: geen live NDW.",
    };
  }
  return {
    tone: "unknown",
    title: "Live NDW onvolledig",
    detail: "Grijze oversteken hebben geen live NDW. Rood is dicht, groen is vrij.",
  };
}

export function lockFitBounds(): [[number, number], [number, number]] {
  return [
    [3.8158, 51.3271],
    [3.822, 51.3373],
  ];
}

/** OSM span envelope — kept for overlays that want every Buitenhaven way. */
export function spanFitBounds(): [[number, number], [number, number]] {
  return [
    [3.8149, 51.32615],
    [3.8219, 51.33715],
  ];
}

/** Draft C camera bar: Westsluis + Nieuwe Sluis + Oostsluis + both NDW crossings. */
export const DRAFT_C_NDW_PINS = [
  { lat: 51.336056, lng: 3.819774 },
  { lat: 51.33302, lng: 3.820414 },
] as const;

export function complexFitBounds(compact = false): [[number, number], [number, number]] {
  const lngs: number[] = [];
  const lats: number[] = [];
  const add = (lng: number, lat: number) => {
    lngs.push(lng);
    lats.push(lat);
  };
  for (const chamber of LOCK_CHAMBERS) {
    for (const [lng, lat] of chamberPolygon(chamber)) add(lng, lat);
  }
  for (const pin of DRAFT_C_NDW_PINS) add(pin.lng, pin.lat);
  for (const span of BUITENHAVEN_SPANS) {
    const line = span.hasNdw ? thickenLine([...span.coords], 170) : [...span.coords];
    for (const [lng, lat] of line) add(lng, lat);
  }
  const padM = compact ? { x: 260, y: 300 } : { x: 190, y: 230 };
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const metersLat = 1 / 111320;
  const metersLng = 1 / (111320 * Math.cos((lat0 * Math.PI) / 180));
  return [
    [Math.min(...lngs) - padM.x * metersLng, Math.min(...lats) - padM.y * metersLat],
    [Math.max(...lngs) + padM.x * metersLng, Math.max(...lats) + padM.y * metersLat],
  ];
}

export function projectIso(lat: number, lng: number) {
  return {
    x: -262164.5581552222 + 69778.43524583061 * lng + -74.68791842713048 * lat,
    y: 529276.4762347837 + -18513.318514501563 * lng + -8927.138018106609 * lat,
  };
}
