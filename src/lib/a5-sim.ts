import { A3_BRIDGE_IDS, type A3BridgeId, type A3Paint, bridgePaints, ndwCaution } from "./a3-status";
import { recommendA3Route, recommendOpenCorridor, type A3RouteResult } from "./a3-routes";
import type { LiveSnapshot } from "./types";

export type SimPaint = A3Paint | "stale";

export type SimOverrides = Partial<Record<A3BridgeId, SimPaint>>;

export const SIM_PAINTS: SimPaint[] = ["open", "closed", "no-live-data", "stale"];

export const SIM_PAINT_LABEL: Record<SimPaint, string> = {
  open: "OPEN",
  closed: "DICHT",
  "no-live-data": "GEEN DATA",
  stale: "STALE",
};

export const A5_BRIDGE_LABEL: Record<A3BridgeId, string> = {
  "oostsluis-buitenhoofd": "Oost N",
  "oostsluis-binnenhoofd": "Oost Z",
  "westsluis-noord": "West N",
  "westsluis-zuid": "West Z",
  "nieuwe-sluis-buitenhoofd": "Nieuwe N",
  "nieuwe-sluis-binnenhoofd": "Nieuwe Z",
};

/** QA scenario B: Oost dicht, Nieuwe beide OPEN → NWB-detour without inventing DATEX. */
export const SCENARIO_B: SimOverrides = {
  "oostsluis-buitenhoofd": "closed",
  "oostsluis-binnenhoofd": "closed",
  "westsluis-noord": "no-live-data",
  "westsluis-zuid": "no-live-data",
  "nieuwe-sluis-buitenhoofd": "open",
  "nieuwe-sluis-binnenhoofd": "open",
};

export function simToPaint(value: SimPaint): A3Paint {
  return value === "stale" ? "no-live-data" : value;
}

export function applySimPaints(
  livePaints: Record<A3BridgeId, A3Paint>,
  overrides: SimOverrides,
): { paints: Record<A3BridgeId, A3Paint>; staleIds: A3BridgeId[]; simulated: boolean } {
  const paints = { ...livePaints };
  const staleIds: A3BridgeId[] = [];
  let simulated = false;
  for (const id of A3_BRIDGE_IDS) {
    const override = overrides[id];
    if (!override) continue;
    simulated = true;
    paints[id] = simToPaint(override);
    if (override === "stale") staleIds.push(id);
  }
  return { paints, staleIds, simulated };
}

export function parseSimSearch(search: string): { debug: boolean; overrides: SimOverrides } {
  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const debug = query.get("debug") === "1";
  const overrides: SimOverrides = {};
  if (query.get("preset") === "b") Object.assign(overrides, SCENARIO_B);
  for (const id of A3_BRIDGE_IDS) {
    const raw = query.get(id) ?? query.get(`sim.${id}`);
    if (raw === "open" || raw === "closed" || raw === "stale") overrides[id] = raw;
    else if (raw === "no-live-data" || raw === "nodata" || raw === "none") {
      overrides[id] = "no-live-data";
    }
  }
  return { debug, overrides };
}

export function simSearchString(debug: boolean, overrides: SimOverrides): string {
  const query = new URLSearchParams();
  if (debug) query.set("debug", "1");
  for (const id of A3_BRIDGE_IDS) {
    const value = overrides[id];
    if (value) query.set(id, value);
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

export interface A5RouteResult extends A3RouteResult {
  simulated: boolean;
  staleIds: A3BridgeId[];
}

export function resolveA5Route(
  live: LiveSnapshot | null | undefined,
  overrides: SimOverrides,
): A5RouteResult {
  const livePaints = bridgePaints(live);
  const { paints, staleIds, simulated } = applySimPaints(livePaints, overrides);
  if (!simulated) {
    return { ...recommendA3Route(live), simulated: false, staleIds: [] };
  }
  return {
    ...recommendOpenCorridor(paints, ndwCaution(live)),
    simulated: true,
    staleIds,
  };
}
