import DraftAClient from "@/components/draft-a-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A",
  "Concept A — Terneuzen HUD",
  "Donkere MapLibre-kaart van het sluiscomplex Terneuzen. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftAPage() {
  const props = await loadDraftProps();
  return <DraftAClient {...props} />;
}
