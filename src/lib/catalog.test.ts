import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadCatalog } from "./catalog";
import { loadTerneuzenCrossings } from "./terneuzen";

describe("catalog", () => {
  it("lists three live NDW objects and no Zelzate", () => {
    const catalog = loadCatalog();
    const slugs = catalog.bridges.map((bridge) => bridge.slug);
    assert.deepEqual(slugs, ["terneuzen", "sluiskil", "sas-van-gent"]);

    const terneuzen = catalog.bridges.find((bridge) => bridge.id === "terneuzen");
    assert.equal(terneuzen?.isrs, "NLTNZ130B20497600005");
    assert.equal(terneuzen?.kind, "lock");
    assert.equal(terneuzen?.status, "active");

    const blob = JSON.stringify(catalog).toLowerCase();
    assert.equal(blob.includes("zelzate"), false);
  });
});

describe("Terneuzen crossings catalog", () => {
  it("lists known ISRS plus OSM-only crossings and no invented codes", () => {
    const crossings = loadTerneuzenCrossings();
    const isrs = crossings.map((item) => item.isrs).filter(Boolean);
    assert.deepEqual(isrs.sort(), [
      "NLTNZ130B20497600005",
      "NLTNZ130B20497800009",
    ]);
    assert.equal(crossings.filter((item) => !item.isrs).length, 3);
    assert.equal(JSON.stringify(crossings).toLowerCase().includes("zelzate"), false);
  });
});
