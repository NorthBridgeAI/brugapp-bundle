import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUITENHAVEN_SPANS,
  DRAFT_C_NDW_PINS,
  LOCK_CHAMBERS,
  NDW_ISRS,
  complexFitBounds,
  liveSpanHits,
  routeAdvice,
  spansGeoJSON,
} from "./lock-map";
import type { LiveCrossingHit } from "./types";

function hit(
  id: string,
  road: LiveCrossingHit["road"],
  extra: Partial<LiveCrossingHit> = {},
): LiveCrossingHit {
  return {
    id,
    label: id,
    roadName: "Buitenhaven",
    coordinates: { lat: 51.33, lng: 3.82 },
    road,
    operatorStatus: null,
    start: null,
    end: null,
    updatedAt: "2026-09-14T07:00:00.000Z",
    isrs: extra.isrs ?? "",
    nextPlannedStart: null,
    nextPlannedEnd: null,
    seen: extra.seen ?? false,
    hasNdw: extra.hasNdw ?? false,
    ...extra,
  };
}

describe("lock-map NDW", () => {
  it("only uses the two catalog ISRS codes", () => {
    assert.deepEqual(NDW_ISRS, [
      "NLTNZ130B20497600005",
      "NLTNZ130B20497800009",
    ]);
    const ndwSpans = BUITENHAVEN_SPANS.filter((span) => span.hasNdw);
    assert.equal(ndwSpans.length, 2);
    assert.deepEqual(
      ndwSpans.map((span) => span.isrs).sort(),
      [...NDW_ISRS].sort(),
    );
    assert.ok(BUITENHAVEN_SPANS.every((span) => span.osmWay > 0));
  });

  it("does not invent an open path when both NDW crossings are closed", () => {
    const hits = liveSpanHits({
      ok: true,
      stale: false,
      fetchedAt: "2026-09-14T07:00:00.000Z",
      source: "ndw",
      bridges: {},
      crossings: {
        "buitenhaven-noord": hit("buitenhaven-noord", "wait", {
          hasNdw: true,
          isrs: "NLTNZ130B20497800009",
          seen: true,
        }),
        "buitenhaven-oostsluis": hit("buitenhaven-oostsluis", "wait", {
          hasNdw: true,
          isrs: "NLTNZ130B20497600005",
          seen: true,
        }),
      },
    });
    const advice = routeAdvice(hits);
    assert.equal(advice.tone, "closed");
    assert.match(advice.title, /dicht/i);
    assert.doesNotMatch(advice.title, /neem/i);
    assert.doesNotMatch(advice.detail, /neem /i);
    const colors = spansGeoJSON(hits).features.map((feature) => [
      feature.properties.id,
      feature.properties.color,
      feature.properties.hasNdw,
    ]);
    assert.deepEqual(colors, [
      ["buitenhaven-noord", "#b91c1c", 1],
      ["buitenhaven-oostsluis", "#b91c1c", 1],
      ["buitenhaven-midden", "#475569", 0],
      ["buitenhaven-westsluis", "#475569", 0],
      ["buitenhaven-zuid", "#475569", 0],
    ]);
  });

  it("paints soon NDW spans green like open, never invents extra ISRS", () => {
    const hits = liveSpanHits({
      ok: true,
      stale: false,
      fetchedAt: "2026-09-14T07:00:00.000Z",
      source: "ndw",
      bridges: {},
      crossings: {
        "buitenhaven-noord": hit("buitenhaven-noord", "soon", {
          hasNdw: true,
          isrs: "NLTNZ130B20497800009",
          seen: true,
        }),
        "buitenhaven-oostsluis": hit("buitenhaven-oostsluis", "wait", {
          hasNdw: true,
          isrs: "NLTNZ130B20497600005",
          seen: true,
        }),
      },
    });
    const geo = spansGeoJSON(hits);
    const noord = geo.features.find((feature) => feature.properties.id === "buitenhaven-noord");
    const oost = geo.features.find((feature) => feature.properties.id === "buitenhaven-oostsluis");
    assert.equal(noord?.properties.color, "#15803d");
    assert.equal(oost?.properties.color, "#b91c1c");
    assert.equal(routeAdvice(hits).tone, "mixed");
  });

  it("points at the remaining open NDW span when the other is dicht", () => {
    const hits = [
      hit("buitenhaven-noord", "clear", {
        hasNdw: true,
        isrs: "NLTNZ130B20497800009",
        label: "Buitenhaven noord",
        seen: true,
      }),
      hit("buitenhaven-oostsluis", "wait", {
        hasNdw: true,
        isrs: "NLTNZ130B20497600005",
        label: "Buitenhaven Oostsluis",
        seen: true,
      }),
      hit("buitenhaven-midden", "unknown", { hasNdw: false }),
    ];
    const advice = routeAdvice(hits);
    assert.equal(advice.tone, "mixed");
    assert.match(advice.title, /Buitenhaven noord/);
    assert.match(advice.detail, /Buitenhaven Oostsluis/);
  });
});

describe("complex camera fit", () => {
  function inside(
    bounds: [[number, number], [number, number]],
    lng: number,
    lat: number,
  ) {
    const [[west, south], [east, north]] = bounds;
    return lng >= west && lng <= east && lat >= south && lat <= north;
  }

  it("covers Westsluis, Nieuwe Sluis, Oostsluis and both NDW bars (Draft C bar)", () => {
    for (const compact of [true, false]) {
      const bounds = complexFitBounds(compact);
      for (const chamber of LOCK_CHAMBERS) {
        assert.ok(
          inside(bounds, chamber.coordinates.lng, chamber.coordinates.lat),
          `${chamber.id} @ ${compact ? "390" : "desktop"}`,
        );
      }
      for (const pin of DRAFT_C_NDW_PINS) {
        assert.ok(inside(bounds, pin.lng, pin.lat), `ndw pin ${pin.lat}`);
      }
      for (const span of BUITENHAVEN_SPANS.filter((item) => item.hasNdw)) {
        for (const [lng, lat] of span.coords) {
          assert.ok(inside(bounds, lng, lat), span.id);
        }
      }
    }
  });

  it("places span labels on the OSM road, not the catalog lock coordinate", () => {
    const hits = liveSpanHits({
      ok: true,
      stale: false,
      fetchedAt: "2026-09-14T07:00:00.000Z",
      source: "ndw",
      bridges: {},
      crossings: {
        "buitenhaven-oostsluis": hit("buitenhaven-oostsluis", "wait", {
          hasNdw: true,
          isrs: "NLTNZ130B20497600005",
          coordinates: { lat: 51.33302, lng: 3.820414 },
        }),
      },
    });
    const oost = hits.find((item) => item.id === "buitenhaven-oostsluis");
    const span = BUITENHAVEN_SPANS.find((item) => item.id === "buitenhaven-oostsluis");
    assert.ok(oost && span);
    const midLat = (span.coords[0][1] + span.coords[1][1]) / 2;
    const midLng = (span.coords[0][0] + span.coords[1][0]) / 2;
    assert.equal(oost.coordinates.lat, midLat);
    assert.equal(oost.coordinates.lng, midLng);
  });
});
