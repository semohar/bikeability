import { useState, useCallback, useRef } from 'react';
import Map from './components/Map';
import Controls from './components/Controls';
import RouteInfo from './components/RouteInfo';
import { useRoute } from './hooks/useRoute';
import type { RouteType } from './types/api.types';
import type { MapInstance } from './types/map.types';

function App() {
  const { route, stats, loading, error, findRoute } = useRoute();
  const [terrainEnabled, setTerrainEnabled] = useState(false);
  const [currentRouteType, setCurrentRouteType] = useState<RouteType | null>(null);
  const mapInstance = useRef<MapInstance>(null);

  const handleMapLoad = useCallback((map: mapboxgl.Map) => {
    mapInstance.current = map;
  }, []);

  const handleFindRoute = useCallback(
    (type: RouteType) => {
      setCurrentRouteType(type);
      findRoute(type);
    },
    [findRoute]
  );

  const handleToggleTerrain = useCallback(() => {
    if (!mapInstance.current) return;

    if (terrainEnabled) {
      mapInstance.current.setTerrain(null);
      mapInstance.current.easeTo({ pitch: 0, duration: 1000 });
      setTerrainEnabled(false);
    } else {
      mapInstance.current.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 2,
      });
      mapInstance.current.easeTo({ pitch: 60, duration: 1000 });
      setTerrainEnabled(true);
    }
  }, [terrainEnabled]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <Map route={route} onMapLoad={handleMapLoad} />
      <Controls
        onFindRoute={handleFindRoute}
        onToggleTerrain={handleToggleTerrain}
        loading={loading}
      />
      <RouteInfo stats={stats} routeType={currentRouteType} error={error} />
    </div>
  );
}

export default App;