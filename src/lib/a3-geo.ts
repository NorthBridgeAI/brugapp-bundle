import locksJson from "../data/geo/locks-rws.json";
import chambersJson from "../data/geo/lock-chambers-rws.json";
import bridgesJson from "../data/geo/bridges-rws.json";
import decksJson from "../data/geo/bridges-bgt-decks.json";
import roadsJson from "../data/geo/roads-nwb-lock-island.json";
import roundaboutsJson from "../data/geo/roundabouts-nwb.json";
import waterJson from "../data/geo/water-bgt.json";
import type { A3BridgeId, A3Paint } from "./a3-status";
import { A3_PAINT_COLOR } from "./a3-status";

export type LngLat = [number, number];

export type GeoGeometry =
  | { type: "Point"; coordinates: LngLat }
  | { type: "LineString"; coordinates: LngLat[] }
  | { type: "MultiLineString"; coordinates: LngLat[][] }
  | { type: "Polygon"; coordinates: LngLat[][] }
  | { type: "MultiPolygon"; coordinates: LngLat[][][] };

export interface GeoFeature<G extends GeoGeometry = GeoGeometry> {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: G;
}

export interface GeoCollection<G extends GeoGeometry = GeoGeometry> {
  type: "FeatureCollection";
  features: GeoFeature<G>[];
}

export const A3_LOCKS = locksJson as unknown as GeoCollection<{
  type: "Polygon";
  coordinates: LngLat[][];
}>;
export const A3_CHAMBERS = chambersJson as unknown as GeoCollection<{
  type: "Polygon";
  coordinates: LngLat[][];
}>;
export const A3_BRIDGES = bridgesJson as unknown as GeoCollection<{
  type: "Point";
  coordinates: LngLat;
}>;
export const A3_DECKS = decksJson as unknown as GeoCollection<{
  type: "Polygon";
  coordinates: LngLat[][];
}>;
export const A3_ROADS = roadsJson as unknown as GeoCollection<
  | { type: "LineString"; coordinates: LngLat[] }
  | { type: "MultiLineString"; coordinates: LngLat[][] }
>;
export const A3_ROUNDABOUTS = roundaboutsJson as unknown as GeoCollection<
  | { type: "LineString"; coordinates: LngLat[] }
  | { type: "MultiLineString"; coordinates: LngLat[][] }
>;
export const A3_WATER = waterJson as unknown as GeoCollection<
  | { type: "Polygon"; coordinates: LngLat[][] }
  | { type: "MultiPolygon"; coordinates: LngLat[][][] }
>;

export const A3_LOCK_COPY: Record<
  string,
  { full: string; note: string; offset: "left" | "right" | "top" | "bottom" }
> = {
  westsluis: { full: "Westsluis", note: "290×38 m · geen live NDW", offset: "left" },
  "nieuwe-sluis": {
    full: "Nieuwe Sluis",
    note: "427×55 m · geen live NDW",
    offset: "left",
  },
  oostsluis: { full: "Oostsluis", note: "280×24 m · live NDW op beide hoofden", offset: "right" },
};

export const A3_BRIDGE_COPY: Record<
  A3BridgeId,
  { full: string; short: string; offset: "left" | "right" | "top" | "bottom" }
> = {
  "oostsluis-buitenhoofd": {
    full: "Oostsluis buitenhoofd",
    short: "Oost N",
    offset: "top",
  },
  "oostsluis-binnenhoofd": {
    full: "Oostsluis binnenhoofd",
    short: "Oost Z",
    offset: "right",
  },
  "westsluis-noord": {
    full: "Westsluis noord",
    short: "West N",
    offset: "left",
  },
  "westsluis-zuid": {
    full: "Westsluis zuid",
    short: "West Z",
    offset: "top",
  },
  "nieuwe-sluis-buitenhoofd": {
    full: "Nieuwe Sluis buitenhoofd",
    short: "Nieuwe N",
    offset: "left",
  },
  "nieuwe-sluis-binnenhoofd": {
    full: "Nieuwe Sluis binnenhoofd",
    short: "Nieuwe Z",
    offset: "right",
  },
};

export function lineStringsOf(
  collection: GeoCollection<
    | { type: "LineString"; coordinates: LngLat[] }
    | { type: "MultiLineString"; coordinates: LngLat[][] }
  >,
): LngLat[][] {
  const lines: LngLat[][] = [];
  for (const feature of collection.features) {
    const g = feature.geometry;
    if (g.type === "LineString") lines.push(g.coordinates);
    else lines.push(...g.coordinates);
  }
  return lines;
}

export function polygonRings(
  geometry:
    | { type: "Polygon"; coordinates: LngLat[][] }
    | { type: "MultiPolygon"; coordinates: LngLat[][][] },
): LngLat[][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  return geometry.coordinates.flat();
}

export function featureCentroid(feature: GeoFeature): LngLat {
  const g = feature.geometry;
  const pts: LngLat[] = [];
  if (g.type === "Point") return g.coordinates;
  if (g.type === "LineString") pts.push(...g.coordinates);
  else if (g.type === "MultiLineString") pts.push(...g.coordinates.flat());
  else if (g.type === "Polygon") pts.push(...g.coordinates[0]);
  else pts.push(...g.coordinates.flat(2));
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lng, lat];
}

export function lockLabelPoints(): Array<{
  id: string;
  lng: number;
  lat: number;
  full: string;
  note: string;
  offset: "left" | "right" | "top" | "bottom";
}> {
  return A3_CHAMBERS.features.map((feature) => {
    const id = String(feature.properties.lockId ?? feature.properties.id);
    const [lng, lat] = featureCentroid(feature);
    const copy = A3_LOCK_COPY[id] ?? {
      full: String(feature.properties.officialName ?? id),
      note: "",
      offset: "right" as const,
    };
    return { id, lng, lat, ...copy };
  });
}

export function bridgePoints(): Array<{
  id: A3BridgeId;
  lng: number;
  lat: number;
  ndwIsrs: string | null;
}> {
  return A3_BRIDGES.features.map((feature) => {
    const id = String(feature.properties.id) as A3BridgeId;
    const [lng, lat] = feature.geometry.coordinates;
    const raw = feature.properties.ndwIsrs;
    return {
      id,
      lng,
      lat,
      ndwIsrs: typeof raw === "string" ? raw : null,
    };
  });
}

export function decksWithPaint(
  paints: Record<A3BridgeId, A3Paint>,
): GeoCollection<{ type: "Polygon"; coordinates: LngLat[][] }> {
  return {
    type: "FeatureCollection",
    features: A3_DECKS.features.map((feature) => {
      const id = String(feature.properties.id) as A3BridgeId;
      const paint = paints[id] ?? "no-live-data";
      return {
        type: "Feature",
        properties: {
          ...feature.properties,
          id,
          paint,
          color: A3_PAINT_COLOR[paint],
          hasNdw: typeof feature.properties.ndwIsrs === "string" ? 1 : 0,
        },
        geometry: feature.geometry,
      };
    }),
  };
}

export function a3FitBounds(): [[number, number], [number, number]] {
  const lngs: number[] = [];
  const lats: number[] = [];
  const add = (lng: number, lat: number) => {
    lngs.push(lng);
    lats.push(lat);
  };
  for (const feature of A3_LOCKS.features) {
    for (const ring of feature.geometry.coordinates) {
      for (const [lng, lat] of ring) add(lng, lat);
    }
  }
  for (const feature of A3_DECKS.features) {
    for (const ring of feature.geometry.coordinates) {
      for (const [lng, lat] of ring) add(lng, lat);
    }
  }
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const metersLat = 1 / 111320;
  const metersLng = 1 / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const padX = 140;
  const padY = 180;
  return [
    [Math.min(...lngs) - padX * metersLng, Math.min(...lats) - padY * metersLat],
    [Math.max(...lngs) + padX * metersLng, Math.max(...lats) + padY * metersLat],
  ];
}

export function a3Center(): LngLat {
  const [[west, south], [east, north]] = a3FitBounds();
  return [(west + east) / 2, (south + north) / 2];
}

export function a3MaxBounds(): [[number, number], [number, number]] {
  const [[west, south], [east, north]] = a3FitBounds();
  return [
    [west - 0.02, south - 0.02],
    [east + 0.02, north + 0.02],
  ];
}

export const A3_BEARING = -6;
