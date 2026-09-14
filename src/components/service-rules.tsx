import type { Bridge, Catalog, RushHold } from "@/lib/types";
import { rushHoldsForBridge } from "@/lib/status";

export function ServiceRules({
  catalog,
  bridge,
}: {
  catalog: Catalog;
  bridge: Bridge;
}) {
  const holds = rushHoldsForBridge(bridge, catalog.schedule);
  const unique = uniqueHolds(holds);

  if (unique.length === 0) {
    return (
      <p className="rounded-xl bg-white/4 px-4 py-6 text-sm leading-6 text-slate-400">
        Geen vaste bedientijden. {bridge.shortName} wordt op afroep bediend
        voor scheepvaart. De live stand staat op Status (NDW).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-slate-400">
        Officiële spitsvrij op weekdagen. Daarbuiten opent de brug op afroep.
        Live stand: Status (NDW).
      </p>
      <ul className="space-y-2">
        {unique.map((hold) => (
          <li
            key={hold.id}
            className="rounded-2xl border border-white/8 bg-slate-900/50 p-4"
          >
            <p className="font-mono text-sm tabular-nums text-canal">
              {hold.start}–{hold.end}
            </p>
            <p className="mt-1 text-sm text-slate-100">{hold.label}</p>
            {hold.detail ? (
              <p className="mt-1 text-sm text-slate-400">{hold.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-sm leading-6 text-slate-400">
        Maandag–vrijdag. Weekend: geen spitsvrij — openingen op afroep.
      </p>
    </div>
  );
}

function uniqueHolds(holds: RushHold[]): RushHold[] {
  const seen = new Set<string>();
  const out: RushHold[] = [];
  for (const hold of holds) {
    const key = `${hold.start}-${hold.end}-${hold.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hold);
  }
  return out;
}
