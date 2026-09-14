import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { A3_BRIDGE_IDS, emptyPaints } from "./a3-status";
import { recommendOpenCorridor } from "./a3-routes";
import { haversineMeters } from "./a3-routes";
import { A3_ROADS, A3_ROUNDABOUTS, lineStringsOf } from "./a3-geo";
import {
  SCENARIO_ALL_OPEN,
  SCENARIO_OOST_Z,
  SCENARIO_UNKNOWN,
  closedDeckCopy,
  parseA6SimSearch,
  resolveA6Route,
} from "./a6-sim";
import type { LiveSnapshot } from "./types";

function onNwb(coord: [number, number], maxM = 16): boolean {
  const lines = [...lineStringsOf(A3_ROADS), ...lineStringsOf(A3_ROUNDABOUTS)];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((coord[0] - a[0]) * dx + (coord[1] - a[1]) * dy) / l2));
      const q: [number, number] = [a[0] + t * dx, a[1] + t * dy];
      if (haversineMeters(coord, q) <= maxM) return true;
    }
  }
  return false;
}

function live(north: "clear" | "wait", south: "clear" | "wait", seen = true): LiveSnapshot {
  return {
    ok: true,
    stale: false,
    fetchedAt: "2026-09-14T09:00:00.000Z",
    source: "ndw",
    bridges: {},
    crossings: {
      n: {
        id: "n",
        label: "Oost N",
        roadName: "Buitenhaven",
        coordinates: { lat: 51.3361, lng: 3.8198 },
        road: north,
        operatorStatus: null,
        start: null,
        end: null,
        updatedAt: "2026-09-14T09:00:00.000Z",
        isrs: "NLTNZ130B20497800009",
        nextPlannedStart: null,
        nextPlannedEnd: null,
        seen,
        hasNdw: true,
      },
      s: {
        id: "s",
        label: "Oost Z",
        roadName: "Buitenhaven",
        coordinates: { lat: 51.333, lng: 3.8204 },
        road: south,
        operatorStatus: null,
        start: null,
        end: null,
        updatedAt: "2026-09-14T09:00:00.000Z",
        isrs: "NLTNZ130B20497600005",
        nextPlannedStart: null,
        nextPlannedEnd: null,
        seen,
        hasNdw: true,
      },
    },
  };
}

describe("A6 client-only simulation", () => {
  it("parses QA presets A/B/C from ?debug=1", () => {
    const a = parseA6SimSearch("?debug=1&preset=a");
    assert.equal(a.debug, true);
    for (const id of A3_BRIDGE_IDS) assert.equal(a.overrides[id], "no-live-data");

    const b = parseA6SimSearch("?debug=1&preset=b");
    assert.equal(b.overrides["oostsluis-binnenhoofd"], "closed");
    assert.equal(b.overrides["nieuwe-sluis-buitenhoofd"], "open");
    assert.equal(b.overrides["nieuwe-sluis-binnenhoofd"], "open");

    const c = parseA6SimSearch("?debug=1&preset=c");
    for (const id of A3_BRIDGE_IDS) assert.equal(c.overrides[id], "open");
  });

  it("QA A: all-unknown never confirms a route", () => {
    const result = resolveA6Route(live("wait", "wait"), SCENARIO_UNKNOWN);
    assert.equal(result.simulated, true);
    assert.equal(result.advice.showRoute, false);
    assert.equal(result.advice.tone, "no-live-data");
    assert.equal(result.coordinates.length, 0);
  });

  it("QA B: Oost Z closed + Nieuwe OPEN draws an NWB detour without touching live NDW", () => {
    const result = resolveA6Route(live("wait", "wait"), SCENARIO_OOST_Z);
    assert.equal(result.simulated, true);
    assert.equal(result.paints["oostsluis-binnenhoofd"], "closed");
    assert.equal(result.paints["nieuwe-sluis-buitenhoofd"], "open");
    assert.equal(result.advice.showRoute, true);
    assert.ok(result.via.includes("nieuwe-sluis-buitenhoofd"));
    assert.ok(result.via.includes("nieuwe-sluis-binnenhoofd"));
    assert.ok(!result.via.includes("oostsluis-binnenhoofd"));
    assert.ok(result.coordinates.length >= 8);
    for (const coord of result.coordinates) {
      assert.ok(onNwb(coord, 18), `off NWB ${coord}`);
    }
  });

  it("QA C: all-open recommends one corridor (Oost), not every lock", () => {
    const result = resolveA6Route(live("clear", "clear"), SCENARIO_ALL_OPEN);
    assert.equal(result.simulated, true);
    assert.equal(result.advice.showRoute, true);
    assert.ok(result.via.includes("oostsluis-buitenhoofd"));
    assert.ok(result.via.includes("oostsluis-binnenhoofd"));
    assert.ok(!result.via.includes("westsluis-noord"));
    assert.ok(!result.via.includes("nieuwe-sluis-buitenhoofd"));
  });

  it("does not invent a West/NS detour from missing ISRS on live paints", () => {
    const paints = emptyPaints();
    paints["oostsluis-buitenhoofd"] = "closed";
    paints["oostsluis-binnenhoofd"] = "closed";
    const result = recommendOpenCorridor(paints, { oostNorth: false, oostSouth: false });
    assert.equal(result.advice.showRoute, false);
    assert.equal(result.coordinates.length, 0);
    assert.ok(!result.via.includes("westsluis-noord"));
    assert.ok(!result.via.includes("nieuwe-sluis-buitenhoofd"));
  });

  it("consumer closed copy names Oostsluis zuid", () => {
    const paints = emptyPaints();
    paints["oostsluis-binnenhoofd"] = "closed";
    assert.equal(closedDeckCopy(paints), "Oostsluis zuid is momenteel dicht.");
  });
});
