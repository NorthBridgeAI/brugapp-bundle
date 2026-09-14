import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { BridgeDetail } from "@/components/bridge-detail";
import { loadCatalog } from "@/lib/catalog";
import { getNdwSnapshot } from "@/lib/ndw";

export const dynamic = "force-dynamic";
export const dynamicParams = false;

export function generateStaticParams() {
  return loadCatalog()
    .bridges.filter((bridge) => bridge.slug !== "terneuzen")
    .map((bridge) => ({ slug: bridge.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/brug/[slug]">): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  if (slug === "terneuzen") {
    return {
      title: "Noordzeesluizen Terneuzen",
      description:
        "Kaart van de Buitenhaven bij de Noordzeesluizen Terneuzen. Live wegstatus per oversteek via NDW DATEX.",
    };
  }
  const bridge = loadCatalog().bridges.find((item) => item.slug === slug);
  if (!bridge) notFound();
  return {
    title: bridge.name,
    description: `Oversteekstatus en schema van ${bridge.name} op het ${bridge.waterway}.`,
  };
}

export default async function BridgePage({
  params,
}: PageProps<"/brug/[slug]">) {
  await connection();
  const { slug } = await params;
  if (slug === "terneuzen") redirect("/terneuzen");
  const catalog = loadCatalog();
  const bridge = catalog.bridges.find((item) => item.slug === slug);
  if (!bridge) notFound();
  const live = await getNdwSnapshot();

  return (
    <BridgeDetail
      catalog={catalog}
      slug={slug}
      initialNow={new Date().toISOString()}
      initialLive={live}
    />
  );
}
