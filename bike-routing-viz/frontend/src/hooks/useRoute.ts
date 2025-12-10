import { useState, useCallback } from 'react';
import { api } from '../services/api';
import type { RouteResponse, RouteType } from '../types/api.types';
import type { RouteStats } from '../types/map.types';

interface UseRouteReturn {
  route: RouteResponse | null;
  stats: RouteStats | null;
  loading: boolean;
  error: string | null;
  findRoute: (type: RouteType) => Promise<void>;
  clearRoute: () => void;
}

export function useRoute(): UseRouteReturn {
  const [route, setRoute] = useState<RouteResponse | null>(null);
  const [stats, setStats] = useState<RouteStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateStats = useCallback((routeData: RouteResponse): RouteStats => {
    let totalDistance = 0;
    let totalClimb = 0;
    let totalDescent = 0;
    let maxGrade = 0;

    routeData.features.forEach((feature) => {
      const { length_m, elevation_change_m, grade_percent } = feature.properties;
      
      totalDistance += length_m;
      
      if (elevation_change_m > 0) {
        totalClimb += elevation_change_m;
      } else {
        totalDescent += Math.abs(elevation_change_m);
      }
      
      if (Math.abs(grade_percent) > Math.abs(maxGrade)) {
        maxGrade = grade_percent;
      }
    });

    return {
      totalDistance,
      totalClimb,
      totalDescent,
      maxGrade,
      segmentCount: routeData.features.length,
    };
  }, []);

  const findRoute = useCallback(async (type: RouteType) => {
    setLoading(true);
    setError(null);

    try {
      const nodes = await api.getRandomNodes();
      
      if (nodes.length < 2) {
        throw new Error('Could not find suitable nodes');
      }

      const routeData = await api.getRoute(nodes[0].id, nodes[1].id, type);
      
      if (!routeData.features || routeData.features.length === 0) {
        throw new Error('No route found between these nodes');
      }

      const routeStats = calculateStats(routeData);

      setRoute(routeData);
      setStats(routeStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error finding route:', err);
    } finally {
      setLoading(false);
    }
  }, [calculateStats]);

  const clearRoute = useCallback(() => {
    setRoute(null);
    setStats(null);
    setError(null);
  }, []);

  return {
    route,
    stats,
    loading,
    error,
    findRoute,
    clearRoute,
  };
}