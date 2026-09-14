# PHASE 2 FINDINGS — Geographic verification

**Run date:** 2026-09-14  
**Scope:** Noordzeesluizen Terneuzen (Westsluis, Nieuwe Sluis, Oostsluis).  
**Not in this run:** A3 UI, restyle of A2, changes to `/terneuzen` IsoMap, changes to `src/lib/ndw.ts` / `src/lib/ndw-parse.ts`, Vercel production deploy.

Live Brugapp source was recovered from Vercel project `brugapp` (`prj_zoDMumTKp05Vd8dAe6SLzl9ZfyVw`). The production install command unpacks `https://litter.catbox.moe/odx6y1.tgz` (file-deploy source). Origin slug `northbridge-ai-solutions/tmp-cc7c30cf8d5a6bd6` is linked but this session’s git token cannot clone it (403 / scoped token).

---

## Sources used (with dates)

| # | Source | What was taken | Retrieved |
| --- | --- | --- | --- |
| 1 | **Nationaal Wegenbestand (NWB) Wegen** — PDOK OGC API Features, collection `wegvakken`. CC0. Service timestamp `2026-09-14T08:58:37Z`. Dominant `bronjaar` in the bbox: **2026** (BGT-derived). | Road centerlines, roundabouts (`FOW=4` + `BST=NRB`) | 2026-09-14T08:58:37Z |
| 2 | **Rijkswaterstaat FIS/VNDS** OGC API — collections `sluis_v`, `sluiskolk_v`, `brug`, `isrs_object`. | Lock polygons, chamber attributes, bridge points, ISRS | 2026-09-14T08:57Z |
| 3 | **BGT** — PDOK OGC API Features (`datetime=2026-09-14T08:58:37Z`, `status=bestaand`). CC0. | Waterdeel, overbruggingsdeel decks, kunstwerkdeel sluis parts, one roundabout surface | 2026-09-14T08:58–08:59Z |
| 4 | **Rijkswaterstaat news** [Nieuwe Sluis in Terneuzen koninklijk geopend](https://www.rijkswaterstaat.nl/nieuws/archief/2024/10/nieuwe-sluis-in-terneuzen-koninklijk-geopend) | 427×55×16.44 m; Middensluis replaced; official opening **11 Oct 2024** | published 2024-10-11, read 2026-09-14 |
| 5 | **BAM Infra project page** (design corroboration, not geometry) | Bridges **84×18 m** | read 2026-09-14 |
| 6 | **PDOK Actueel_orthoHR WMS** | Visual check only | 2026-09-14 |
| — | Live Brugapp A2 `BUITENHAVEN_SPANS` (OSM ways) | Corroboration only — **not truth** | from recovered tree |

Basemap tiles were **not** used as geometry.

---

## Verified

### Operational locks (3). No Middensluis as an operational lock

RWS `sluis_v` in the complex bbox returns **exactly three** features, all `condition=CONSTRUCTED`:

| Lock | RWS `sluis_v` | RWS `sluiskolk_v` | Notes |
| --- | --- | --- | --- |
| **Westsluis Terneuzen** | 1 chamber, rotation 142. Length/width attributes empty. | **290 × 38 m**, gate 38 m, roldeuren | A2 used 280×40 — close, not official |
| **Nieuwe Sluis Terneuzen** | **427 × 55 m** | **417 × 55 m**, gate 49 m, roldeuren, sill buiten −16.44 m | Matches RWS news 427×55×16.44. Between West and Oost |
| **Oostsluis Terneuzen** | 1 chamber, rotation 166. Length/width empty. | **280 × 24 m**, gate 24 m, puntdeuren, schutlengte vloed 260 m | A2 used 260×38 — **wrong width** (38 m is Westsluis / catalog movable width, not Oostsluis chamber) |

**Scale differences are real:** Oostsluis is a much narrower inland lock (24 m); Westsluis is a seagoing lock (38 m); Nieuwe Sluis is larger still (55 m / 427 m). PDOK orthoHR visual check agrees.

**Middensluis:** not present in `sluis_v` / `sluiskolk_v`. RWS (11 Oct 2024): the Middensluis (in use since 1910) **made place for** the Nieuwe Sluis; demolition used explosives in March 2022. Residual RIS names (`Toeleidingskanaal naar Middensluis…`, terminal `BINNENZIJDE MIDDENSLUIS WESTZ`) are leftover toponyms, **not** an operational lock.

### Bridges

RWS `brug` (points, all `CONSTRUCTED`) — six road bridges:

| Official name | Id | Compass | RWS `canopen` | BGT deck min-rect | NDW ISRS |
| --- | --- | --- | --- | --- | --- |
| Brug over **buitenhoofd Oostsluis** | `oostsluis-buitenhoofd` | north | Yes | **31.6 × 20.1 m** | **`NLTNZ130B20497800009`** |
| Brug over **binnenhoofd Oostsluis** | `oostsluis-binnenhoofd` | south | Yes | **31.8 × 19.9 m** | **`NLTNZ130B20497600005`** |
| **Noordbrug over Westsluis** | `westsluis-noord` | north | Yes | **60.4 × 18.5 m** | none in live DATEX fetch |
| **Zuidbrug Westsluis** | `westsluis-zuid` | south | Yes | **60.3 × 18.4 m** | none in live DATEX fetch |
| Brug over **buitenhoofd Nieuwe Sluis** | `nieuwe-sluis-buitenhoofd` | north | No (attribute) | **84.9 × 17.8 m** | not in live DATEX fetch |
| Brug over **binnenhoofd Nieuwe Sluis** | `nieuwe-sluis-binnenhoofd` | south | No (attribute) | **84.9 × 17.6 m** | not in live DATEX fetch |

Nieuwe Sluis N/S decks match BAM **84 × 18 m**. That size is **not** the Westsluis or Oostsluis decks.

**NDW mapping (for Phase 3+, fetch unchanged):**

- `NLTNZ130B20497800009` = Oostsluis **north** (buitenhoofd). A2 label “Buitenhaven noord” is geographically this span.
- `NLTNZ130B20497600005` = Oostsluis **south** (binnenhoofd). A2 label “Buitenhaven Oostsluis” is this span.

A2 OSM “buitenhaven-midden” sits on **Nieuwe Sluis buitenhoofd** (north), not a middle lock. A2 has **no** span for Nieuwe Sluis binnenhoofd (south).

Nieuwe Sluis also has RIS `bridge_5` doorvaartopening codes (`NLTNZ0130E5086900307`, `NLTNZ0130E5087000302`). Those are **not** in the live NDW fetch list and must not be invented as extra DATEX queries in later phases without an explicit decision. Unseen must **never** paint open.

### Roundabout + road connections

NWB `FOW=4` / `BST=NRB` (official roundabout carriageway):

1. **`roundabout-nieuwe-oost`** — Buitenhaven, ≈ 3.8193, 51.33285, **between Nieuwe Sluis and Oostsluis**. Verified.
2. **`roundabout-kennedylaan`** — Buitenhaven / Kennedylaan / Schependijk / Binnenvaartweg, ≈ 3.8219, 51.3333. Road connection east of the island. Matching BGT `rijbaan lokale weg` ring ~42×42 m.
3. **`roundabout-binnenvaartweg-noord`** — Binnenvaartweg, ≈ 3.8213, 51.3360, east of Oostsluis buitenhoofd.

Lock-island rijbanen (Buitenhaven, Kennedylaan, Binnenvaartweg, Schependijk, Westkolkstraat) stored as NWB centerlines.

### Water

BGT `waterdeel` `type=waterloop`, `status=bestaand`, 84 polygons in the lock-island bbox. Westerschelde / Buitenhaven / lock chambers / Kanaal Gent–Terneuzen are present as published polygons. Not reconstructed.

---

## Could not be verified / disagreements

| Topic | Status |
| --- | --- |
| RWS `brug` **length/width** for any of the six bridges | Empty. Deck size from **BGT polygons** (+ BAM for NS 84×18 corroboration). |
| Nieuwe Sluis **movable** flag | RWS `canopen=No`; BGT `overbrugging_is_beweegbaar=false`. Reality/news: lift bridges that open for shipping. **Geometry verified; movability attribute is stale.** Prefer geometry from BGT/RWS; do not treat `canopen=No` as “fixed road forever” in A3 without a product decision. |
| Full **Nieuwe Sluis chamber outline** | RWS `sluis_v` / `sluiskolk_v` is a **5-vertex rectangle**, not a surveyed outline. BGT `kunstwerkdeel` `type=sluis` is only heads/gates (~65×10 m parts), not the full 427 m chamber. **Do not invent a detailed chamber polygon.** Use the official rectangle + 427×55 attributes. |
| Westsluis / Oostsluis **design length** on `sluis_v` | Attributes empty; use `sluiskolk_v` 290×38 and 280×24. |
| Exact **photo date** of PDOK Actueel_orthoHR | Mosaic vintage not in the WMS GetMap. Check only. The snapshot still shows three chambers, NS much larger, roundabout between NS and Oost, no Middensluis. |
| Live **NDW** for Westsluis, Nieuwe Sluis, Oostsluis heads beyond the two known ISRS | Out of Phase 2. Do not add ISRS to the DATEX client in this run. |
| BGT ring polygon for **roundabout-nieuwe-oost** | NWB NRB centerlines are official. No equally clear compact BGT ring was selected; **not invented**. |

On disagreement, official Dutch geodata (NWB / RWS FIS / BGT) wins over OSM/A2. News/BAM win only for attributes the geodata omit (2024 opening, 84×18 design, Middensluis demolition).

---

## Ground-truth file paths

All under `src/data/geo/` (not wired into IsoMap or A2):

| File | Role |
| --- | --- |
| `index.json` | Catalog, sources, NDW→bridge map |
| `ground-truth.ts` | Typed pointer for later phases |
| `locks-rws.geojson` | 3 lock polygons (`sluis_v`) |
| `lock-chambers-rws.geojson` | 3 chambers with official L×W |
| `bridges-rws.geojson` | 6 RWS bridge points |
| `bridges-bgt-decks.geojson` | 6 BGT deck polygons |
| `roundabouts-nwb.geojson` | NWB NRB roundabout carriageways |
| `roundabout-kennedylaan-bgt.geojson` | BGT surface for eastern roundabout |
| `roads-nwb-lock-island.geojson` | Connecting rijbanen |
| `water-bgt.geojson` | BGT waterloop |
| `isrs-rws.geojson` | RIS objects (incl. leftover Middensluis names) |
| `lock-structure-parts-bgt.geojson` | BGT sluis parts (not full chambers) |
| `corroboration-a2-osm-spans.geojson` | A2 OSM — **not truth** |
| `checks/luchtfoto-orthoHR.jpg` | Imagery check only |
| `scripts/build-phase2-geo.py` | Rebuild from `/tmp/geo` extracts |

---

## A2 vs official (corroboration notes for Phase 3+)

- A2 chambers are **invented rectangles** from guessed L×W/heading, not RWS polygons.
- A2 Oostsluis width 38 m is incorrect (official 24 m).
- A2 five OSM spans ≠ six official road bridges (missing Nieuwe Sluis south).
- A2 “Buitenhaven noord” is Oostsluis north, not a separate harbour mouth object.
- Do **not** restyle A2 into A3. Phase 3+ should draw from these GeoJSON files.

NDW live codes stay `NLTNZ130B20497600005` and `NLTNZ130B20497800009`. Unseen crossings stay unknown/grey — never open.

---

## Blockers

1. **Origin clone 403** — live git `tmp-cc7c30cf8d5a6bd6` is not readable with this session token. Recovery used the Vercel install tarball instead. Fine for this run; future deploys should stop depending on catbox if the tree now lives in this repo.
2. **RWS Nieuwe Sluis outline is a coarse rectangle.** A3 must not fake a surveyed chamber.
3. **Movability attributes for Nieuwe Sluis bridges disagree** with 2024 project documentation. Geometry is OK; status logic is a Phase 4/5 product decision.
4. **No production deploy** this run (by request). `/terneuzen` IsoMap on `brugapp` is untouched.

No blocker prevents Phase 3 from consuming the ground-truth layer.
