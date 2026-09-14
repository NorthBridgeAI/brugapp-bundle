# Brugapp

Persoonlijke PWA voor oversteekstatus op het Kanaal Gent–Terneuzen: **Noordzeesluizen Terneuzen**, **Draaibrug Sluiskil** en **Draaibrug Sas van Gent**.

Live stand via NDW DATEX. Geen officieel Rijkswaterstaat-rijadvies.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js on port 4317 |
| `npm run build` | Production build |
| `npm start` | Serve the production build on 4317 |
| `npm test` | Status, NDW parse, and route-advice tests |
| `npm run lint` | ESLint |

## Routes

| Path | What you see |
| --- | --- |
| `/` | Three status cards (Terneuzen, Sluiskil, Sas van Gent) |
| `/terneuzen` | Live IsoMap of the sluiscomplex (`iso-terneuzen-wall-top`) |
| `/terneuzen/a` | Draft A — dark MapLibre HUD (QA comparison, noindex) |
| `/terneuzen/a2` | Draft A2 — Buitenhaven as thick open/closed road spans (noindex) |
| `/terneuzen/a3` | Draft A3 — RWS/NWB/BGT geometry, live NDW on Oostsluis only (noindex) |
| `/terneuzen/a4` | Draft A4 — UX/cartography on A3: status on BGT decks, lock labels, compact HUD (noindex) |
| `/terneuzen/a5` | Draft A5 — premium visual on A4 + `?debug=1` simulation (noindex) |
| `/terneuzen/a6` | Draft A6 — outdoor readability / hierarchy on A5 (noindex) |
| `/terneuzen/b` | Draft B — light ops MapLibre (noindex) |
| `/terneuzen/c` | Draft C — WebGL 3D orbit (noindex) |
| `/zelzate` | 404 |

`/terneuzen` stays the IsoMap fallback. Do not promote A2, A3, A4, A5 or A6 to that URL.

## Draft A2 — how routes are drawn

Buitenhaven movable bridges are first-class **road spans**, not pins:

- Each OSM `bridge=movable` way is a thick MapLibre line (dark halo + white casing + status fill).
- **Green** = live NDW open (`clear` / `soon`), **red** = live NDW closed (`wait`), **gray** = geen live NDW.
- NDW only: `NLTNZ130B20497800009` (Buitenhaven noord) and `NLTNZ130B20497600005` (Buitenhaven Oostsluis).
- OSM-only spans (midden, Westsluis, zuid) stay gray and are labeled **geen live NDW**.
- First paint uses the same camera bar as Draft C: **Westsluis + Nieuwe Sluis + Oostsluis + both NDW bars**, including 390px, with no pan.
- **Route nu** and the legend sit in a compact **top** HUD. Map `fitBounds` padding matches that chrome so the south of the complex stays visible.
- If **both** NDW crossings are closed, A2 does **not** invent a green path.
- Westsluis / Oostsluis / Nieuwe Sluis remain cyan lock chambers + labels. Op afroep. Tap/click opens the status panel. Colors follow `/api/status`.

## Live NDW

Server-side only. Feeds:

- https://opendata.ndw.nu/actueel_beeld.xml.gz
- https://opendata.ndw.nu/planningsfeed_brugopeningen.xml.gz

| Object | ISRS |
| --- | --- |
| Buitenhaven Oostsluis | `NLTNZ130B20497600005` |
| Buitenhaven noord | `NLTNZ130B20497800009` |
| Draaibrug Sluiskil | `NLTNZ001300522000264` |
| Draaibrug Sas van Gent | `NLSVG001300521600186` |

Do not invent extra ISRS codes for Westsluis / Oostsluis / Nieuwe Sluis.

## Phase 2 geographic ground truth

Official NWB / RWS / BGT geometry for the Noordzeesluizen lives in [`src/data/geo/`](src/data/geo/). IsoMap and Draft A2 do not use it. Draft A3, A4 and A5 do.

Read the findings: [`docs/PHASE2-FINDINGS.md`](docs/PHASE2-FINDINGS.md). A3 ship notes: [`docs/A3-SHIP.md`](docs/A3-SHIP.md).

Do not treat OSM/A2 spans as truth. Do not paint unseen NDW as open.

## Draft A3 — `/terneuzen/a3`

- Geometry from RWS lock polygons, BGT decks, NWB roads (including roundabouts). Three operational locks; no Middensluis.
- Status paints: **Open / Dicht / Geen live data**. Adapter: `src/lib/a3-status.ts` (outside DATEX parse).
- Live NDW only on Oostsluis buitenhoofd (`…97800009`) and binnenhoofd (`…97600005`). Westsluis and Nieuwe Sluis stay **geen live data**.
- Recommended green route follows NWB Buitenhaven through **both** Oost bridges, and only when both are live OPEN. Closed or unseen Oost → no green path (no invented West/NS detour).
- Bottom recommendation card; map padding keeps 390px labels above the card.
- `noindex`. Do not promote over `/terneuzen`.

## Draft A4 — `/terneuzen/a4`

UX and cartography pass **on top of A3**. Same NDW adapter, NWB graph, and geo. Soft rollback: `/terneuzen/a3` is unchanged for compare.

- No floating West N/Z · Nieuwe N/Z · Oost N/Z chips. Status is the BGT deck fill (green / red / grey).
- Primary labels: **WESTSLUIS / NIEUWE SLUIS / OOSTSLUIS** only.
- Confirmed green route still follows NWB through both Oost decks when live OPEN. Closed = red obstruction on that deck only. Unknown = grey dashed, no recommend. Never a West/Nieuwe Sluis detour.
- Compact **LIVE** + ⓘ. Short bottom card. Concept/debug chrome is hidden unless `?debug=1`.
- Default iPhone portrait frame is the three locks plus approaches; padding tracks the compact chrome so the card does not clip the south.

Protected: `src/lib/ndw.ts`, `src/lib/ndw-parse.ts`, `src/lib/a3-status.ts` mapping, `src/lib/a3-geo.ts`, `src/data/geo/**`.

## Draft A5 — `/terneuzen/a5`

Visual upgrade **on top of A4**. Same NDW adapter, NWB graph, and geo. Soft rollback: `/terneuzen/a4` stays.

- Dark navy MapLibre, rich BGT water, bright NWB roads with casing, BGT decks as status fill (green / red / slate) plus slight extrusion.
- Cyan/green recommended route on NWB centerlines **only** when those crossings paint OPEN.
- Production still has no West/NS detour from missing ISRS. Unseen NDW never paints OPEN.
- `?debug=1` — client-only simulation per six bridges (OPEN / CLOSED / NO DATA / STALE). Banner **SIMULATION MODE**. Never writes DATEX, never changes `/api/status`, never leaks to A4 or IsoMap.
- QA scenario B: `/terneuzen/a5?debug=1&preset=b` opens Nieuwe N/Z so a real NWB detour can be shown without inventing live NDW.

`noindex`. Do not promote over `/terneuzen` or `/terneuzen/a4`.

## Draft A6 — `/terneuzen/a6`

Outdoor readability pass **on top of A5**. Same NDW adapter, NWB graph, and geo. Soft rollback: `/terneuzen/a5` and `/terneuzen/a4` stay.

- Hierarchy: recommended route > closed > selected > other states > roads > locks > water > surroundings > basemap.
- Normal NWB roads muted cool grey; Buitenhaven / lower FRC slightly brighter. Confirmed route green/cyan with glow. Closed = red on that deck only. No-data = slate. Open decks stay calm grey — never paint the whole map green.
- Permanent labels only: WESTSLUIS / NIEUWE SLUIS / OOSTSLUIS (no WEST/NIEUWE overlap). Six “Geen live data” floating cards removed.
- Consumer bottom card. `Route opties` disabled without a confirmed route.
- `?debug=1` client-only simulation. Presets: `preset=a` all-unknown, `preset=b` Oost-Z closed + Nieuwe OPEN detour, `preset=c` all-open. Banner **SIMULATION MODE**. Never writes DATEX or leaks to A5/A4/IsoMap.

Protected: `src/lib/ndw.ts`, `src/lib/ndw-parse.ts`, `src/lib/a3-status.ts` mapping, `src/lib/a3-geo.ts`, `src/lib/a3-routes.ts`, `src/data/geo/**`.

## Deploy

File-deploy the full source tree onto the existing Vercel project `brugapp` (`prj_zoDMumTKp05Vd8dAe6SLzl9ZfyVw`). Origin git webhooks are flaky — do not create a new Vercel project.

Every production file-deploy **must** include `/terneuzen/a4` (and A3 / A2 / IsoMap `/terneuzen`). Never ship a tree that 404s A4.

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS origin when you have one. Loopback is never written into production HTML.
