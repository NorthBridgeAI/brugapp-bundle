import DraftBClient from "@/components/draft-b-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "B",
  "Concept B — Terneuzen bediening",
  "Lichte operationele kaart van het sluiscomplex Terneuzen. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftBPage() {
  const props = await loadDraftProps();
  return <DraftBClient {...props} />;
}
