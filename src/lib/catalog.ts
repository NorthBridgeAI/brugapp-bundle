import bridgesFile from "@/data/bridges.json";
import scheduleFile from "@/data/schedule.json";
import statusFile from "@/data/status.json";
import {
  bridgesFileSchema,
  scheduleFileSchema,
  statusFileSchema,
} from "./schema";
import type { Catalog } from "./types";

/** Typed JSON today. Replace these imports with a fetch when BRIDGES_API_URL exists. */
export function loadCatalog(): Catalog {
  const bridges = bridgesFileSchema.parse(bridgesFile);
  const schedule = scheduleFileSchema.parse(scheduleFile);
  const status = statusFileSchema.parse(statusFile);

  return {
    waterway: bridges.waterway,
    region: bridges.region,
    bridges: bridges.bridges,
    schedule,
    status,
  };
}

export function catalogSnapshot(now = new Date()) {
  const catalog = loadCatalog();
  return {
    catalog,
    now: now.toISOString(),
    source: catalog.status.source,
    disclaimer: catalog.status.disclaimer,
    updatedAt: catalog.status.updatedAt,
  };
}
