// GeoJSON types for routes
export interface RouteFeature {
  type: 'Feature';
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    name: string;
    length_m: number;
    grade_percent: number;
    elevation_change_m: number;
    road_type: string;
    seq: number;
  };
}

export interface RouteResponse {
  type: 'FeatureCollection';
  features: RouteFeature[];
}

// Node from database
export interface Node {
  id: number;
  lat: number;
  lon: number;
}

// Elevation profile point
export interface ElevationPoint {
  seq: number;
  name: string | null;
  elevation_start_m: number;
  elevation_end_m: number;
  grade_percent: number;
  length_m: number;
  cumulative_distance_m: number;
}

// API error response
export interface ApiError {
  error: string;
  details?: string;
}

// Route type
export type RouteType = 'fastest' | 'safest';