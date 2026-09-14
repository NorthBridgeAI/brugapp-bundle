import { A3_BRIDGE_IDS, type A3BridgeId, type A3Paint } from "./a3-status";
import {
  A5_BRIDGE_LABEL,
  SIM_PAINTS,
  SIM_PAINT_LABEL,
  applySimPaints,
  resolveA5Route,
  simSearchString,
  simToPaint,
  type SimOverrides,
  type SimPaint,
} from "./a5-sim";
import type { LiveSnapshot } from "./types";

export {
  A5_BRIDGE_LABEL as A6_BRIDGE_LABEL,
  SIM_PAINTS,
  SIM_PAINT_LABEL,
  applySimPaints,
  simSearchString,
  simToPaint,
};
export type { SimOverrides, SimPaint };

/** Calm infrastructure; never paint the whole map green. */
export const A6_FILL: Record<A3Paint, string> = {
  open: "#9aa7b4",
  closed: "#ff2d55",
  "no-live-data": "#64748b",
};

export const A6_TOKEN = {
  selected: "#22d3ee",
  route: "#3dff88",
  routeGlow: "#5fffd0",
  closed: "#ff2d55",
  closedGlow: "#fb7185",
  roadNormal: "#6b7c8c",
  roadImportant: "#9aa8b5",
  water: "#083d57",
  waterLine: "#155e75",
  chamber: "#0b3a52",
  chamberInner: "#062838",
  chamberLine: "#7dd3fc",
  quay: "#1e293b",
} as const;

/** QA A: nothing happens — calm slate map, no confirmed route. */
export const SCENARIO_UNKNOWN: SimOverrides = {
  "oostsluis-buitenhoofd": "no-live-data",
  "oostsluis-binnenhoofd": "no-live-data",
  "westsluis-noord": "no-live-data",
  "westsluis-zuid": "no-live-data",
  "nieuwe-sluis-buitenhoofd": "no-live-data",
  "nieuwe-sluis-binnenhoofd": "no-live-data",
};

/**
 * QA B: Oost Z closed + Nieuwe both OPEN so a real NWB detour is routeable.
 * Nieuwe Z must also be OPEN — a corridor cannot be invented from Nieuwe N alone.
 */
export const SCENARIO_OOST_Z: SimOverrides = {
  "oostsluis-buitenhoofd": "no-live-data",
  "oostsluis-binnenhoofd": "closed",
  "westsluis-noord": "no-live-data",
  "westsluis-zuid": "no-live-data",
  "nieuwe-sluis-buitenhoofd": "open",
  "nieuwe-sluis-binnenhoofd": "open",
};

/** QA C: all OPEN — one recommended corridor (Oost first), rest stay calm. */
export const SCENARIO_ALL_OPEN: SimOverrides = {
  "oostsluis-buitenhoofd": "open",
  "oostsluis-binnenhoofd": "open",
  "westsluis-noord": "open",
  "westsluis-zuid": "open",
  "nieuwe-sluis-buitenhoofd": "open",
  "nieuwe-sluis-binnenhoofd": "open",
};

export function parseA6SimSearch(search: string): { debug: boolean; overrides: SimOverrides } {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const debug = query.get("debug") === "1";
  const overrides: SimOverrides = {};
  const preset = query.get("preset");
  if (preset === "a" || preset === "unknown") Object.assign(overrides, SCENARIO_UNKNOWN);
  else if (preset === "b" || preset === "oostz") Object.assign(overrides, SCENARIO_OOST_Z);
  else if (preset === "c" || preset === "open") Object.assign(overrides, SCENARIO_ALL_OPEN);
  for (const id of A3_BRIDGE_IDS) {
    const raw = query.get(id) ?? query.get(`sim.${id}`);
    if (raw === "open" || raw === "closed" || raw === "stale") overrides[id] = raw;
    else if (raw === "no-live-data" || raw === "nodata" || raw === "none") {
      overrides[id] = "no-live-data";
    }
  }
  return { debug, overrides };
}

export function resolveA6Route(live: LiveSnapshot | null | undefined, overrides: SimOverrides) {
  return resolveA5Route(live, overrides);
}

export const A6_DECK_CONSUMER: Record<A3BridgeId, string> = {
  "oostsluis-buitenhoofd": "Oostsluis noord",
  "oostsluis-binnenhoofd": "Oostsluis zuid",
  "westsluis-noord": "Westsluis noord",
  "westsluis-zuid": "Westsluis zuid",
  "nieuwe-sluis-buitenhoofd": "Nieuwe Sluis noord",
  "nieuwe-sluis-binnenhoofd": "Nieuwe Sluis zuid",
};

export function closedDeckCopy(paints: Record<A3BridgeId, A3Paint>): string {
  const closed = A3_BRIDGE_IDS.filter((id) => paints[id] === "closed").map((id) => A6_DECK_CONSUMER[id]);
  if (closed.length === 0) return "Een oversteekplaats is momenteel dicht.";
  if (closed.length === 1) return `${closed[0]} is momenteel dicht.`;
  if (closed.length === 2) return `${closed[0]} en ${closed[1]} zijn momenteel dicht.`;
  return `${closed.slice(0, -1).join(", ")} en ${closed[closed.length - 1]} zijn momenteel dicht.`;
}

function lockIdOfBridge(id: A3BridgeId): "westsluis" | "nieuwe-sluis" | "oostsluis" {
  if (id.startsWith("oost")) return "oostsluis";
  if (id.startsWith("west")) return "westsluis";
  return "nieuwe-sluis";
}

/** Consumer line under AANBEVOLEN ROUTE. Names the confirmed corridor, not a travel time. */
export function recommendedViaLabel(via: readonly A3BridgeId[]): string {
  if (via.includes("nieuwe-sluis-buitenhoofd") || via.includes("nieuwe-sluis-binnenhoofd")) {
    return "Via Nieuwe Sluis noord";
  }
  if (via.includes("oostsluis-buitenhoofd") || via.includes("oostsluis-binnenhoofd")) {
    return "Via Oostsluis";
  }
  if (via.includes("westsluis-noord") || via.includes("westsluis-zuid")) {
    return "Via Westsluis";
  }
  return "Via bevestigde route";
}

export type A6GeoState = "idle" | "locating" | "shown" | "denied" | "unavailable" | "outside";

export function a6GeoCopy(state: A6GeoState): string | null {
  switch (state) {
    case "locating":
      return "Locatie ophalen…";
    case "denied":
      return "Locatie geweigerd. Sta toegang toe in de browser om je positie te zien.";
    case "unavailable":
      return "Locatie is nu niet beschikbaar.";
    case "outside":
      return "Je bent buiten het kaartgebied van de sluizen.";
    default:
      return null;
  }
}

export function a6PointInMaxBounds(
  lng: number,
  lat: number,
  bounds: [[number, number], [number, number]],
): boolean {
  const [[west, south], [east, north]] = bounds;
  return lng >= west && lng <= east && lat >= south && lat <= north;
}

export type A6LockEmphasis = "pop" | "dim" | "normal";

/** When a route exists: problem (closed) + solution (via) pop; unrelated lock names dim. */
export function lockEmphasis(
  lockId: string,
  via: readonly A3BridgeId[],
  paints: Record<A3BridgeId, A3Paint>,
  hasRoute: boolean,
): A6LockEmphasis {
  const closedHere = A3_BRIDGE_IDS.some((id) => lockIdOfBridge(id) === lockId && paints[id] === "closed");
  const solution = via.some((id) => lockIdOfBridge(id) === lockId);
  if (!hasRoute && !closedHere) return "normal";
  if (closedHere || solution) return "pop";
  return "dim";
}
