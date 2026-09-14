import type { LiveBridgeHit, LiveCrossingHit, LiveSnapshot } from "./types";

export const A3_BRIDGE_IDS = [
  "oostsluis-buitenhoofd",
  "oostsluis-binnenhoofd",
  "westsluis-noord",
  "westsluis-zuid",
  "nieuwe-sluis-buitenhoofd",
  "nieuwe-sluis-binnenhoofd",
] as const;

export type A3BridgeId = (typeof A3_BRIDGE_IDS)[number];

export type A3Paint = "open" | "closed" | "no-live-data";

/** Confirmed DATEX ISRS only. Do not guess extra codes. */
export const A3_NDW_ISRS = {
  "oostsluis-buitenhoofd": "NLTNZ130B20497800009",
  "oostsluis-binnenhoofd": "NLTNZ130B20497600005",
} as const;

export const A3_PAINT_COLOR: Record<A3Paint, string> = {
  open: "#15803d",
  closed: "#b91c1c",
  "no-live-data": "#64748b",
};

export const A3_PAINT_LABEL: Record<A3Paint, string> = {
  open: "Open",
  closed: "Dicht",
  "no-live-data": "Geen live data",
};

const CONFIRMED_ISRS = new Set<string>(Object.values(A3_NDW_ISRS));

export function isConfirmedA3Isrs(isrs: string | null | undefined): boolean {
  return Boolean(isrs && CONFIRMED_ISRS.has(isrs));
}

/**
 * Car-first A3 paint. DATEX `pickHitFromRecords` defaults unseen objects to
 * road=clear — this adapter must check `seen` first. Never unknown→open.
 */
export function paintFromHit(
  hit: Pick<LiveBridgeHit, "road" | "seen"> | null | undefined,
  options: { hasNdw: boolean },
): A3Paint {
  if (!options.hasNdw) return "no-live-data";
  if (!hit) return "no-live-data";
  if (hit.seen !== true) return "no-live-data";
  if (hit.road === "wait") return "closed";
  if (hit.road === "clear" || hit.road === "soon") return "open";
  return "no-live-data";
}

function allHits(live: LiveSnapshot | null | undefined): Array<
  LiveBridgeHit | LiveCrossingHit
> {
  if (!live) return [];
  return [
    ...Object.values(live.crossings ?? {}),
    ...Object.values(live.bridges ?? {}),
  ];
}

export function findHitByIsrs(
  live: LiveSnapshot | null | undefined,
  isrs: string,
): LiveBridgeHit | LiveCrossingHit | undefined {
  return allHits(live).find((hit) => hit.isrs === isrs);
}

export function bridgePaints(
  live: LiveSnapshot | null | undefined,
): Record<A3BridgeId, A3Paint> {
  const out = {} as Record<A3BridgeId, A3Paint>;
  for (const id of A3_BRIDGE_IDS) {
    const isrs = A3_NDW_ISRS[id as keyof typeof A3_NDW_ISRS];
    if (!isrs) {
      out[id] = "no-live-data";
      continue;
    }
    out[id] = paintFromHit(findHitByIsrs(live, isrs), { hasNdw: true });
  }
  return out;
}

export function ndwCaution(
  live: LiveSnapshot | null | undefined,
): { oostNorth: boolean; oostSouth: boolean } {
  const north = findHitByIsrs(live, A3_NDW_ISRS["oostsluis-buitenhoofd"]);
  const south = findHitByIsrs(live, A3_NDW_ISRS["oostsluis-binnenhoofd"]);
  return {
    oostNorth: north?.seen === true && north.road === "soon",
    oostSouth: south?.seen === true && south.road === "soon",
  };
}

export type A3AdviceTone = A3Paint;

export interface A3Advice {
  tone: A3AdviceTone;
  title: string;
  detail: string;
  caution: boolean;
  showRoute: boolean;
}

export function routeAdviceFromPaints(
  paints: Record<A3BridgeId, A3Paint>,
  caution: { oostNorth: boolean; oostSouth: boolean },
): A3Advice {
  const north = paints["oostsluis-buitenhoofd"];
  const south = paints["oostsluis-binnenhoofd"];
  const letOp = caution.oostNorth || caution.oostSouth;

  if (north === "open" && south === "open") {
    return {
      tone: "open",
      title: "Oostsluis open",
      detail: letOp
        ? "Buitenhaven via binnen- en buitenhoofd. Let op: NDW verwacht een opening."
        : "Buitenhaven via binnenhoofd en buitenhoofd — live NDW bevestigt beide oversteken.",
      caution: letOp,
      showRoute: true,
    };
  }

  if (north === "closed" || south === "closed") {
    const which =
      north === "closed" && south === "closed"
        ? "Binnenhoofd en buitenhoofd Oostsluis zijn dicht."
        : north === "closed"
          ? "Buitenhoofd Oostsluis (noord) is dicht."
          : "Binnenhoofd Oostsluis (zuid) is dicht.";
    return {
      tone: "closed",
      title: "Geen bevestigde route",
      detail: `${which} Westsluis en Nieuwe Sluis hebben geen live NDW — we tekenen geen groene omweg.`,
      caution: false,
      showRoute: false,
    };
  }

  return {
    tone: "no-live-data",
    title: "Geen live data",
    detail:
      "Oostsluis heeft nu geen NDW-situatie. Westsluis en Nieuwe Sluis hebben geen live NDW. Geen groene route.",
    caution: false,
    showRoute: false,
  };
}

export function emptyPaints(): Record<A3BridgeId, A3Paint> {
  return {
    "oostsluis-buitenhoofd": "no-live-data",
    "oostsluis-binnenhoofd": "no-live-data",
    "westsluis-noord": "no-live-data",
    "westsluis-zuid": "no-live-data",
    "nieuwe-sluis-buitenhoofd": "no-live-data",
    "nieuwe-sluis-binnenhoofd": "no-live-data",
  };
}
