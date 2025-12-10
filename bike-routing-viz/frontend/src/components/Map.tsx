import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteResponse } from '../types/api.types';
import type { MapInstance } from '../types/map.types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapProps {
  route: RouteResponse | null;
  onMapLoad?: (map: mapboxgl.Map) => void;
}

export default function Map({ route, onMapLoad }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance>(null);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [-90.1994, 38.6270],
      zoom: 12,
      pitch: 45,
      bearing: 0,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.ScaleControl({ maxWidth: 100, unit: 'imperial' }),
      'bottom-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14,
      });

      map.current.addLayer({
        id: 'sky',
        type: 'sky',
        paint: {
          'sky-type': 'atmosphere',
          'sky-atmosphere-sun': [0.0, 0.0],
          'sky-atmosphere-sun-intensity': 15,
        },
      });

      if (onMapLoad && map.current) {
        onMapLoad(map.current);
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [onMapLoad]);

  useEffect(() => {
    if (!map.current || !route) return;

    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    const validFeatures = route.features.filter(
      (f) => f.geometry && f.geometry.coordinates
    );

    if (validFeatures.length === 0) {
      console.error('No valid route features');
      return;
    }

    const validRoute: RouteResponse = {
      ...route,
      features: validFeatures,
    };

    map.current.addSource('route', {
      type: 'geojson',
      data: validRoute,
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': [
          'interpolate',
          ['linear'],
          ['get', 'grade_percent'],
          -10, '#0000ff',
          -2, '#00aaff',
          0, '#00ff00',
          2, '#ffff00',
          5, '#ff8800',
          8, '#ff0000',
        ],
        'line-width': 6,
        'line-opacity': 0.8,
      },
    });

    map.current.on('click', 'route', (e) => {
      if (!e.features || e.features.length === 0) return;

      const properties = e.features[0].properties;
      
      new mapboxgl.Popup()
        .setLngLat(e.lngLat)
        .setHTML(`
          <h4>${properties?.name || 'Unnamed Road'}</h4>
          <p><strong>Grade:</strong> ${properties?.grade_percent}%</p>
          <p><strong>Length:</strong> ${properties?.length_m}m</p>
          <p><strong>Elevation Change:</strong> ${properties?.elevation_change_m}m</p>
          <p><strong>Type:</strong> ${properties?.road_type}</p>
        `)
        .addTo(map.current!);
    });

    map.current.on('mouseenter', 'route', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    });

    map.current.on('mouseleave', 'route', () => {
      if (map.current) {
        map.current.getCanvas().style.cursor = '';
      }
    });

    const coordinates = validFeatures.flatMap((f) => f.geometry.coordinates);
    
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord as [number, number]),
      new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number])
    );

    map.current.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 400, right: 50 },
      duration: 1500,
    });
  }, [route]);

  return (
    <div
      ref={mapContainer}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '100%',
      }}
    />
  );
}