import type {
  Bridge,
  CrossingDef,
  LiveBridgeHit,
  LiveCrossingHit,
  LiveSnapshot,
  RoadStatus,
} from "./types";

export const NDW_SOON_MS = 15 * 60_000;

export const TERNEUZEN_COMPLEX = {
  isrsPrefix: "NLTNZ130",
  latMin: 51.325,
  latMax: 51.342,
  lngMin: 3.812,
  lngMax: 3.828,
} as const;

const RANK: Record<RoadStatus, number> = {
  wait: 3,
  soon: 2,
  unknown: 1,
  clear: 0,
};

export interface NdwRecord {
  isrs: string | null;
  vild: string | null;
  managementType: string | null;
  operatorStatus: string | null;
  start: string | null;
  end: string | null;
  updatedAt: string | null;
  lat: number | null;
  lng: number | null;
}

function localTag(xml: string, name: string): string | null {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${name}>([^<]*)</(?:[\\w.-]+:)?${name}>`,
  );
  return xml.match(re)?.[1]?.trim() || null;
}

/** DATEX II/III situation blocks that mention a bridge swing. */
export function parseBridgeSwingRecords(xml: string): NdwRecord[] {
  const records: NdwRecord[] = [];
  const situationRe = /<sit:situation\b[\s\S]*?<\/sit:situation>/g;
  for (const match of xml.matchAll(situationRe)) {
    const block = match[0];
    if (!block.includes("bridgeSwingInOperation")) continue;
    records.push({
      isrs: localTag(block, "externalLocationCode"),
      vild: localTag(block, "specificLocation"),
      managementType: localTag(block, "generalNetworkManagementType"),
      operatorStatus: localTag(block, "operatorActionStatus"),
      start: localTag(block, "overallStartTime"),
      end: localTag(block, "overallEndTime"),
      updatedAt:
        localTag(block, "situationRecordVersionTime") ??
        localTag(block, "situationVersionTime"),
      lat: parseCoord(localTag(block, "latitude")),
      lng: parseCoord(localTag(block, "longitude")),
    });
  }
  return records;
}

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function parseCoord(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

export function inTerneuzenBbox(lat: number, lng: number): boolean {
  return (
    lat >= TERNEUZEN_COMPLEX.latMin &&
    lat <= TERNEUZEN_COMPLEX.latMax &&
    lng >= TERNEUZEN_COMPLEX.lngMin &&
    lng <= TERNEUZEN_COMPLEX.lngMax
  );
}

export function isTerneuzenComplexIsrs(isrs: string | null | undefined): boolean {
  return Boolean(isrs?.startsWith(TERNEUZEN_COMPLEX.isrsPrefix));
}

export function isTerneuzenComplexRecord(record: NdwRecord): boolean {
  if (isTerneuzenComplexIsrs(record.isrs)) return true;
  if (record.lat !== null && record.lng !== null) {
    return inTerneuzenBbox(record.lat, record.lng);
  }
  return false;
}

function recordMatchesBridge(record: NdwRecord, bridge: Bridge): boolean {
  if (bridge.id === "terneuzen") return isTerneuzenComplexRecord(record);
  if (bridge.isrs && record.isrs === bridge.isrs) return true;
  if (bridge.vild && record.vild === bridge.vild) return true;
  return false;
}

/**
 * Car-first mapping:
 * bridgeSwingInOperation with an active window = road closed (Wachten).
 * beingImplemented before start = transitioning (Let op).
 * approved in the 15-minute window = Let op.
 */
export function interpretRecord(
  record: NdwRecord,
  nowMs: number,
  soonMs = NDW_SOON_MS,
): RoadStatus | "planned" | null {
  if (record.managementType !== "bridgeSwingInOperation") return null;
  const start = parseTime(record.start);
  const end = parseTime(record.end);
  if (end !== null && nowMs >= end) return null;

  const status = record.operatorStatus ?? "";
  const started = start !== null && start <= nowMs;
  const upcoming = start !== null && start > nowMs;

  if (status === "implemented" || status === "beingTerminated") {
    return started || start === null ? "wait" : "soon";
  }
  if (status === "beingImplemented") {
    if (upcoming) return "soon";
    return "wait";
  }
  if (status === "approved") {
    if (started) return "wait";
    if (upcoming && start! - nowMs <= soonMs) return "soon";
    if (upcoming) return "planned";
    return null;
  }
  if (started) return "wait";
  return null;
}

export function mapRecordsToBridges(
  records: NdwRecord[],
  bridges: Bridge[],
  now: Date,
  soonMs = NDW_SOON_MS,
): Record<string, LiveBridgeHit> {
  const out: Record<string, LiveBridgeHit> = {};

  for (const bridge of bridges) {
    if (!bridge.isrs && !bridge.vild) continue;
    const mine = records.filter((record) => recordMatchesBridge(record, bridge));
    out[bridge.id] = pickHitFromRecords(
      mine,
      now,
      soonMs,
      bridge.isrs ?? "",
      bridge.coordinates,
    );
  }

  return out;
}

function pickHitFromRecords(
  records: NdwRecord[],
  now: Date,
  soonMs: number,
  fallbackIsrs: string,
  fallbackCoords?: { lat: number; lng: number },
): LiveBridgeHit {
  const nowMs = now.getTime();
  let road: RoadStatus = "clear";
  let chosen: NdwRecord | null = null;
  let nextPlannedStart: string | null = null;
  let nextPlannedEnd: string | null = null;
  let nextPlannedMs = Infinity;

  for (const record of records) {
    const kind = interpretRecord(record, nowMs, soonMs);
    const startMs = parseTime(record.start);
    if (kind === "planned" && startMs !== null && startMs < nextPlannedMs) {
      nextPlannedMs = startMs;
      nextPlannedStart = record.start;
      nextPlannedEnd = record.end;
    }
    if (kind === "wait" || kind === "soon") {
      if (RANK[kind] > RANK[road]) {
        road = kind;
        chosen = record;
      }
    }
  }

  if (road === "clear") {
    for (const record of records) {
      const startMs = parseTime(record.start);
      if (startMs !== null && startMs > nowMs && startMs < nextPlannedMs) {
        nextPlannedMs = startMs;
        nextPlannedStart = record.start;
        nextPlannedEnd = record.end;
      }
    }
  }

  const coords =
    chosen?.lat !== null && chosen?.lng !== null && chosen
      ? { lat: chosen.lat, lng: chosen.lng }
      : records.find((record) => record.lat !== null && record.lng !== null)
        ? {
            lat: records.find((record) => record.lat !== null)!.lat!,
            lng: records.find((record) => record.lng !== null)!.lng!,
          }
        : fallbackCoords;

  return {
    road,
    operatorStatus: chosen?.operatorStatus ?? null,
    start: chosen?.start ?? null,
    end: chosen?.end ?? null,
    updatedAt: chosen?.updatedAt ?? now.toISOString(),
    isrs: chosen?.isrs ?? fallbackIsrs,
    nextPlannedStart,
    nextPlannedEnd,
    seen: records.length > 0,
    coordinates: coords,
  };
}

/**
 * Per-crossing hits for the Terneuzen lock space.
 * Catalog crossings keep their ids; extra live NLTNZ130* / bbox objects
 * are appended as `ndw-<isrs>`.
 */
export function mapTerneuzenCrossings(
  records: NdwRecord[],
  catalog: CrossingDef[],
  now: Date,
  soonMs = NDW_SOON_MS,
): Record<string, LiveCrossingHit> {
  const complex = records.filter(isTerneuzenComplexRecord);
  const used = new Set<NdwRecord>();
  const out: Record<string, LiveCrossingHit> = {};

  for (const crossing of catalog) {
    const mine = crossing.isrs
      ? complex.filter((record) => record.isrs === crossing.isrs)
      : [];
    for (const record of mine) used.add(record);
    const hit = pickHitFromRecords(
      mine,
      now,
      soonMs,
      crossing.isrs ?? "",
      crossing.coordinates,
    );
    out[crossing.id] = {
      ...hit,
      id: crossing.id,
      label: crossing.label,
      roadName: crossing.road,
      coordinates: crossing.coordinates,
      hasNdw: Boolean(crossing.isrs),
      seen: mine.length > 0,
      road: crossing.isrs ? hit.road : "unknown",
    };
  }

  for (const record of complex) {
    if (used.has(record) || !record.isrs) continue;
    const already = Object.values(out).some((hit) => hit.isrs === record.isrs);
    if (already) continue;
    const siblings = complex.filter((item) => item.isrs === record.isrs);
    for (const sibling of siblings) used.add(sibling);
    const hit = pickHitFromRecords(
      siblings,
      now,
      soonMs,
      record.isrs,
      record.lat !== null && record.lng !== null
        ? { lat: record.lat, lng: record.lng }
        : undefined,
    );
    const id = `ndw-${record.isrs.toLowerCase()}`;
    out[id] = {
      ...hit,
      id,
      label: "Buitenhaven (live NDW)",
      roadName: "Buitenhaven",
      coordinates: hit.coordinates ?? { lat: 51.33302, lng: 3.820414 },
      hasNdw: true,
      seen: true,
    };
  }

  return out;
}

export function emptyLiveSnapshot(
  bridges: Bridge[],
  fetchedAt: string,
  extra: Partial<LiveSnapshot> = {},
): LiveSnapshot {
  return {
    ok: false,
    stale: false,
    fetchedAt,
    source: "ndw",
    bridges: mapRecordsToBridges([], bridges, new Date(fetchedAt)),
    ...extra,
  };
}
