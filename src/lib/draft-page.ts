import type { Metadata } from "next";
import { loadCatalog } from "@/lib/catalog";
import { getNdwSnapshot } from "@/lib/ndw";

export const dynamic = "force-dynamic";

export function draftMetadata(
  letter: string,
  title: string,
  description: string,
): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    other: { "concept-draft": letter },
  };
}

export async function loadDraftProps() {
  const catalog = loadCatalog();
  const live = await getNdwSnapshot();
  return {
    catalog,
    initialNow: new Date().toISOString(),
    initialLive: live,
  };
}
