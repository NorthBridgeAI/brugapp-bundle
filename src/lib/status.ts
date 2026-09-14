import type {
  Bridge,
  BridgeView,
  Catalog,
  DataSource,
  DayPlan,
  LiveBridgeHit,
  LiveSnapshot,
  RoadStatus,
  ScheduleFile,
  StatusOverride,
  TimedEvent,
} from "./types";
import {
  addAmsterdamDays,
  amsterdamParts,
  formatCountdown,
  formatTime,
  formatWeekday,
  inWindow,
  minutesOfDay,
  zonedDate,
} from "./time";

function isLock(bridge: Bridge): boolean {
  return bridge.kind === "lock";
}

const COPY: Record<
  RoadStatus,
  { headline: string; detail: (bridge: Bridge) => string }
> = {
  clear: {
    headline: "Vrij",
    detail: (bridge) =>
      isLock(bridge)
        ? `De weg bij ${bridge.shortName} is open. Je kunt oversteken.`
        : `De weg over ${bridge.shortName} is open. Je kunt oversteken.`,
  },
  wait: {
    headline: "Wachten",
    detail: (bridge) =>
      isLock(bridge)
        ? `De beweegbare brug bij ${bridge.shortName} is in bedrijf. De weg is dicht.`
        : `${bridge.shortName} draait voor scheepvaart. De weg is dicht.`,
  },
  soon: {
    headline: "Let op",
    detail: (bridge) =>
      `Opening verwacht bij ${bridge.shortName}. Reken op korte hinder.`,
  },
  unknown: {
    headline: "Onbekend",
    detail: () => "Status niet beschikbaar. Controleer ter plaatse.",
  },
};

export function activeBridges(catalog: Catalog): Bridge[] {
  return catalog.bridges.filter((bridge) => bridge.status === "active");
}

export function getBridge(catalog: Catalog, slug: string): Bridge | undefined {
  return catalog.bridges.find((bridge) => bridge.slug === slug);
}

export function deriveBridgeView(
  bridge: Bridge,
  catalog: Catalog,
  now: Date,
  live?: LiveSnapshot | null,
): BridgeView {
  const asOf = now;
  const week = buildWeek(bridge, catalog.schedule, now);

  const override = liveOverride(bridge.id, catalog.status.overrides, now);
  const todayEvents = eventsForDay(bridge, catalog.schedule, now);
  const inRushHold = isInRushHold(bridge, catalog.schedule, now);
  const liveHit =
    live && (live.ok || live.stale) ? live.bridges[bridge.id] : undefined;
  const liveUsable = Boolean(liveHit);

  let road: RoadStatus = "clear";
  let source: DataSource = "schedule";
  let detail = COPY.clear.detail(bridge);

  if (override) {
    road = override.road;
    source = "manual";
    detail = override.note;
  } else if (liveUsable && liveHit) {
    road = liveHit.road;
    source = "ndw";
    if (road === "wait") {
      detail = COPY.wait.detail(bridge);
    } else if (road === "soon") {
      const at = liveHit.start ? new Date(liveHit.start) : null;
      detail = at
        ? `NDW: opening verwacht ${formatTime(at)} · ${formatCountdown(now, at)}.`
        : COPY.soon.detail(bridge);
    } else {
      detail = COPY.clear.detail(bridge);
    }
  } else if (inRushHold) {
    road = "clear";
    const hold = currentRushHold(bridge, catalog.schedule, now);
    detail = hold
      ? `${hold.label}: scheepvaart gestremd, weg is vrij tot ${hold.end}.`
      : COPY.clear.detail(bridge);
  }

  let nextEvent = nextRelevantEvent(todayEvents, now, inRushHold);
  if (liveUsable && liveHit && source === "ndw") {
    const liveNext = liveNextEvent(liveHit, now);
    if (liveNext) nextEvent = liveNext;
  }

  return {
    bridge,
    road,
    headline: COPY[road].headline,
    detail,
    nextEvent,
    inRushHold: source === "ndw" ? false : inRushHold,
    todayEvents,
    week,
    source,
    asOf,
    liveAt: live?.fetchedAt ? new Date(live.fetchedAt) : undefined,
    liveStale: live?.stale,
  };
}

export function deriveAllViews(
  catalog: Catalog,
  now: Date,
  live?: LiveSnapshot | null,
): BridgeView[] {
  return catalog.bridges.map((bridge) =>
    deriveBridgeView(bridge, catalog, now, live),
  );
}

function liveNextEvent(hit: LiveBridgeHit, now: Date): TimedEvent | null {
  if (hit.road === "wait" && hit.end) {
    const at = new Date(hit.end);
    if (at.getTime() > now.getTime()) {
      return { kind: "opening_end", at, label: "Weg weer vrij" };
    }
  }
  if (hit.road === "soon" && hit.start) {
    const at = new Date(hit.start);
    if (at.getTime() > now.getTime()) {
      return { kind: "opening_start", at, label: "NDW opening" };
    }
  }
  if (hit.road === "clear" && hit.nextPlannedStart) {
    const at = new Date(hit.nextPlannedStart);
    if (at.getTime() > now.getTime()) {
      return { kind: "opening_start", at, label: "NDW opening" };
    }
  }
  return null;
}

function liveOverride(
  bridgeId: string,
  overrides: StatusOverride[],
  now: Date,
): StatusOverride | undefined {
  const match = overrides.find((item) => item.bridgeId === bridgeId);
  if (!match) return undefined;
  if (match.until && new Date(match.until).getTime() <= now.getTime()) {
    return undefined;
  }
  return match;
}

export function rushHoldsForBridge(bridge: Bridge, schedule: ScheduleFile) {
  return schedule.rushHolds.filter(
    (hold) => !hold.bridgeIds?.length || hold.bridgeIds.includes(bridge.id),
  );
}

function isInRushHold(
  bridge: Bridge,
  schedule: ScheduleFile,
  now: Date,
): boolean {
  return Boolean(currentRushHold(bridge, schedule, now));
}

function currentRushHold(bridge: Bridge, schedule: ScheduleFile, now: Date) {
  const { isoWeekday } = amsterdamParts(now);
  const minutes = minutesOfDay(now);
  return rushHoldsForBridge(bridge, schedule).find(
    (hold) =>
      hold.days.includes(isoWeekday) && inWindow(minutes, hold.start, hold.end),
  );
}

function eventsForDay(
  bridge: Bridge,
  schedule: ScheduleFile,
  when: Date,
): TimedEvent[] {
  const { isoWeekday, year, month, day } = amsterdamParts(when);
  const events: TimedEvent[] = [];

  for (const hold of rushHoldsForBridge(bridge, schedule)) {
    if (!hold.days.includes(isoWeekday)) continue;
    const start = zonedDate(year, month, day, ...hhmmPair(hold.start));
    const end = zonedDate(year, month, day, ...hhmmPair(hold.end));
    events.push({
      kind: "rush_start",
      at: start,
      end,
      label: hold.label,
      detail: hold.detail,
    });
    events.push({
      kind: "rush_end",
      at: end,
      label: "Einde spitsvrij",
    });
  }

  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function buildWeek(bridge: Bridge, schedule: ScheduleFile, now: Date): DayPlan[] {
  const holds = rushHoldsForBridge(bridge, schedule);
  const days: DayPlan[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = offset === 0 ? now : addAmsterdamDays(now, offset);
    const parts = amsterdamParts(date);
    days.push({
      isoWeekday: parts.isoWeekday,
      date: zonedDate(parts.year, parts.month, parts.day, 12, 0),
      label: formatWeekday(date, true),
      isToday: offset === 0,
      rushHolds: holds
        .filter((hold) => hold.days.includes(parts.isoWeekday))
        .map((hold) => ({
          start: hold.start,
          end: hold.end,
          label: hold.label,
        })),
      openings: [],
    });
  }
  return days;
}

function nextRelevantEvent(
  events: TimedEvent[],
  now: Date,
  inRushHold: boolean,
): TimedEvent | null {
  if (inRushHold) {
    const end = events.find((event) => event.kind === "rush_end" && event.at > now);
    return end ?? null;
  }
  return (
    events.find((event) => event.at > now && event.kind === "rush_start") ?? null
  );
}

function hhmmPair(value: string): [number, number] {
  const [hour, minute] = value.split(":").map(Number);
  return [hour, minute];
}

export function nextEventLabel(event: TimedEvent, now: Date): string {
  const when = `${formatTime(event.at)} · ${formatCountdown(now, event.at)}`;
  switch (event.kind) {
    case "opening_start":
      return `Volgende opening ${when}`;
    case "opening_end":
      return `Weer vrij ${when}`;
    case "rush_start":
      return `Spitsvrij ${when}`;
    case "rush_end":
      return `Spitsvrij tot ${formatTime(event.at)}`;
    default:
      return when;
  }
}
