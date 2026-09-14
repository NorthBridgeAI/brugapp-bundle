import { loadCatalog } from "@/lib/catalog";

export const dynamic = "force-static";

export function GET() {
  const catalog = loadCatalog();
  return Response.json({
    waterway: catalog.waterway,
    region: catalog.region,
    bridges: catalog.bridges,
  });
}
