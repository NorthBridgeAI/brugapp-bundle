import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const coordinatesSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const bridgeSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  locality: z.string().min(1),
  municipality: z.string().min(1),
  province: z.string().min(1),
  country: z.enum(["NL", "BE"]),
  waterway: z.string().min(1),
  road: z.string().min(1),
  coordinates: coordinatesSchema,
  vhfChannel: z.string().optional(),
  callSign: z.string().optional(),
  clearanceClosedM: z.number().positive(),
  movableWidthM: z.number().positive().optional(),
  westOpeningWidthM: z.number().positive().optional(),
  fixedClearanceM: z.number().positive().optional(),
  operator: z.string().min(1),
  operatorPhone: z.string().optional(),
  kind: z.enum(["swing", "bascule", "lift", "lock"]),
  status: z.literal("active"),
  isrs: z.string().min(1).optional(),
  vild: z.string().min(1).optional(),
});

export const bridgesFileSchema = z.object({
  waterway: z.string().min(1),
  region: z.string().min(1),
  bridges: z.array(bridgeSchema).min(1),
});

const timeWindowSchema = z.object({
  start: hhmm,
  end: hhmm,
  label: z.string().min(1),
  detail: z.string().optional(),
});

export const scheduleFileSchema = z.object({
  timezone: z.string().min(1),
  soonWindowMinutes: z.number().int().positive(),
  notes: z.string(),
  rushHolds: z.array(
    timeWindowSchema.extend({
      id: z.string().min(1),
      days: z.array(z.number().int().min(1).max(7)).min(1),
      bridgeIds: z.array(z.string().min(1)).optional(),
    }),
  ),
  openings: z.record(
    z.string(),
    z.object({
      weekday: z.array(timeWindowSchema),
      weekend: z.array(timeWindowSchema),
    }),
  ),
});

export const statusFileSchema = z.object({
  source: z.enum(["manual", "schedule", "api"]),
  timezone: z.string().min(1),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1),
  disclaimer: z.string().min(1),
  overrides: z.array(
    z.object({
      bridgeId: z.string().min(1),
      road: z.enum(["clear", "wait", "soon", "unknown"]),
      note: z.string().min(1),
      until: z.string().optional(),
      updatedAt: z.string().min(1),
    }),
  ),
});
