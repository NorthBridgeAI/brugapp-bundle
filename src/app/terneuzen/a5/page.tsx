import DraftA5Client from "@/components/draft-a5-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A5",
  "Concept A5 — Terneuzen cartografie",
  "Donkere MapLibre-kaart op BGT-water, NWB-wegen en BGT-dekken. Alleen Oostsluis heeft live NDW. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftA5Page() {
  const props = await loadDraftProps();
  return <DraftA5Client {...props} />;
}
