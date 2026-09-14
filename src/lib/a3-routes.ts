import {
  A3_BRIDGES,
  A3_ROADS,
  A3_ROUNDABOUTS,
  lineStringsOf,
  type LngLat,
} from "./a3-geo";
import {
  A3_BRIDGE_IDS,
  type A3Advice,
  type A3BridgeId,
  type A3Paint,
  bridgePaints,
  ndwCaution,
  routeAdviceFromPaints,
} from "./a3-status";
import type { LiveSnapshot } from "./types";

const EARTH_M = 6371000;
const SNAP_M = 15;
const BRIDGE_HIT_M = 35;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineMeters(a: LngLat, b: LngLat): number {
  const p1 = toRad(a[1]);
  const p2 = toRad(b[1]);
  const dphi = p2 - p1;
  const dl = toRad(b[0] - a[0]);
  const h =
    Math.sin(dphi / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function closestOnSegment(p: LngLat, a: LngLat, b: LngLat): { q: LngLat; d: number } {
  const ax = a[0];
  const ay = a[1];
  const dx = b[0] - ax;
  const dy = b[1] - ay;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { q: a, d: haversineMeters(p, a) };
  const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2));
  const q: LngLat = [ax + t * dx, ay + t * dy];
  return { q, d: haversineMeters(p, q) };
}

interface Graph {
  nodes: LngLat[];
  adj: Array<Array<{ to: number; w: number }>>;
  bridgeNode: Record<A3BridgeId, number>;
}

function nodeKey(c: LngLat): string {
  return `${Math.round(c[0] * 1e5)},${Math.round(c[1] * 1e5)}`;
}

function buildGraph(): Graph {
  const nodes: LngLat[] = [];
  const index = new Map<string, number>();
  const adj: Array<Array<{ to: number; w: number }>> = [];

  const nid = (c: LngLat): number => {
    const k = nodeKey(c);
    const existing = index.get(k);
    if (existing !== undefined) return existing;
    const i = nodes.length;
    nodes.push(c);
    index.set(k, i);
    adj.push([]);
    return i;
  };

  const extras = A3_BRIDGES.features.map((feature) => feature.geometry.coordinates);
  const lines = [
    ...lineStringsOf(A3_ROADS),
    ...lineStringsOf(A3_ROUNDABOUTS),
  ];

  for (const coords of lines) {
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const mids: Array<{ d: number; q: LngLat }> = [];
      for (const extra of extras) {
        const { q, d } = closestOnSegment(extra, a, b);
        if (d < SNAP_M) mids.push({ d: haversineMeters(a, q), q });
      }
      mids.sort((x, y) => x.d - y.d);
      const seq: LngLat[] = [a, ...mids.map((m) => m.q), b];
      for (let j = 0; j < seq.length - 1; j++) {
        const u = seq[j];
        const v = seq[j + 1];
        if (haversineMeters(u, v) < 0.4) continue;
        const ia = nid(u);
        const ib = nid(v);
        if (ia === ib) continue;
        const w = haversineMeters(nodes[ia], nodes[ib]);
        adj[ia].push({ to: ib, w });
        adj[ib].push({ to: ia, w });
      }
    }
  }

  const bridgeNode = {} as Record<A3BridgeId, number>;
  for (const feature of A3_BRIDGES.features) {
    const id = String(feature.properties.id) as A3BridgeId;
    const p = feature.geometry.coordinates;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const d = haversineMeters(p, nodes[i]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    bridgeNode[id] = best;
  }

  return { nodes, adj, bridgeNode };
}

let cached: Graph | null = null;

export function a3RoadGraph(): Graph {
  cached ??= buildGraph();
  return cached;
}

function dijkstra(
  graph: Graph,
  src: number,
  dst: number,
  blocked: Set<number>,
): { dist: number; path: number[] } | null {
  const dist = new Map<number, number>([[src, 0]]);
  const prev = new Map<number, number>();
  const heap: Array<{ d: number; u: number }> = [{ d: 0, u: src }];

  const push = (d: number, u: number) => {
    heap.push({ d, u });
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p].d <= heap[i].d) break;
      const tmp = heap[p];
      heap[p] = heap[i];
      heap[i] = tmp;
      i = p;
    }
  };

  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (!last || heap.length === 0) return top;
    heap[0] = last;
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let s = i;
      if (l < heap.length && heap[l].d < heap[s].d) s = l;
      if (r < heap.length && heap[r].d < heap[s].d) s = r;
      if (s === i) break;
      const tmp = heap[i];
      heap[i] = heap[s];
      heap[s] = tmp;
      i = s;
    }
    return top;
  };

  while (heap.length) {
    const { d, u } = pop();
    if (d !== dist.get(u)) continue;
    if (u === dst) break;
    for (const edge of graph.adj[u]) {
      if (blocked.has(edge.to) || blocked.has(u)) continue;
      const nd = d + edge.w;
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd);
        prev.set(edge.to, u);
        push(nd, edge.to);
      }
    }
  }

  if (!dist.has(dst)) return null;
  const path = [dst];
  while (path[path.length - 1] !== src) {
    const step = prev.get(path[path.length - 1]);
    if (step === undefined) return null;
    path.push(step);
  }
  path.reverse();
  return { dist: dist.get(dst)!, path };
}

function nearestNode(graph: Graph, p: LngLat): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < graph.nodes.length; i++) {
    const d = haversineMeters(p, graph.nodes[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** NWB vertex south of Oostsluis binnenhoofd on Buitenhaven (Phase 2 roads). */
const OOST_SOUTH_APPROACH: LngLat = [3.820987792918405, 51.33218793326102];
/** NWB vertex north of Oostsluis buitenhoofd on Buitenhaven (Phase 2 roads). */
const OOST_NORTH_APPROACH: LngLat = [3.8204615652024634, 51.33610982246906];

const UNCONFIRMED: A3BridgeId[] = [
  "westsluis-noord",
  "westsluis-zuid",
  "nieuwe-sluis-buitenhoofd",
  "nieuwe-sluis-binnenhoofd",
];

function pathBridges(graph: Graph, path: number[]): A3BridgeId[] {
  const hit: A3BridgeId[] = [];
  for (const [id, node] of Object.entries(graph.bridgeNode) as Array<
    [A3BridgeId, number]
  >) {
    const at = graph.nodes[node];
    if (path.some((i) => haversineMeters(graph.nodes[i], at) < BRIDGE_HIT_M)) {
      hit.push(id);
    }
  }
  return hit;
}

function concatPaths(parts: number[][]): number[] {
  const out: number[] = [];
  for (const part of parts) {
    if (out.length && part[0] === out[out.length - 1]) out.push(...part.slice(1));
    else out.push(...part);
  }
  return out;
}

export interface A3RouteResult {
  advice: A3Advice;
  paints: Record<A3BridgeId, A3Paint>;
  coordinates: LngLat[];
  via: A3BridgeId[];
}

export function recommendA3Route(
  live: LiveSnapshot | null | undefined,
): A3RouteResult {
  const paints = bridgePaints(live);
  const caution = ndwCaution(live);
  const advice = routeAdviceFromPaints(paints, caution);
  if (!advice.showRoute) {
    return { advice, paints, coordinates: [], via: [] };
  }

  const graph = a3RoadGraph();
  const blocked = new Set<number>();
  for (const id of UNCONFIRMED) blocked.add(graph.bridgeNode[id]);
  for (const id of ["oostsluis-buitenhoofd", "oostsluis-binnenhoofd"] as const) {
    if (paints[id] !== "open") blocked.add(graph.bridgeNode[id]);
  }

  const south = nearestNode(graph, OOST_SOUTH_APPROACH);
  const north = nearestNode(graph, OOST_NORTH_APPROACH);
  const oostS = graph.bridgeNode["oostsluis-binnenhoofd"];
  const oostN = graph.bridgeNode["oostsluis-buitenhoofd"];

  const leg1 = dijkstra(graph, south, oostS, blocked);
  const leg2 = dijkstra(graph, oostS, oostN, blocked);
  const leg3 = dijkstra(graph, oostN, north, blocked);
  if (!leg1 || !leg2 || !leg3) {
    return {
      advice: {
        ...advice,
        showRoute: false,
        title: "Geen bevestigde route",
        detail:
          "Oostsluis is live open, maar de NWB-wegvakken leveren nu geen volledige corridor.",
        tone: "no-live-data",
      },
      paints,
      coordinates: [],
      via: [],
    };
  }

  const path = concatPaths([leg1.path, leg2.path, leg3.path]);
  const via = pathBridges(graph, path);
  const usesUnconfirmed = via.some((id) => UNCONFIRMED.includes(id));
  const usesClosed = via.some((id) => paints[id] !== "open" && !UNCONFIRMED.includes(id));
  if (
    usesUnconfirmed ||
    usesClosed ||
    !via.includes("oostsluis-binnenhoofd") ||
    !via.includes("oostsluis-buitenhoofd")
  ) {
    return { advice: { ...advice, showRoute: false }, paints, coordinates: [], via: [] };
  }

  return {
    advice,
    paints,
    coordinates: path.map((i) => graph.nodes[i]),
    via,
  };
}

/**
 * NWB corridor through any lock whose *both* decks paint OPEN.
 * Production live paints never OPEN West/NS (missing ISRS), so this
 * matches `recommendA3Route` unless a caller (A5 sim) supplies OPEN.
 */
const LOCK_CORRIDORS: Array<{
  lock: "oostsluis" | "nieuwe-sluis" | "westsluis";
  south: LngLat;
  north: LngLat;
  southBridge: A3BridgeId;
  northBridge: A3BridgeId;
}> = [
  {
    lock: "oostsluis",
    south: OOST_SOUTH_APPROACH,
    north: OOST_NORTH_APPROACH,
    southBridge: "oostsluis-binnenhoofd",
    northBridge: "oostsluis-buitenhoofd",
  },
  {
    lock: "nieuwe-sluis",
    south: [3.82061, 51.32679],
    north: [3.81729, 51.33221],
    southBridge: "nieuwe-sluis-binnenhoofd",
    northBridge: "nieuwe-sluis-buitenhoofd",
  },
  {
    lock: "westsluis",
    south: [3.81885, 51.32625],
    north: [3.81555, 51.33025],
    southBridge: "westsluis-zuid",
    northBridge: "westsluis-noord",
  },
];

function adviceForOpenLock(
  lock: (typeof LOCK_CORRIDORS)[number]["lock"],
  paints: Record<A3BridgeId, A3Paint>,
  caution: { oostNorth: boolean; oostSouth: boolean },
): A3Advice {
  if (lock === "oostsluis") return routeAdviceFromPaints(paints, caution);
  const title = lock === "nieuwe-sluis" ? "Nieuwe Sluis open" : "Westsluis open";
  return {
    tone: "open",
    title,
    detail:
      "Groene NWB-centerline alleen over dekken die OPEN zijn. Westsluis en Nieuwe Sluis hebben geen live NDW — dit pad bestaat alleen bij een expliciete OPEN-status.",
    caution: false,
    showRoute: true,
  };
}

export function recommendOpenCorridor(
  paints: Record<A3BridgeId, A3Paint>,
  caution: { oostNorth: boolean; oostSouth: boolean },
): A3RouteResult {
  const graph = a3RoadGraph();
  const blocked = new Set<number>();
  for (const id of A3_BRIDGE_IDS) {
    if (paints[id] !== "open") blocked.add(graph.bridgeNode[id]);
  }

  for (const spec of LOCK_CORRIDORS) {
    if (paints[spec.southBridge] !== "open" || paints[spec.northBridge] !== "open") {
      continue;
    }
    const south = nearestNode(graph, spec.south);
    const north = nearestNode(graph, spec.north);
    const a = graph.bridgeNode[spec.southBridge];
    const b = graph.bridgeNode[spec.northBridge];
    const leg1 = dijkstra(graph, south, a, blocked);
    const leg2 = dijkstra(graph, a, b, blocked);
    const leg3 = dijkstra(graph, b, north, blocked);
    if (!leg1 || !leg2 || !leg3) continue;
    const path = concatPaths([leg1.path, leg2.path, leg3.path]);
    const via = pathBridges(graph, path);
    if (!via.includes(spec.southBridge) || !via.includes(spec.northBridge)) continue;
    if (via.some((id) => paints[id] !== "open")) continue;
    return {
      advice: adviceForOpenLock(spec.lock, paints, caution),
      paints,
      coordinates: path.map((i) => graph.nodes[i]),
      via,
    };
  }

  return {
    advice: routeAdviceFromPaints(paints, caution),
    paints,
    coordinates: [],
    via: [],
  };
}

export function routeLineGeoJSON(coordinates: LngLat[]): {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { id: string };
    geometry: { type: "LineString"; coordinates: LngLat[] };
  }>;
} {
  if (coordinates.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: "a3-oost-corridor" },
        geometry: { type: "LineString", coordinates },
      },
    ],
  };
}
