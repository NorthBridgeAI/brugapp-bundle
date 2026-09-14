import type { StyleSpecification } from "maplibre-gl";

function rasterStyle(
  name: string,
  tiles: string[],
  attribution: string,
  background: string,
): StyleSpecification {
  return {
    version: 8,
    name,
    sources: {
      base: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution,
        maxzoom: 19,
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": background } },
      { id: "base", type: "raster", source: "base" },
    ],
  };
}

export const DARK_RASTER_STYLE = rasterStyle(
  "brugapp-dark",
  [
    "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  ],
  "Tiles © Esri — Esri, TomTom, Garmin, FAO, NOAA, USGS",
  "#1b2a3d",
);

export const LIGHT_RASTER_STYLE = rasterStyle(
  "brugapp-light",
  [
    "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png",
  ],
  "© Kadaster / PDOK · BRT Achtergrondkaart",
  "#d9e2ea",
);
