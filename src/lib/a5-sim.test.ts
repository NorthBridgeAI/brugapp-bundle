import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { A3_BRIDGE_IDS, emptyPaints } from "./a3-status";
import { recommendOpenCorridor } from "./a3-routes";
import { haversineMeters } from "./a3-routes";
import { A3_ROADS, A3_ROUNDABOUTS, lineStringsOf } from "./a3-geo";
import {
  SCENARIO_B,
  applySimPaints,
  parseSimSearch,
  resolveA5Route,
  simSearchString,
  simToPaint,
} from "./a5-sim";
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

describe("A5 client-only simulation", () => {
  it("maps STALE to no-live-data paint and never writes DATEX", () => {
    assert.equal(simToPaint("stale"), "no-live-data");
    const applied = applySimPaints(emptyPaints(), { "oostsluis-binnenhoofd": "stale" });
    assert.equal(applied.paints["oostsluis-binnenhoofd"], "no-live-data");
    assert.deepEqual(applied.staleIds, ["oostsluis-binnenhoofd"]);
    assert.equal(applied.simulated, true);
  });

  it("parses ?debug=1 and per-bridge overrides from the query string", () => {
    const parsed = parseSimSearch("?debug=1&nieuwe-sluis-buitenhoofd=open&preset=b");
    assert.equal(parsed.debug, true);
    assert.equal(parsed.overrides["nieuwe-sluis-buitenhoofd"], "open");
    assert.equal(parsed.overrides["oostsluis-binnenhoofd"], "closed");
    assert.ok(simSearchString(true, SCENARIO_B).includes("debug=1"));
  });

  it("leaves A4-style live routing alone when no overrides are set", () => {
    const result = resolveA5Route(live("wait", "wait"), {});
    assert.equal(result.simulated, false);
    assert.equal(result.advice.showRoute, false);
    assert.equal(result.paints["westsluis-noord"], "no-live-data");
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

  it("QA scenario B: Nieuwe OPEN draws an NWB detour without touching live NDW", () => {
    const result = resolveA5Route(live("wait", "wait"), SCENARIO_B);
    assert.equal(result.simulated, true);
    assert.equal(result.paints["nieuwe-sluis-buitenhoofd"], "open");
    assert.equal(result.paints["oostsluis-binnenhoofd"], "closed");
    assert.equal(result.advice.showRoute, true);
    assert.ok(result.via.includes("nieuwe-sluis-buitenhoofd"));
    assert.ok(result.via.includes("nieuwe-sluis-binnenhoofd"));
    assert.ok(!result.via.includes("oostsluis-binnenhoofd"));
    assert.ok(result.coordinates.length >= 8);
    for (const coord of result.coordinates) {
      assert.ok(onNwb(coord, 18), `off NWB ${coord}`);
    }
    for (const id of A3_BRIDGE_IDS) {
      if (id.startsWith("westsluis")) assert.equal(result.paints[id], "no-live-data");
    }
  });
});
