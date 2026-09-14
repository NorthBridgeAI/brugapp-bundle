import crossingsFile from "@/data/terneuzen-crossings.json";
import type {
  CrossingDef,
  LandmarkDef,
  LiveCrossingHit,
  LiveSnapshot,
  TerneuzenComplexFile,
} from "./types";
import { z } from "zod";
import { coordinatesSchema } from "./schema";

const terneuzenComplexSchema = z.object({
  space: z.literal("terneuzen"),
  name: z.string().min(1),
  bbox: z.object({
    latMin: z.number(),
    latMax: z.number(),
    lngMin: z.number(),
    lngMax: z.number(),
  }),
  isrsPrefix: z.string().min(1),
  landmarks: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      coordinates: coordinatesSchema,
    }),
  ),
  crossings: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      road: z.string().min(1),
      coordinates: coordinatesSchema,
      isrs: z.string().min(1).optional(),
      osmWay: z.number().int().positive().optional(),
    }),
  ),
});

export function loadTerneuzenComplex(): TerneuzenComplexFile {
  return terneuzenComplexSchema.parse(crossingsFile);
}

export function loadTerneuzenCrossings(): CrossingDef[] {
  return loadTerneuzenComplex().crossings;
}

export function loadTerneuzenLandmarks(): LandmarkDef[] {
  return loadTerneuzenComplex().landmarks;
}

export function crossingList(
  live: LiveSnapshot | null | undefined,
  catalog = loadTerneuzenCrossings(),
): LiveCrossingHit[] {
  const hits = live?.crossings ?? {};
  const seen = new Set<string>();
  const out: LiveCrossingHit[] = [];

  for (const crossing of catalog) {
    const hit = hits[crossing.id];
    if (hit) {
      out.push(hit);
      seen.add(hit.id);
    } else {
      out.push({
        id: crossing.id,
        label: crossing.label,
        roadName: crossing.road,
        coordinates: crossing.coordinates,
        road: crossing.isrs ? "clear" : "unknown",
        operatorStatus: null,
        start: null,
        end: null,
        updatedAt: live?.fetchedAt ?? new Date().toISOString(),
        isrs: crossing.isrs ?? "",
        nextPlannedStart: null,
        nextPlannedEnd: null,
        seen: false,
        hasNdw: Boolean(crossing.isrs),
      });
      seen.add(crossing.id);
    }
  }

  for (const hit of Object.values(hits)) {
    if (seen.has(hit.id)) continue;
    out.push(hit);
  }

  return out.sort((a, b) => b.coordinates.lat - a.coordinates.lat);
}
