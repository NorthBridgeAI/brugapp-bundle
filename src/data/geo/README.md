# Phase 2 geographic ground truth

Official Dutch geodata for the **Noordzeesluizen Terneuzen**. Draft A3 (`/terneuzen/a3`) reads these files. IsoMap and Draft A2 do not.

OSM / Draft A2 spans are **not** truth. They live in `corroboration-a2-osm-spans.geojson` only.

TypeScript imports the `.json` siblings (byte copies of the `.geojson` ground truth) because Next and `tsx` resolve JSON modules. Rebuild writes both suffixes.

## CRS

WGS84 / CRS84 (`lng, lat`).

## Source note

Every FeatureCollection has a top-level `source` object (`name`, `url`, `retrievedAt`, license). Every feature has `_source` and `_retrievedAt`. See `index.json`.

Retrieved **2026-09-14T08:58:37Z**.

| Priority | Dataset | Files |
| --- | --- | --- |
| 1 | Nationaal Wegenbestand (PDOK) | `roads-nwb-lock-island.geojson`, `roundabouts-nwb.geojson` |
| 2 | Rijkswaterstaat FIS vaarwegen | `locks-rws.geojson`, `lock-chambers-rws.geojson`, `bridges-rws.geojson`, `isrs-rws.geojson` |
| 3 | BGT (PDOK) | `water-bgt.geojson`, `bridges-bgt-decks.geojson`, `roundabout-kennedylaan-bgt.geojson`, `lock-structure-parts-bgt.geojson` |
| 4 | PDOK Actueel_orthoHR | `checks/luchtfoto-orthoHR.jpg` (visual check only) |
| — | Live Brugapp A2 OSM | `corroboration-a2-osm-spans.geojson` (not truth) |

Rebuild from `/tmp/geo` extracts with `python3 scripts/build-phase2-geo.py` (the extracts are not committed).

Do not import these files into `/terneuzen` IsoMap or Draft A2.
