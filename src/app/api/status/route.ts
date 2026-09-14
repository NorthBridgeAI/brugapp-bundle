import { loadCatalog } from "@/lib/catalog";
import { getNdwSnapshot } from "@/lib/ndw";
import { deriveAllViews } from "@/lib/status";
import { crossingList } from "@/lib/terneuzen";

export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = loadCatalog();
  const now = new Date();
  const live = await getNdwSnapshot();
  const views = deriveAllViews(catalog, now, live).map((view) => ({
    id: view.bridge.id,
    slug: view.bridge.slug,
    name: view.bridge.name,
    road: view.road,
    headline: view.headline,
    detail: view.detail,
    inRushHold: view.inRushHold,
    nextEvent: view.nextEvent
      ? {
          kind: view.nextEvent.kind,
          at: view.nextEvent.at.toISOString(),
          label: view.nextEvent.label,
        }
      : null,
    source: view.source,
    coordinates: view.bridge.coordinates,
    isrs: view.bridge.isrs ?? null,
    liveAt: view.liveAt?.toISOString() ?? null,
    liveStale: view.liveStale ?? false,
  }));

  const crossings = crossingList(live);
  const extras = crossings
    .filter((hit) => hit.hasNdw && hit.isrs && hit.isrs !== "NLTNZ130B20497600005")
    .map((hit) => ({
      id: hit.isrs,
      slug: `terneuzen-${hit.isrs.toLowerCase()}`,
      name: hit.label,
      road: hit.road,
      headline:
        hit.road === "wait" ? "Wachten" : hit.road === "soon" ? "Let op" : "Vrij",
      detail: hit.seen
        ? "Live NDW-oversteek op het sluiscomplex Terneuzen."
        : "Catalogus-ISRS op het sluiscomplex; geen situatie in deze snapshot.",
      inRushHold: false,
      nextEvent: null,
      source: "ndw" as const,
      coordinates: hit.coordinates,
      isrs: hit.isrs,
      liveAt: live.fetchedAt,
      liveStale: live.stale,
      space: "terneuzen" as const,
      seen: hit.seen,
    }));

  return Response.json(
    {
      asOf: now.toISOString(),
      timezone: catalog.schedule.timezone,
      source: live.ok ? "ndw" : catalog.status.source,
      disclaimer: catalog.status.disclaimer,
      live,
      crossings,
      bridges: [...views, ...extras],
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
