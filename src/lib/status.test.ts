import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveBridgeView } from "./status";
import type { Catalog } from "./types";
import { zonedDate } from "./time";

const catalog: Catalog = {
  waterway: "Kanaal Gent–Terneuzen",
  region: "Zeeland",
  bridges: [
    {
      id: "sluiskil",
      slug: "sluiskil",
      name: "Draaibrug Sluiskil",
      shortName: "Sluiskil",
      locality: "Sluiskil",
      municipality: "Terneuzen",
      province: "Zeeland",
      country: "NL",
      waterway: "Kanaal Gent–Terneuzen",
      road: "N252",
      coordinates: { lat: 51.278, lng: 3.8365 },
      clearanceClosedM: 7,
      operator: "Rijkswaterstaat Zeeland",
      kind: "swing",
      status: "active",
      isrs: "NLTNZ001300522000264",
      vild: "17109",
    },
    {
      id: "sas-van-gent",
      slug: "sas-van-gent",
      name: "Draaibrug Sas van Gent",
      shortName: "Sas van Gent",
      locality: "Sas van Gent",
      municipality: "Terneuzen",
      province: "Zeeland",
      country: "NL",
      waterway: "Kanaal Gent–Terneuzen",
      road: "N252",
      coordinates: { lat: 51.2276, lng: 3.7989 },
      clearanceClosedM: 7,
      operator: "Rijkswaterstaat Zeeland",
      kind: "swing",
      status: "active",
      isrs: "NLSVG001300521600186",
    },
    {
      id: "terneuzen",
      slug: "terneuzen",
      name: "Noordzeesluizen Terneuzen",
      shortName: "Terneuzen",
      locality: "Terneuzen",
      municipality: "Terneuzen",
      province: "Zeeland",
      country: "NL",
      waterway: "Kanaal Gent–Terneuzen",
      road: "Buitenhaven",
      coordinates: { lat: 51.33302, lng: 3.820414 },
      clearanceClosedM: 4.3,
      operator: "Rijkswaterstaat Zeeland",
      kind: "lock",
      status: "active",
      isrs: "NLTNZ130B20497600005",
    },
  ],
  schedule: {
    timezone: "Europe/Amsterdam",
    soonWindowMinutes: 15,
    notes: "test",
    rushHolds: [
      {
        id: "morning-peak",
        bridgeIds: ["sluiskil"],
        days: [1, 2, 3, 4, 5],
        start: "07:40",
        end: "08:00",
        label: "Spitsvrij ochtend",
      },
    ],
    openings: {
      sluiskil: {
        weekday: [{ start: "09:08", end: "09:21", label: "Binnenvaart" }],
        weekend: [],
      },
      "sas-van-gent": {
        weekday: [{ start: "09:24", end: "09:37", label: "Binnenvaart" }],
        weekend: [],
      },
    },
  },
  status: {
    source: "manual",
    timezone: "Europe/Amsterdam",
    updatedAt: "2026-09-04T07:30:00+02:00",
    updatedBy: "test",
    disclaimer: "test",
    overrides: [],
  },
};

describe("deriveBridgeView", () => {
  it("ignores leftover patterned openings — they are not today's timetable", () => {
    const sluiskil = deriveBridgeView(
      catalog.bridges[0],
      catalog,
      zonedDate(2026, 9, 4, 9, 12),
    );
    const sas = deriveBridgeView(
      catalog.bridges[1],
      catalog,
      zonedDate(2026, 9, 4, 9, 30),
    );
    assert.equal(sluiskil.road, "clear");
    assert.equal(sas.road, "clear");
    assert.equal(
      sluiskil.todayEvents.some((event) => event.kind === "opening_start"),
      false,
    );
    assert.equal(
      sas.todayEvents.some((event) => event.kind === "opening_start"),
      false,
    );
    assert.equal(sluiskil.week.every((day) => day.openings.length === 0), true);
  });

  it("keeps Sluiskil clear during weekday rush hold", () => {
    const friday = zonedDate(2026, 9, 4, 7, 50);
    const view = deriveBridgeView(catalog.bridges[0], catalog, friday);
    assert.equal(view.road, "clear");
    assert.equal(view.inRushHold, true);
    assert.equal(
      view.todayEvents.some((event) => event.kind === "rush_start"),
      true,
    );
  });

  it("does not apply Sluiskil spitsvrij to Sas van Gent", () => {
    const friday = zonedDate(2026, 9, 4, 7, 50);
    const view = deriveBridgeView(catalog.bridges[1], catalog, friday);
    assert.equal(view.inRushHold, false);
    assert.equal(view.todayEvents.length, 0);
  });

  it("does not invent bedientijden or rush holds for Terneuzen", () => {
    const friday = zonedDate(2026, 9, 4, 7, 50);
    const view = deriveBridgeView(catalog.bridges[2], catalog, friday);
    assert.equal(view.inRushHold, false);
    assert.equal(view.todayEvents.length, 0);
    assert.equal(view.week.every((day) => day.openings.length === 0), true);
    assert.equal(view.road, "clear");
  });

  it("uses lock copy for a live NDW wait at Terneuzen", () => {
    const live = {
      ok: true,
      stale: false,
      fetchedAt: "2026-09-11T19:08:24.904Z",
      source: "ndw" as const,
      bridges: {
        terneuzen: {
          road: "wait" as const,
          operatorStatus: "beingImplemented",
          start: "2026-09-11T19:08:24.904Z",
          end: null,
          updatedAt: "2026-09-11T19:08:24.904Z",
          isrs: "NLTNZ130B20497600005",
          nextPlannedStart: null,
          nextPlannedEnd: null,
        },
      },
    };
    const view = deriveBridgeView(
      catalog.bridges[2],
      catalog,
      zonedDate(2026, 9, 11, 21, 10),
      live,
    );
    assert.equal(view.road, "wait");
    assert.equal(view.source, "ndw");
    assert.equal(view.bridge.isrs, "NLTNZ130B20497600005");
    assert.match(view.detail, /beweegbare brug/i);
    assert.equal(view.detail.includes("draait"), false);
  });

  it("does not invent Let op from leftover schedule openings", () => {
    const friday = zonedDate(2026, 9, 4, 9, 0);
    const view = deriveBridgeView(catalog.bridges[0], catalog, friday);
    assert.equal(view.road, "clear");
  });

  it("honours a live manual override", () => {
    const withOverride: Catalog = {
      ...catalog,
      status: {
        ...catalog.status,
        overrides: [
          {
            bridgeId: "sluiskil",
            road: "wait",
            note: "Onverwachte opening",
            updatedAt: "2026-09-04T10:00:00+02:00",
          },
        ],
      },
    };
    const view = deriveBridgeView(
      withOverride.bridges[0],
      withOverride,
      zonedDate(2026, 9, 4, 10, 5),
    );
    assert.equal(view.road, "wait");
    assert.equal(view.source, "manual");
  });

  it("lets live NDW wait override a schedule that would be clear", () => {
    const live = {
      ok: true,
      stale: false,
      fetchedAt: "2026-09-04T10:50:00.000Z",
      source: "ndw" as const,
      bridges: {
        sluiskil: {
          road: "wait" as const,
          operatorStatus: "beingImplemented",
          start: "2026-09-04T10:43:46.058Z",
          end: null,
          updatedAt: "2026-09-04T10:43:46.058Z",
          isrs: "NLTNZ001300522000264",
          nextPlannedStart: null,
          nextPlannedEnd: null,
        },
      },
    };
    const view = deriveBridgeView(
      catalog.bridges[0],
      catalog,
      zonedDate(2026, 9, 4, 10, 50),
      live,
    );
    assert.equal(view.road, "wait");
    assert.equal(view.source, "ndw");
  });

  it("lets live NDW clear override even when leftover openings would have waited", () => {
    const live = {
      ok: true,
      stale: false,
      fetchedAt: "2026-09-04T09:12:00.000Z",
      source: "ndw" as const,
      bridges: {
        sluiskil: {
          road: "clear" as const,
          operatorStatus: null,
          start: null,
          end: null,
          updatedAt: "2026-09-04T09:12:00.000Z",
          isrs: "NLTNZ001300522000264",
          nextPlannedStart: null,
          nextPlannedEnd: null,
        },
      },
    };
    const view = deriveBridgeView(
      catalog.bridges[0],
      catalog,
      zonedDate(2026, 9, 4, 9, 12),
      live,
    );
    assert.equal(view.road, "clear");
    assert.equal(view.source, "ndw");
  });

  it("keeps manual overrides above live NDW", () => {
    const withOverride: Catalog = {
      ...catalog,
      status: {
        ...catalog.status,
        overrides: [
          {
            bridgeId: "sluiskil",
            road: "clear",
            note: "Handmatig vrijgegeven",
            updatedAt: "2026-09-04T10:00:00+02:00",
          },
        ],
      },
    };
    const live = {
      ok: true,
      stale: false,
      fetchedAt: "2026-09-04T10:50:00.000Z",
      source: "ndw" as const,
      bridges: {
        sluiskil: {
          road: "wait" as const,
          operatorStatus: "implemented",
          start: "2026-09-04T10:43:00Z",
          end: null,
          updatedAt: "2026-09-04T10:43:00Z",
          isrs: "NLTNZ001300522000264",
          nextPlannedStart: null,
          nextPlannedEnd: null,
        },
      },
    };
    const view = deriveBridgeView(
      withOverride.bridges[0],
      withOverride,
      zonedDate(2026, 9, 4, 10, 50),
      live,
    );
    assert.equal(view.road, "clear");
    assert.equal(view.source, "manual");
  });
});
