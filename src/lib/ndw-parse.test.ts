import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interpretRecord,
  isTerneuzenComplexRecord,
  mapRecordsToBridges,
  mapTerneuzenCrossings,
  parseBridgeSwingRecords,
} from "./ndw-parse";
import { loadTerneuzenCrossings } from "./terneuzen";
import type { Bridge } from "./types";

const SLUISKIL_SITUATION = `<sit:situation id="ODS01_NLTNZ001300522000264_555974124"><sit:overallSeverity>unknown</sit:overallSeverity><sit:situationVersionTime>2026-09-04T10:43:46.058976383Z</sit:situationVersionTime><sit:headerInformation><com:confidentiality>noRestriction</com:confidentiality><com:informationStatus>real</com:informationStatus></sit:headerInformation><sit:situationRecord xsi:type="sit:GeneralNetworkManagement" id="ODS01_NLTNZ001300522000264_555974124_01" version="1"><sit:situationRecordCreationTime>2026-09-04T10:43:46.058976383Z</sit:situationRecordCreationTime><sit:situationRecordVersionTime>2026-09-04T10:43:46.058976383Z</sit:situationRecordVersionTime><sit:probabilityOfOccurrence>certain</sit:probabilityOfOccurrence><sit:source><com:sourceName><com:values><com:value lang="nl">ODS01</com:value></com:values></com:sourceName></sit:source><sit:validity><com:validityStatus>definedByValidityTimeSpec</com:validityStatus><com:validityTimeSpecification><com:overallStartTime>2026-09-04T10:43:46.058976383Z</com:overallStartTime></com:validityTimeSpecification></sit:validity><sit:locationReference xsi:type="loc:PointLocation"><loc:externalReferencing><loc:externalLocationCode>NLTNZ001300522000264</loc:externalLocationCode><loc:externalReferencingSystem>RIS-index</loc:externalReferencingSystem></loc:externalReferencing><loc:alertCPoint xsi:type="loc:AlertCMethod2Point"><loc:alertCMethod2PrimaryPointLocation><loc:alertCLocation><loc:specificLocation>17109</loc:specificLocation></loc:alertCLocation></loc:alertCMethod2PrimaryPointLocation></loc:alertCPoint></sit:locationReference><sit:operatorActionStatus>beingImplemented</sit:operatorActionStatus><sit:generalNetworkManagementType>bridgeSwingInOperation</sit:generalNetworkManagementType></sit:situationRecord></sit:situation>`;

const SAS_PLANNED = SLUISKIL_SITUATION
  .replaceAll("NLTNZ001300522000264", "NLSVG001300521600186")
  .replaceAll("beingImplemented", "approved")
  .replaceAll("2026-09-04T10:43:46.058976383Z", "2026-09-04T12:00:00Z")
  .replaceAll(">17109<", ">99999<")
  .replace(
    "</com:overallStartTime>",
    "</com:overallStartTime><com:overallEndTime>2026-09-04T12:12:00Z</com:overallEndTime>",
  );

const sluiskil: Bridge = {
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
};

const sas: Bridge = {
  ...sluiskil,
  id: "sas-van-gent",
  slug: "sas-van-gent",
  name: "Draaibrug Sas van Gent",
  shortName: "Sas van Gent",
  locality: "Sas van Gent",
  isrs: "NLSVG001300521600186",
  vild: undefined,
};

const terneuzen: Bridge = {
  ...sluiskil,
  id: "terneuzen",
  slug: "terneuzen",
  name: "Noordzeesluizen Terneuzen",
  shortName: "Terneuzen",
  locality: "Terneuzen",
  kind: "lock",
  isrs: "NLTNZ130B20497600005",
  vild: undefined,
};

describe("NDW DATEX parse", () => {
  it("parses the live Sluiskil swing record from NDW", () => {
    const records = parseBridgeSwingRecords(SLUISKIL_SITUATION);
    assert.equal(records.length, 1);
    assert.equal(records[0].isrs, "NLTNZ001300522000264");
    assert.equal(records[0].vild, "17109");
    assert.equal(records[0].managementType, "bridgeSwingInOperation");
    assert.equal(records[0].operatorStatus, "beingImplemented");
  });

  it("maps beingImplemented after start to wait (road closed)", () => {
    const records = parseBridgeSwingRecords(SLUISKIL_SITUATION);
    const now = new Date("2026-09-04T10:50:00Z");
    const hits = mapRecordsToBridges(records, [sluiskil, sas], now);
    assert.equal(hits.sluiskil.road, "wait");
    assert.equal(hits["sas-van-gent"].road, "clear");
  });

  it("maps the Noordzeesluizen ISRS independently of Sluiskil", () => {
    const xml = SLUISKIL_SITUATION.replaceAll(
      "NLTNZ001300522000264",
      "NLTNZ130B20497600005",
    ).replaceAll(">17109<", ">00000<");
    const records = parseBridgeSwingRecords(xml);
    const now = new Date("2026-09-04T10:50:00Z");
    const hits = mapRecordsToBridges(records, [sluiskil, sas, terneuzen], now);
    assert.equal(hits.terneuzen.road, "wait");
    assert.equal(hits.terneuzen.isrs, "NLTNZ130B20497600005");
    assert.equal(hits.sluiskil.road, "clear");
    assert.equal(hits["sas-van-gent"].road, "clear");
  });

  it("maps approved openings in the soon window to Let op", () => {
    const records = parseBridgeSwingRecords(SAS_PLANNED);
    const now = new Date("2026-09-04T11:50:00Z");
    const hits = mapRecordsToBridges(records, [sluiskil, sas], now);
    assert.equal(hits["sas-van-gent"].road, "soon");
    assert.equal(hits.sluiskil.road, "clear");
  });

  it("treats ended openings as clear", () => {
    const kind = interpretRecord(
      {
        isrs: "NLSVG001300521600186",
        vild: null,
        managementType: "bridgeSwingInOperation",
        operatorStatus: "implemented",
        start: "2026-09-04T10:00:00Z",
        end: "2026-09-04T10:12:00Z",
        updatedAt: "2026-09-04T10:12:00Z",
        lat: null,
        lng: null,
      },
      Date.parse("2026-09-04T10:20:00Z"),
    );
    assert.equal(kind, null);
  });

  it("parses DATEX coordinates on a Buitenhaven record", () => {
    const xml = SLUISKIL_SITUATION.replaceAll(
      "NLTNZ001300522000264",
      "NLTNZ130B20497800009",
    )
      .replaceAll(">17109<", ">00000<")
      .replace(
        "</loc:externalReferencing>",
        "</loc:externalReferencing><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>51.336056</loc:latitude><loc:longitude>3.819774</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates>",
      );
    const records = parseBridgeSwingRecords(xml);
    assert.equal(records[0].lat, 51.336056);
    assert.equal(records[0].lng, 3.819774);
    assert.equal(isTerneuzenComplexRecord(records[0]), true);
  });

  it("aggregates any NLTNZ130* onto the Terneuzen catalog object", () => {
    const xml = SLUISKIL_SITUATION.replaceAll(
      "NLTNZ001300522000264",
      "NLTNZ130B20497800009",
    )
      .replaceAll(">17109<", ">00000<")
      .replace(
        "</loc:externalReferencing>",
        "</loc:externalReferencing><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>51.336056</loc:latitude><loc:longitude>3.819774</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates>",
      );
    const records = parseBridgeSwingRecords(xml);
    const now = new Date("2026-09-04T10:50:00Z");
    const hits = mapRecordsToBridges(records, [sluiskil, sas, terneuzen], now);
    assert.equal(hits.terneuzen.road, "wait");
    assert.equal(hits.terneuzen.isrs, "NLTNZ130B20497800009");
    assert.equal(hits.terneuzen.seen, true);
    assert.equal(hits.sluiskil.road, "clear");
    assert.equal(hits["sas-van-gent"].road, "clear");
  });

  it("treats bbox coordinates as Terneuzen-complex even without NLTNZ130", () => {
    const record = {
      isrs: "NLXXXX999999999999999",
      vild: null,
      managementType: "bridgeSwingInOperation",
      operatorStatus: "beingImplemented",
      start: "2026-09-04T10:43:46.058976383Z",
      end: null,
      updatedAt: "2026-09-04T10:43:46.058976383Z",
      lat: 51.336,
      lng: 3.82,
    };
    assert.equal(isTerneuzenComplexRecord(record), true);
    const now = new Date("2026-09-04T10:50:00Z");
    const hits = mapRecordsToBridges([record], [terneuzen, sluiskil], now);
    assert.equal(hits.terneuzen.road, "wait");
    assert.equal(hits.sluiskil.road, "clear");
  });

  it("does not treat Sluiskil as a Terneuzen-complex object", () => {
    const records = parseBridgeSwingRecords(SLUISKIL_SITUATION);
    assert.equal(isTerneuzenComplexRecord(records[0]), false);
  });

  it("maps catalog crossings: live NDW, catalog-only, and OSM-unknown", () => {
    const xml = SLUISKIL_SITUATION.replaceAll(
      "NLTNZ001300522000264",
      "NLTNZ130B20497800009",
    )
      .replaceAll(">17109<", ">00000<")
      .replace(
        "</loc:externalReferencing>",
        "</loc:externalReferencing><loc:pointByCoordinates><loc:pointCoordinates><loc:latitude>51.336056</loc:latitude><loc:longitude>3.819774</loc:longitude></loc:pointCoordinates></loc:pointByCoordinates>",
      );
    const records = parseBridgeSwingRecords(xml);
    const now = new Date("2026-09-04T10:50:00Z");
    const crossings = mapTerneuzenCrossings(
      records,
      loadTerneuzenCrossings(),
      now,
    );
    assert.equal(crossings["buitenhaven-noord"].road, "wait");
    assert.equal(crossings["buitenhaven-noord"].seen, true);
    assert.equal(crossings["buitenhaven-noord"].hasNdw, true);
    assert.equal(crossings["buitenhaven-oostsluis"].road, "clear");
    assert.equal(crossings["buitenhaven-oostsluis"].seen, false);
    assert.equal(crossings["buitenhaven-oostsluis"].hasNdw, true);
    assert.equal(crossings["buitenhaven-zuid"].road, "unknown");
    assert.equal(crossings["buitenhaven-zuid"].hasNdw, false);
  });

  it("appends an unknown live NLTNZ130* as an extra crossing", () => {
    const xml = SLUISKIL_SITUATION.replaceAll(
      "NLTNZ001300522000264",
      "NLTNZ130B20999900001",
    ).replaceAll(">17109<", ">00000<");
    const records = parseBridgeSwingRecords(xml);
    const now = new Date("2026-09-04T10:50:00Z");
    const crossings = mapTerneuzenCrossings(
      records,
      loadTerneuzenCrossings(),
      now,
    );
    const extra = crossings["ndw-nltnz130b20999900001"];
    assert.ok(extra);
    assert.equal(extra.road, "wait");
    assert.equal(extra.seen, true);
    assert.equal(extra.hasNdw, true);
  });
});
