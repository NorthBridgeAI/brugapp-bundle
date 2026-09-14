# A3 Phases 3–7 — ship notes

**Scope:** `/terneuzen/a3` only (noindex). Live `/terneuzen` IsoMap and Draft A2 unchanged. `src/lib/ndw.ts` and `src/lib/ndw-parse.ts` untouched.

**Geometry:** Phase 2 `src/data/geo/` (RWS locks/chambers/bridges, BGT decks/water, NWB roads + roundabouts). A2 OSM spans are corroboration only.

## Phase milestones

| Phase | What shipped |
| --- | --- |
| 3 | Static MapLibre dark HUD: BGT water, NWB roads + roundabouts, RWS chambers (scale-correct 290×38 / 427×55 / 280×24), six BGT decks. No Middensluis. |
| 4 | Confirmed NDW only: `NLTNZ130B20497800009` → Oostsluis N (buitenhoofd), `NLTNZ130B20497600005` → Oostsluis S (binnenhoofd). Westsluis + Nieuwe Sluis flagged **NO LIVE DATA**. |
| 5 | Live paint via `/api/status` → `getNdwSnapshot()` (adapter `src/lib/a3-status.ts`). Status model **OPEN / CLOSED / NO LIVE DATA**. Unseen DATEX `road=clear` does **not** paint open. |
| 6 | NWB graph (roads + FOW=4/NRB roundabouts, edges split at RWS bridge points). Recommended green line = Oost binnenhoofd → buitenhoofd corridor **only if both NDW paints are OPEN**. Both closed → no green path (no West/NS detour). |
| 7 | Bottom recommendation card, live clock, legend, lock + bridge labels, 390px padding so the card does not clip south labels, WebGL fallback SVG from the same geo. |

## NDW mapping

| ISRS | A3 bridge id | Official | Paint if unseen |
| --- | --- | --- | --- |
| `NLTNZ130B20497800009` | `oostsluis-buitenhoofd` | Brug over buitenhoofd Oostsluis | NO LIVE DATA |
| `NLTNZ130B20497600005` | `oostsluis-binnenhoofd` | Brug over binnenhoofd Oostsluis | NO LIVE DATA |
| — | `westsluis-noord` | Noordbrug over Westsluis | NO LIVE DATA |
| — | `westsluis-zuid` | Zuidbrug Westsluis | NO LIVE DATA |
| — | `nieuwe-sluis-buitenhoofd` | Brug over buitenhoofd Nieuwe Sluis | NO LIVE DATA |
| — | `nieuwe-sluis-binnenhoofd` | Brug over binnenhoofd Nieuwe Sluis | NO LIVE DATA |

`soon` has no fourth paint: treated as **OPEN** (road still usable) with “let op” copy on the card.

## Remaining uncertain mappings (not wired)

- RWS `canopen=No` on Nieuwe Sluis bridges vs 2024 lift-bridge project copy. Geometry is used; movability is not a reason to invent NDW.
- RIS `bridge_5` doorvaartopening codes `NLTNZ0130E5086900307` / `NLTNZ0130E5087000302` exist on Nieuwe Sluis. **Not** added to the DATEX fetch.
- Catalog object `terneuzen` still uses Oost S ISRS in `ndw.ts` (unchanged). A3 looks up hits **by ISRS**, not by that catalog id.
