import type { Metadata } from "next";
import { TerneuzenSpace } from "@/components/terneuzen-space";
import { loadCatalog } from "@/lib/catalog";
import { getNdwSnapshot } from "@/lib/ndw";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Noordzeesluizen Terneuzen",
  description:
    "Driedimensionale kaart van het sluiscomplex Terneuzen. Alleen de twee Buitenhaven-ISRS kleuren live; sluizen zelf hebben geen vrije NDW-code.",
};

export default async function TerneuzenPage() {
  const catalog = loadCatalog();
  const live = await getNdwSnapshot();
  return (
    <TerneuzenSpace
      catalog={catalog}
      initialNow={new Date().toISOString()}
      initialLive={live}
    />
  );
}
