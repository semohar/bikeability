import mapboxgl from 'mapbox-gl';

export interface MapConfig {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface RouteStats {
  totalDistance: number;  // meters
  totalClimb: number;     // meters
  totalDescent: number;   // meters
  maxGrade: number;       // percent
  segmentCount: number;
}

export type MapInstance = mapboxgl.Map | null;