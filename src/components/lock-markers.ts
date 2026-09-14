import {
  PIN_COPY,
  ROAD_TONE,
  type MarkerOffset,
} from "@/lib/lock-map";
import type { LiveCrossingHit } from "@/lib/types";

const OFFSET_CSS: Record<MarkerOffset, string> = {
  left: "right:46px;top:50%;transform:translateY(-50%)",
  right: "left:46px;top:50%;transform:translateY(-50%)",
  top: "left:50%;bottom:46px;transform:translateX(-50%)",
  bottom: "left:50%;top:46px;transform:translateX(-50%)",
};

export function makeStatusMarker({
  title,
  short,
  fill,
  light = false,
  offset,
  selected = false,
  onClick,
  sub,
}: {
  title: string;
  short: string;
  fill: string;
  light?: boolean;
  offset: MarkerOffset;
  selected?: boolean;
  onClick: () => void;
  sub?: string;
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", title);
  button.style.cssText =
    "position:relative;display:flex;align-items:center;justify-content:center;width:44px;height:44px;padding:0;border:0;background:transparent;cursor:pointer;z-index:2;";
  const halo = selected ? `${fill}55` : `${fill}33`;
  const ink = light ? "#0f172a" : "#f8fafc";
  const mute = light ? "#475569" : "#cbd5e1";
  const plate = light ? "#ffffff" : "#020617";
  const ring = selected
    ? light
      ? "#0f172a"
      : "#fde68a"
    : light
      ? "#0f172a"
      : "rgba(248,250,252,0.35)";
  const label = sub
    ? `<strong style="display:block;font:700 12px/1.15 ui-sans-serif,system-ui,sans-serif">${short}</strong><span style="display:block;color:${mute};font:600 10px/1.2 ui-sans-serif,system-ui,sans-serif">${sub}</span>`
    : short;
  button.innerHTML = `<span style="position:absolute;width:44px;height:44px;border-radius:999px;background:${halo}"></span><span style="width:18px;height:18px;border-radius:999px;background:${fill};box-shadow:0 0 0 2px ${plate},0 0 0 3px ${fill}"></span><span style="position:absolute;${OFFSET_CSS[offset]};background:${plate};color:${ink};border:1px solid ${ring};border-radius:6px;padding:3px 7px;font:700 13px/1.15 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;pointer-events:none">${label}</span>`;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return button;
}

export function makeHtmlPin(
  pin: LiveCrossingHit,
  light = false,
  selected = false,
  onClick?: () => void,
) {
  const tone = ROAD_TONE[pin.road];
  const copy = PIN_COPY[pin.id] ?? {
    short: pin.label.replace(/^Buitenhaven\s+/, "BH "),
    full: pin.label,
    offset: "right" as const,
  };
  return makeStatusMarker({
    title: `${copy.full}: ${tone.label}${pin.isrs ? ` · ${pin.isrs}` : ""}`,
    short: copy.short,
    fill: tone.fill,
    light,
    offset: copy.offset,
    selected,
    onClick: onClick ?? (() => undefined),
  });
}

export function makeFullNameMarker(
  pin: LiveCrossingHit,
  selected: boolean,
  onClick: () => void,
) {
  const tone = ROAD_TONE[pin.hasNdw ? pin.road : "unknown"];
  const copy = PIN_COPY[pin.id];
  const full = copy?.full ?? pin.label;
  return makeStatusMarker({
    title: pin.hasNdw
      ? `${full}: ${tone.label}${pin.isrs ? ` · ${pin.isrs}` : ""}`
      : `${full}: geen live NDW`,
    short: full,
    fill: pin.hasNdw && pin.road === "soon" ? ROAD_TONE.clear.fill : tone.fill,
    offset: copy?.offset ?? "right",
    selected,
    onClick,
    sub: pin.hasNdw ? undefined : "geen live NDW",
  });
}
