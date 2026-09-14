import DraftA3Client from "@/components/draft-a3-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A3",
  "Concept A3 — Terneuzen NWB",
  "Donkere MapLibre-kaart op officiële RWS/NWB/BGT-geometrie. Alleen Oostsluis heeft live NDW. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftA3Page() {
  const props = await loadDraftProps();
  return <DraftA3Client {...props} />;
}
