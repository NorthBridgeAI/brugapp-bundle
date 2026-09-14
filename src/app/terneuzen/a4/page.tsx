import DraftA4Client from "@/components/draft-a4-client";
import { draftMetadata, loadDraftProps } from "@/lib/draft-page";

export const dynamic = "force-dynamic";

export const metadata = draftMetadata(
  "A4",
  "Concept A4 — Terneuzen cartografie",
  "Status op BGT-dekken, NWB-routes, drie sluizen. Alleen Oostsluis heeft live NDW. Concept, niet geïndexeerd.",
);

export default async function TerneuzenDraftA4Page() {
  const props = await loadDraftProps();
  return <DraftA4Client {...props} />;
}
