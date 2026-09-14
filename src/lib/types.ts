export const TIMEZONE = "Europe/Amsterdam" as const;

export type CountryCode = "NL" | "BE";
export type BridgeKind = "swing" | "bascule" | "lift" | "lock";
export type BridgeLifecycle = "active";
export type RoadStatus = "clear" | "wait" | "soon" | "unknown";
export type DataSource = "manual" | "schedule" | "api" | "ndw";
export type EventKind =
  | "opening_start"
  | "opening_end"
  | "rush_start"
  | "rush_end";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Bridge {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  locality: string;
  municipality: string;
  province: string;
  country: CountryCode;
  waterway: string;
  road: string;
  coordinates: Coordinates;
  vhfChannel?: string;
  callSign?: string;
  clearanceClosedM: number;
  movableWidthM?: number;
  westOpeningWidthM?: number;
  fixedClearanceM?: number;
  operator: string;
  operatorPhone?: string;
  kind: BridgeKind;
  status: BridgeLifecycle;
  /** RIS / ISRS location code in NDW DATEX feeds */
  isrs?: string;
  /** VILD AlertC specificLocation, if known */
  vild?: string;
}

export interface TimeWindow {
  start: string;
  end: string;
  label: string;
  detail?: string;
}

export interface RushHold extends TimeWindow {
  id: string;
  days: number[];
  /** If set, this hold applies only to those bridges. Omit for all. */
  bridgeIds?: string[];
}

export interface OpeningPattern {
  weekday: TimeWindow[];
  weekend: TimeWindow[];
}

export interface ScheduleFile {
  timezone: string;
  soonWindowMinutes: number;
  notes: string;
  rushHolds: RushHold[];
  openings: Record<string, OpeningPattern>;
}

export interface StatusOverride {
  bridgeId: string;
  road: RoadStatus;
  note: string;
  until?: string;
  updatedAt: string;
}

export interface StatusFile {
  source: DataSource;
  timezone: string;
  updatedAt: string;
  updatedBy: string;
  disclaimer: string;
  overrides: StatusOverride[];
}

export interface Catalog {
  waterway: string;
  region: string;
  bridges: Bridge[];
  schedule: ScheduleFile;
  status: StatusFile;
}

export interface TimedEvent {
  kind: EventKind;
  at: Date;
  end?: Date;
  label: string;
  detail?: string;
}

export interface DayPlan {
  isoWeekday: number;
  date: Date;
  label: string;
  isToday: boolean;
  rushHolds: Array<{ start: string; end: string; label: string }>;
  openings: TimeWindow[];
}

export interface LiveBridgeHit {
  road: RoadStatus;
  operatorStatus: string | null;
  start: string | null;
  end: string | null;
  updatedAt: string;
  isrs: string;
  nextPlannedStart: string | null;
  nextPlannedEnd: string | null;
  /** True when a DATEX situation for this object was in the current snapshot. */
  seen?: boolean;
  coordinates?: Coordinates;
}

export interface CrossingDef {
  id: string;
  label: string;
  road: string;
  coordinates: Coordinates;
  isrs?: string;
  osmWay?: number;
}

export interface LandmarkDef {
  id: string;
  label: string;
  coordinates: Coordinates;
}

export interface TerneuzenComplexFile {
  space: "terneuzen";
  name: string;
  bbox: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
  isrsPrefix: string;
  landmarks: LandmarkDef[];
  crossings: CrossingDef[];
}

export interface LiveCrossingHit extends LiveBridgeHit {
  id: string;
  label: string;
  roadName: string;
  coordinates: Coordinates;
  /** Object has an ISRS we can match in NDW. */
  hasNdw: boolean;
  /** A DATEX situation for this ISRS/coords was in this snapshot. */
  seen: boolean;
}

export interface LiveSnapshot {
  ok: boolean;
  stale: boolean;
  fetchedAt: string;
  source: "ndw";
  bridges: Record<string, LiveBridgeHit>;
  crossings?: Record<string, LiveCrossingHit>;
}

export interface BridgeView {
  bridge: Bridge;
  road: RoadStatus;
  headline: string;
  detail: string;
  nextEvent: TimedEvent | null;
  inRushHold: boolean;
  todayEvents: TimedEvent[];
  week: DayPlan[];
  source: DataSource;
  asOf: Date;
  liveAt?: Date;
  liveStale?: boolean;
}
