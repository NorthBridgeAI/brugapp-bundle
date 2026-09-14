declare module "*.geojson" {
  const value: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      properties: Record<string, unknown>;
      geometry:
        | { type: "Point"; coordinates: [number, number] }
        | { type: "LineString"; coordinates: [number, number][] }
        | { type: "MultiLineString"; coordinates: [number, number][][] }
        | { type: "Polygon"; coordinates: [number, number][][] }
        | { type: "MultiPolygon"; coordinates: [number, number][][][] };
    }>;
  };
  export default value;
}
