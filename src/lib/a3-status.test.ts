import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  A3_BRIDGE_IDS,
  A3_NDW_ISRS,
  bridgePaints,
  paintFromHit,
  routeAdviceFromPaints,
} from "./a3-status";
import type { LiveSnapshot } from "./types";

function snapshot(crossings: LiveSnapshot["crossings"]): LiveSnapshot {
  return {
    ok: true,
    stale: false,
    fetchedAt: "2026-09-14T09:00:00.000Z",
    source: "ndw",
    bridges: {},
    crossings,
  };
}

describe("A3 status adapter", () => {
  it("maps only the two confirmed ISRS codes to Oostsluis N/S", () => {
    assert.equal(A3_NDW_ISRS["oostsluis-buitenhoofd"], "NLTNZ130B20497800009");
    assert.equal(A3_NDW_ISRS["oostsluis-binnenhoofd"], "NLTNZ130B20497600005");
    assert.equal(A3_BRIDGE_IDS.length, 6);
  });

  it("never paints unseen DATEX clear as open (must-fix High)", () => {
    assert.equal(
      paintFromHit({ road: "clear", seen: false }, { hasNdw: true }),
      "no-live-data",
    );
    assert.equal(
      paintFromHit({ road: "clear", seen: undefined }, { hasNdw: true }),
      "no-live-data",
    );
    assert.equal(paintFromHit(null, { hasNdw: true }), "no-live-data");
    assert.equal(
      paintFromHit({ road: "unknown", seen: true }, { hasNdw: true }),
      "no-live-data",
    );
    assert.equal(
      paintFromHit({ road: "clear", seen: false }, { hasNdw: false }),
      "no-live-data",
    );
  });

  it("paints seen wait as closed and seen clear/soon as open", () => {
    assert.equal(
      paintFromHit({ road: "wait", seen: true }, { hasNdw: true }),
      "closed",
    );
    assert.equal(
      paintFromHit({ road: "clear", seen: true }, { hasNdw: true }),
      "open",
    );
    assert.equal(
      paintFromHit({ road: "soon", seen: true }, { hasNdw: true }),
      "open",
    );
  });

  it("flags Westsluis and Nieuwe Sluis as NO LIVE DATA even if DATEX is clear", () => {
    const paints = bridgePaints(
      snapshot({
        "buitenhaven-noord": {
          id: "buitenhaven-noord",
          label: "Buitenhaven noord",
          roadName: "Buitenhaven",
          coordinates: { lat: 51.3361, lng: 3.8198 },
          road: "clear",
          operatorStatus: null,
          start: null,
          end: null,
          updatedAt: "2026-09-14T09:00:00.000Z",
          isrs: "NLTNZ130B20497800009",
          nextPlannedStart: null,
          nextPlannedEnd: null,
          seen: true,
          hasNdw: true,
        },
        "buitenhaven-oostsluis": {
          id: "buitenhaven-oostsluis",
          label: "Buitenhaven Oostsluis",
          roadName: "Buitenhaven",
          coordinates: { lat: 51.333, lng: 3.8204 },
          road: "clear",
          operatorStatus: null,
          start: null,
          end: null,
          updatedAt: "2026-09-14T09:00:00.000Z",
          isrs: "NLTNZ130B20497600005",
          nextPlannedStart: null,
          nextPlannedEnd: null,
          seen: true,
          hasNdw: true,
        },
      }),
    );
    assert.equal(paints["oostsluis-buitenhoofd"], "open");
    assert.equal(paints["oostsluis-binnenhoofd"], "open");
    assert.equal(paints["westsluis-noord"], "no-live-data");
    assert.equal(paints["westsluis-zuid"], "no-live-data");
    assert.equal(paints["nieuwe-sluis-buitenhoofd"], "no-live-data");
    assert.equal(paints["nieuwe-sluis-binnenhoofd"], "no-live-data");
  });

  it("does not recommend a green route when both Oost crossings are closed", () => {
    const paints = bridgePaints(
      snapshot({
        n: {
          id: "n",
          label: "n",
          roadName: "Buitenhaven",
          coordinates: { lat: 51.3361, lng: 3.8198 },
          road: "wait",
          operatorStatus: "beingImplemented",
          start: null,
          end: null,
          updatedAt: "2026-09-14T09:00:00.000Z",
          isrs: "NLTNZ130B20497800009",
          nextPlannedStart: null,
          nextPlannedEnd: null,
          seen: true,
          hasNdw: true,
        },
        s: {
          id: "s",
          label: "s",
          roadName: "Buitenhaven",
          coordinates: { lat: 51.333, lng: 3.8204 },
          road: "wait",
          operatorStatus: "beingImplemented",
          start: null,
          end: null,
          updatedAt: "2026-09-14T09:00:00.000Z",
          isrs: "NLTNZ130B20497600005",
          nextPlannedStart: null,
          nextPlannedEnd: null,
          seen: true,
          hasNdw: true,
        },
      }),
    );
    const advice = routeAdviceFromPaints(paints, {
      oostNorth: false,
      oostSouth: false,
    });
    assert.equal(advice.showRoute, false);
    assert.equal(advice.tone, "closed");
    assert.doesNotMatch(advice.detail, /omweg groen|neem west/i);
  });
});
