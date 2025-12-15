import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { RouteResponse, CrashIncident } from '../types/api.types';
import type { MapInstance } from '../types/map.types';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapProps {
  route: RouteResponse | null;
  onMapLoad?: (map: mapboxgl.Map) => void;
}

export default function Map({ route, onMapLoad }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance>(null);
  const [selectedCrash, setSelectedCrash] = useState<CrashIncident | null>(null);

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

  // Handle route display
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
          <div style="padding: 8px;">
            <h4 style="margin: 0 0 8px 0; font-weight: bold;">${properties?.name || 'Unnamed Road'}</h4>
            <p style="margin: 4px 0;"><strong>Grade:</strong> ${properties?.grade_percent}%</p>
            <p style="margin: 4px 0;"><strong>Length:</strong> ${properties?.length_m}m</p>
            <p style="margin: 4px 0;"><strong>Elevation Change:</strong> ${properties?.elevation_change_m}m</p>
            <p style="margin: 4px 0;"><strong>Type:</strong> ${properties?.road_type}</p>
            <p style="margin: 4px 0;"><strong>Crashes:</strong> ${properties?.crash_count || 0}</p>
          </div>
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

  // Handle crash display
  useEffect(() => {
    if (!map.current || !route) return;

    const mapInstance = map.current;

    // Remove existing crash layers if they exist
    if (mapInstance.getLayer('crashes')) {
      mapInstance.removeLayer('crashes');
    }
    if (mapInstance.getSource('crashes')) {
      mapInstance.removeSource('crashes');
    }

    // Add crashes to map if they exist
    if (route.crashes && route.crashes.length > 0) {
      mapInstance.addSource('crashes', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: route.crashes
        }
      });

      // Add crash points
      mapInstance.addLayer({
        id: 'crashes',
        type: 'circle',
        source: 'crashes',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'severity'], 'Fatal'], 8,
            ['==', ['get', 'severity'], 'Serious Injury'], 6,
            4
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'severity'], 'Fatal'], '#DC2626',
            ['==', ['get', 'severity'], 'Serious Injury'], '#EA580C',
            ['==', ['get', 'severity'], 'Personl Injury'], '#F59E0B',
            '#FCD34D'
          ],
          'circle-opacity': 0.7,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF'
        }
      });

      // Add click handler for crashes
      mapInstance.on('click', 'crashes', (e) => {
        if (e.features && e.features[0]) {
          const crash = e.features[0] as any;
          setSelectedCrash({
            type: 'Feature',
            geometry: crash.geometry,
            properties: crash.properties
          });

          // Create popup
          new mapboxgl.Popup()
            .setLngLat(crash.geometry.coordinates)
            .setHTML(`
              <div style="padding: 8px; min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; font-weight: bold; color: #DC2626;">${crash.properties.severity}</h4>
                <p style="margin: 4px 0;"><strong>Type:</strong> ${crash.properties.crash_type}</p>
                <p style="margin: 4px 0;"><strong>Date:</strong> ${crash.properties.date}</p>
                <p style="margin: 4px 0;"><strong>Time:</strong> ${crash.properties.time || 'Unknown'}</p>
                <p style="margin: 4px 0;"><strong>Location:</strong> ${crash.properties.on_street} / ${crash.properties.at_street}</p>
                ${crash.properties.injured > 0 ? `<p style="margin: 4px 0;"><strong>Injured:</strong> ${crash.properties.injured}</p>` : ''}
                ${crash.properties.killed > 0 ? `<p style="margin: 4px 0; color: #DC2626;"><strong>Killed:</strong> ${crash.properties.killed}</p>` : ''}
                <p style="margin: 4px 0; font-size: 12px; color: #6B7280;"><strong>Distance from route:</strong> ${crash.properties.distance_from_route_m}m</p>
              </div>
            `)
            .addTo(mapInstance);
        }
      });

      // Change cursor on hover
      mapInstance.on('mouseenter', 'crashes', () => {
        mapInstance.getCanvas().style.cursor = 'pointer';
      });

      mapInstance.on('mouseleave', 'crashes', () => {
        mapInstance.getCanvas().style.cursor = '';
      });
    }

    // Cleanup
    return () => {
      if (mapInstance.getLayer('crashes')) {
        mapInstance.off('click', 'crashes');
        mapInstance.off('mouseenter', 'crashes');
        mapInstance.off('mouseleave', 'crashes');
      }
    };
  }, [route]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={mapContainer}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '100%',
        }}
      />
      
      {/* Crash legend */}
      {route && route.crashes && route.crashes.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1,
          minWidth: '180px'
        }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '14px', 
            fontWeight: 'bold' 
          }}>
            Crashes Along Route
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: '#DC2626',
                border: '2px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px' }}>Fatal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#EA580C',
                border: '2px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px' }}>Serious Injury</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#F59E0B',
                border: '2px solid white',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }}></div>
              <span style={{ fontSize: '13px' }}>Personal Injury</span>
            </div>
          </div>
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #E5E7EB'
          }}>
            <strong style={{ fontSize: '13px' }}>Total: {route.crashes.length}</strong>
          </div>
        </div>
      )}
    </div>
  );
}