import DraftA2Client from "@/components/draft-a2-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A2",
  "Concept A2 — Terneuzen route",
  "Donkere MapLibre-kaart waarop Buitenhaven-oversteken als wegvakken kleuren. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftA2Page() {
  const props = await loadDraftProps();
  return <DraftA2Client {...props} />;
}
