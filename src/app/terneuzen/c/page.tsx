import DraftCClient from "@/components/draft-c-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "C",
  "Concept C — Terneuzen 3D",
  "WebGL-orbit van het sluiscomplex Terneuzen. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftCPage() {
  const props = await loadDraftProps();
  return <DraftCClient {...props} />;
}
