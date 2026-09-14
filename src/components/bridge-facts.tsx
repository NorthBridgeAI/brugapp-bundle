import { MapPin, Radio, Ruler, Phone } from "lucide-react";
import { countryLabel, geoUrl, mapsUrl } from "@/lib/time";
import type { Bridge } from "@/lib/types";

export function BridgeFacts({ bridge }: { bridge: Bridge }) {
  const { lat, lng } = bridge.coordinates;
  const items = [
    {
      icon: MapPin,
      label: "Locatie",
      value: `${bridge.locality}, ${countryLabel(bridge.country)}`,
      href: mapsUrl(lat, lng),
      extra: `${lat.toFixed(3)}°N ${lng.toFixed(4)}°E`,
    },
    {
      icon: Radio,
      label: "Marifoon",
      value: bridge.vhfChannel
        ? `VHF ${bridge.vhfChannel} · ${bridge.callSign}`
        : "Onbekend",
    },
    {
      icon: Ruler,
      label: "Doorvaart gesloten",
      value: `${bridge.clearanceClosedM.toString().replace(".", ",")} m bij kanaalpeil`,
    },
    {
      icon: Phone,
      label: "Beheerder",
      value: bridge.operatorPhone
        ? `${bridge.operator} · ${bridge.operatorPhone}`
        : bridge.operator,
      href: bridge.operatorPhone
        ? `tel:${bridge.operatorPhone.replace(/\s+/g, "")}`
        : undefined,
    },
  ];

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        const body = (
          <>
            <dt className="flex items-center gap-2 text-xs tracking-wide text-slate-400 uppercase">
              <Icon className="size-3.5" />
              {item.label}
            </dt>
            <dd className="mt-1 text-sm text-slate-100">{item.value}</dd>
            {"extra" in item && item.extra ? (
              <dd className="font-mono text-xs text-slate-400">{item.extra}</dd>
            ) : null}
          </>
        );
        return item.href ? (
          <a
            key={item.label}
            href={item.href}
            className="rounded-2xl border border-white/8 bg-slate-900/50 p-4 transition-colors hover:border-canal/40 focus-visible:ring-2 focus-visible:ring-canal"
          >
            {body}
          </a>
        ) : (
          <div
            key={item.label}
            className="rounded-2xl border border-white/8 bg-slate-900/50 p-4"
          >
            {body}
          </div>
        );
      })}
      <a
        href={geoUrl(lat, lng)}
        className="sr-only"
      >
        Open locatie in kaarten-app
      </a>
    </dl>
  );
}
