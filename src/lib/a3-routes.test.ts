import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { A3_ROADS, A3_ROUNDABOUTS, lineStringsOf } from "./a3-geo";
import { a3RoadGraph, haversineMeters, recommendA3Route } from "./a3-routes";
import type { LiveSnapshot } from "./types";

function live(north: "clear" | "wait" | "soon" | "unknown", south: "clear" | "wait" | "soon" | "unknown", seen = true): LiveSnapshot {
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

function onNwb(coord: [number, number], maxM = 12): boolean {
  const lines = [...lineStringsOf(A3_ROADS), ...lineStringsOf(A3_ROUNDABOUTS)];
  for (const line of lines) {
    for (const pt of line) {
      if (haversineMeters(coord, pt) <= maxM) return true;
    }
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

describe("A3 NWB route graph", () => {
  it("snaps all six RWS bridges onto NWB + roundabout geometry", () => {
    const graph = a3RoadGraph();
    assert.equal(Object.keys(graph.bridgeNode).length, 6);
    assert.ok(graph.nodes.length > 100);
  });

  it("paints the Oost corridor on NWB roads when both NDW crossings are open", () => {
    const result = recommendA3Route(live("clear", "clear", true));
    assert.equal(result.advice.showRoute, true);
    assert.ok(result.coordinates.length >= 8);
    assert.ok(result.via.includes("oostsluis-binnenhoofd"));
    assert.ok(result.via.includes("oostsluis-buitenhoofd"));
    assert.ok(!result.via.includes("westsluis-noord"));
    assert.ok(!result.via.includes("westsluis-zuid"));
    for (const coord of result.coordinates) {
      assert.ok(onNwb(coord, 16), `off NWB ${coord}`);
    }
  });

  it("does not invent a green path when both Oost crossings are closed", () => {
    const result = recommendA3Route(live("wait", "wait", true));
    assert.equal(result.advice.showRoute, false);
    assert.equal(result.coordinates.length, 0);
    assert.equal(result.advice.tone, "closed");
  });

  it("does not treat unseen DATEX clear as an open route", () => {
    const result = recommendA3Route(live("clear", "clear", false));
    assert.equal(result.advice.showRoute, false);
    assert.equal(result.coordinates.length, 0);
    assert.equal(result.paints["oostsluis-buitenhoofd"], "no-live-data");
  });

  it("keeps soon as open (road usable) with caution, still on NWB", () => {
    const result = recommendA3Route(live("soon", "clear", true));
    assert.equal(result.advice.showRoute, true);
    assert.equal(result.advice.caution, true);
    assert.ok(result.coordinates.length >= 8);
  });
});
