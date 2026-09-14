/**
 * Phase 2 ground-truth catalog. Draft A3 (`/terneuzen/a3`) reads these files.
 * NDW fetch/parse is unchanged; unseen ISRS must never paint open.
 */
import index from "./index.json";

export const GEO_GROUND_TRUTH = index;

export const PHASE2_NDW_ISRS = {
  "NLTNZ130B20497600005": "oostsluis-binnenhoofd",
  "NLTNZ130B20497800009": "oostsluis-buitenhoofd",
} as const;

export const OPERATIONAL_LOCKS = [
  "westsluis",
  "nieuwe-sluis",
  "oostsluis",
] as const;

export const GEO_FILES = {
  locks: "src/data/geo/locks-rws.geojson",
  chambers: "src/data/geo/lock-chambers-rws.geojson",
  bridges: "src/data/geo/bridges-rws.geojson",
  bridgeDecks: "src/data/geo/bridges-bgt-decks.geojson",
  roundabouts: "src/data/geo/roundabouts-nwb.geojson",
  roads: "src/data/geo/roads-nwb-lock-island.geojson",
  water: "src/data/geo/water-bgt.geojson",
  isrs: "src/data/geo/isrs-rws.geojson",
} as const;
