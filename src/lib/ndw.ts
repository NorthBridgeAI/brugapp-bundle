import { gunzipSync } from "node:zlib";
import { loadCatalog } from "./catalog";
import {
  emptyLiveSnapshot,
  mapRecordsToBridges,
  mapTerneuzenCrossings,
  parseBridgeSwingRecords,
} from "./ndw-parse";
import { loadTerneuzenCrossings } from "./terneuzen";
import type { LiveSnapshot } from "./types";

export const NDW_FEEDS = {
  actueel: "https://opendata.ndw.nu/actueel_beeld.xml.gz",
  planning: "https://opendata.ndw.nu/planningsfeed_brugopeningen.xml.gz",
} as const;

export const NDW_TTL_MS = 45_000;
export const NDW_LAST_GOOD_MS = 15 * 60_000;

type Memory = { at: number; snap: LiveSnapshot };

let memory: Memory | null = null;
let lastGood: Memory | null = null;
let inflight: Promise<LiveSnapshot> | null = null;

function isGzip(buf: Buffer): boolean {
  return buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b;
}

export async function fetchGzipXml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Accept: "application/gzip, application/xml, text/xml, */*",
      "User-Agent": "Brugapp/0.1 (personal canal PWA; NDW DATEX)",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NDW HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const xml = isGzip(buf) ? gunzipSync(buf) : buf;
  return xml.toString("utf8");
}

async function loadFresh(): Promise<LiveSnapshot> {
  const catalog = loadCatalog();
  const fetchedAt = new Date().toISOString();
  const [actueel, planning] = await Promise.all([
    fetchGzipXml(NDW_FEEDS.actueel),
    fetchGzipXml(NDW_FEEDS.planning),
  ]);
  const records = [
    ...parseBridgeSwingRecords(actueel),
    ...parseBridgeSwingRecords(planning),
  ];
  const now = new Date(fetchedAt);
  const bridges = mapRecordsToBridges(records, catalog.bridges, now);
  const crossings = mapTerneuzenCrossings(
    records,
    loadTerneuzenCrossings(),
    now,
  );
  for (const hit of Object.values(crossings)) {
    if (hit.hasNdw && hit.isrs && !bridges[hit.isrs]) {
      bridges[hit.isrs] = hit;
    }
  }
  return {
    ok: true,
    stale: false,
    fetchedAt,
    source: "ndw",
    bridges,
    crossings,
  };
}

/**
 * Server-side NDW snapshot. Coalesces in-flight fetches, keeps a 45s memory
 * TTL (Vercel isolate-friendly) plus last-good for up to 15 minutes.
 */
export async function getNdwSnapshot(): Promise<LiveSnapshot> {
  const now = Date.now();
  if (memory && now - memory.at < NDW_TTL_MS) return memory.snap;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const snap = await loadFresh();
      const packed = { at: Date.now(), snap };
      memory = packed;
      lastGood = packed;
      return snap;
    } catch {
      if (lastGood && Date.now() - lastGood.at < NDW_LAST_GOOD_MS) {
        const stale: LiveSnapshot = { ...lastGood.snap, stale: true, ok: true };
        memory = { at: Date.now(), snap: stale };
        return stale;
      }
      const catalog = loadCatalog();
      const fetchedAt = new Date().toISOString();
      return emptyLiveSnapshot(catalog.bridges, fetchedAt, {
        ok: false,
        stale: false,
        crossings: mapTerneuzenCrossings(
          [],
          loadTerneuzenCrossings(),
          new Date(fetchedAt),
        ),
      });
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Test helper — do not use in production paths. */
export function resetNdwCache() {
  memory = null;
  lastGood = null;
  inflight = null;
}
