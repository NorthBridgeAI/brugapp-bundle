import DraftA6Client from "@/components/draft-a6-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A6",
  "Concept A6 — Terneuzen leesbaarheid",
  "Hiërarchie-pass op A5: kalme kaart, duidelijke sluizen, één bevestigde route. Alleen Oostsluis heeft live NDW. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftA6Page() {
  const props = await loadDraftProps();
  return <DraftA6Client {...props} />;
}
