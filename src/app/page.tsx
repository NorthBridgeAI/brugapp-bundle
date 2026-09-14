import { StatusBoard } from "@/components/status-board";
import { loadCatalog } from "@/lib/catalog";
import { getNdwSnapshot } from "@/lib/ndw";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = loadCatalog();
  const live = await getNdwSnapshot();
  return (
    <StatusBoard
      catalog={catalog}
      initialNow={new Date().toISOString()}
      initialLive={live}
    />
  );
}
