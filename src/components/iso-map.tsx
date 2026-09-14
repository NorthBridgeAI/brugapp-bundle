"use client";

import { ISO_TERNEUZEN_SVG } from "@/data/iso-terneuzen-svg";
import type { LiveCrossingHit, RoadStatus } from "@/lib/types";
import { projectIso } from "@/lib/lock-map";
import { cn } from "@/lib/utils";

const PIN: Record<RoadStatus, { fill: string; ring: string; label: string }> = {
  clear: { fill: "#22c55e", ring: "#052e16", label: "Weg vrij" },
  wait: { fill: "#ef4444", ring: "#450a0a", label: "Weg dicht" },
  soon: { fill: "#eab308", ring: "#422006", label: "Let op" },
  unknown: { fill: "#94a3b8", ring: "#1e293b", label: "Geen live NDW" },
};

function Caption({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
  );
}

export function IsoMap({ crossings }: { crossings: LiveCrossingHit[] }) {
  const pins = crossings.map((crossing) => ({
    ...crossing,
    ...projectIso(crossing.coordinates.lat, crossing.coordinates.lng),
  }));

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 ring-1 ring-white/5">
      <div className="relative">
        <svg
          viewBox="0 0 800 680"
          role="img"
          className="h-auto w-full"
          aria-label="Driedimensionale kaart van het sluiscomplex Terneuzen. Westsluis, Nieuwe Sluis en Oostsluis liggen naast elkaar. Groene en rode pinnen zijn live NDW-oversteken; grijs is geen live NDW."
        >
          <title>Noordzeesluizen Terneuzen — 3D sluiscomplex</title>
          <g dangerouslySetInnerHTML={{ __html: ISO_TERNEUZEN_SVG }} />
          {pins.map((pin) => {
            const tone = PIN[pin.road];
            const endAnchor = pin.x > 520;
            const below = pin.id.includes("zuid") || pin.id.includes("west");
            return (
              <g key={pin.id}>
                <rect x={pin.x - 22} y={pin.y - 22} width={44} height={44} fill="transparent">
                  <title>
                    {pin.label}: {tone.label}
                    {pin.isrs ? ` · ${pin.isrs}` : ""}
                  </title>
                </rect>
                <circle cx={pin.x} cy={pin.y} r={11} fill={tone.fill} stroke={tone.ring} strokeWidth={3} />
                <text
                  x={endAnchor ? pin.x - 16 : pin.x + 16}
                  y={below ? pin.y + 22 : pin.y - 16}
                  textAnchor={endAnchor ? "end" : "start"}
                  fill="#f8fafc"
                  fontSize={12}
                  fontWeight={700}
                >
                  {pin.label.replace(/^Buitenhaven\s+/, "")}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 px-4 py-3 text-[11px] text-slate-400">
        <Caption className="bg-status-clear" label="Groen — live, weg vrij" />
        <Caption className="bg-status-wait" label="Rood — live, weg dicht" />
        <Caption className="bg-status-soon" label="Geel — live, let op" />
        <Caption className="bg-slate-400" label="Grijs — geen live NDW" />
      </figcaption>
    </figure>
  );
}
