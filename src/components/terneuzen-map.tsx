import type { LandmarkDef, LiveCrossingHit, RoadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const BBOX = {
  latMin: 51.3248,
  latMax: 51.3388,
  lngMin: 3.8138,
  lngMax: 3.8232,
};

const W = 360;
const H = 540;
const PAD = 22;

function project(lat: number, lng: number) {
  const x =
    PAD + ((lng - BBOX.lngMin) / (BBOX.lngMax - BBOX.lngMin)) * (W - PAD * 2);
  const y =
    PAD + ((BBOX.latMax - lat) / (BBOX.latMax - BBOX.latMin)) * (H - PAD * 2);
  return { x, y };
}

const PIN: Record<RoadStatus, { fill: string; ring: string; label: string }> = {
  clear: { fill: "var(--status-clear)", ring: "#022c22", label: "Weg vrij" },
  wait: { fill: "var(--status-wait)", ring: "#3f0d0d", label: "Weg dicht" },
  soon: { fill: "var(--status-soon)", ring: "#3f2d00", label: "Let op" },
  unknown: { fill: "#94a3b8", ring: "#1e293b", label: "Geen live NDW" },
};

export function TerneuzenMap({
  crossings,
  landmarks,
}: {
  crossings: LiveCrossingHit[];
  landmarks: LandmarkDef[];
}) {
  const pins = crossings.map((crossing) => ({
    ...crossing,
    ...project(crossing.coordinates.lat, crossing.coordinates.lng),
  }));
  const marks = landmarks.map((landmark) => ({
    ...landmark,
    ...project(landmark.coordinates.lat, landmark.coordinates.lng),
  }));
  const road = pins
    .slice()
    .sort((a, b) => a.coordinates.lat - b.coordinates.lat)
    .map((pin) => `${pin.x.toFixed(1)},${pin.y.toFixed(1)}`)
    .join(" ");

  const scheldt = [
    project(51.3388, 3.8138),
    project(51.3388, 3.8232),
    project(51.3364, 3.8232),
    project(51.3366, 3.8138),
  ];
  const canalTop = project(51.3362, 3.8199);
  const canalBottom = project(51.3248, 3.8186);

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950 ring-1 ring-white/5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        className="h-auto w-full"
        aria-label="Kaart van de Noordzeesluizen en Buitenhaven. Groen is weg vrij, rood is weg dicht, grijs is geen live NDW."
      >
        <title>Noordzeesluizen Terneuzen — Buitenhaven</title>
        <rect width={W} height={H} fill="#0b1220" />

        <polygon
          points={scheldt.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="#0e3a44"
        />
        <text
          x={W / 2}
          y={project(51.3378, 3.818).y}
          textAnchor="middle"
          fill="#7dd3d8"
          fontSize="11"
          letterSpacing="0.16em"
        >
          WESTERSCHELDE
        </text>

        <path
          d={`M ${canalTop.x - 16} ${canalTop.y}
              L ${canalBottom.x - 14} ${canalBottom.y}
              L ${canalBottom.x + 16} ${canalBottom.y}
              L ${canalTop.x + 18} ${canalTop.y} Z`}
          fill="#134e4a"
        />
        <text
          x={canalBottom.x}
          y={canalBottom.y - 10}
          textAnchor="middle"
          fill="#99f6e4"
          fontSize="10"
          letterSpacing="0.12em"
        >
          KANAAL
        </text>

        {marks.map((mark) => (
          <g key={mark.id}>
            <rect
              x={mark.x - 16}
              y={mark.y - 22}
              width={32}
              height={44}
              rx={3}
              fill="#155e75"
              stroke="#67e8f9"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
            <text
              x={mark.x + (mark.id === "westsluis" ? -22 : 22)}
              y={mark.y + 3}
              textAnchor={mark.id === "westsluis" ? "end" : "start"}
              fill="#94a3b8"
              fontSize="8"
            >
              {mark.label}
            </text>
          </g>
        ))}

        {road ? (
          <polyline
            points={road}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.55}
          />
        ) : null}

        {pins.map((pin) => {
          const tone = PIN[pin.road];
          const labelLeft = pin.x > W * 0.55;
          return (
            <g key={pin.id}>
              <circle
                cx={pin.x}
                cy={pin.y}
                r={10}
                fill={tone.fill}
                stroke={tone.ring}
                strokeWidth={3}
              >
                <title>
                  {pin.label}: {tone.label}
                  {pin.isrs ? ` · ${pin.isrs}` : ""}
                </title>
              </circle>
              <text
                x={labelLeft ? pin.x - 13 : pin.x + 13}
                y={pin.y - 12}
                textAnchor={labelLeft ? "end" : "start"}
                fill="#e2e8f0"
                fontSize="10"
                fontWeight={600}
              >
                {shortLabel(pin.label)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 border-t border-white/8 px-4 py-3 text-[11px] text-slate-400">
        <LegendSwatch className="bg-status-clear" label="Groen — weg vrij" />
        <LegendSwatch className="bg-status-wait" label="Rood — weg dicht" />
        <LegendSwatch className="bg-status-soon" label="Geel — let op" />
        <LegendSwatch className="bg-slate-400" label="Grijs — geen live NDW" />
      </figcaption>
    </figure>
  );
}

function shortLabel(label: string): string {
  return label.replace(/^Buitenhaven\s+/, "");
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} aria-hidden />
      {label}
    </span>
  );
}
