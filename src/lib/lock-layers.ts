import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import { LOCK_FRAME, chambersGeoJSON } from "@/lib/lock-map";

export function addChamberLayers(map: MapLibreMap, fill: string, line: string) {
  if (map.getSource("chambers")) return;
  map.addSource("chambers", { type: "geojson", data: chambersGeoJSON() });
  map.addLayer({
    id: "chambers-fill",
    type: "fill",
    source: "chambers",
    paint: { "fill-color": fill, "fill-opacity": 0.32 },
  });
  map.addLayer({
    id: "chambers-line",
    type: "line",
    source: "chambers",
    paint: { "line-color": line, "line-width": 2.2 },
  });
}

export function clearMarkers(markers: Marker[]) {
  markers.forEach((marker) => marker.remove());
}

export function lockMaxBounds(): [[number, number], [number, number]] {
  return [
    [LOCK_FRAME.bounds.west - 0.03, LOCK_FRAME.bounds.south - 0.03],
    [LOCK_FRAME.bounds.east + 0.03, LOCK_FRAME.bounds.north + 0.03],
  ];
}
