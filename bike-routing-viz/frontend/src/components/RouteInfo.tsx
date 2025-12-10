import type { RouteStats } from '../types/map.types';
import type { RouteType } from '../types/api.types';

interface RouteInfoProps {
  stats: RouteStats | null;
  routeType: RouteType | null;
  error: string | null;
}

export default function RouteInfo({ stats, routeType, error }: RouteInfoProps) {
  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          background: '#fee',
          color: '#c33',
          padding: '15px',
          borderRadius: '8px',
          maxWidth: '300px',
          zIndex: 1,
        }}
      >
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const distanceKm = (stats.totalDistance / 1000).toFixed(2);
  const distanceMi = (stats.totalDistance * 0.000621371).toFixed(2);
  const climbFt = (stats.totalClimb * 3.28084).toFixed(0);
  const descentFt = (stats.totalDescent * 3.28084).toFixed(0);

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        background: 'white',
        padding: '15px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: 1,
        maxWidth: '300px',
        fontSize: '14px',
        lineHeight: '1.6',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '10px', fontSize: '16px' }}>
        {routeType === 'fastest' ? 'Fastest' : 'Safest'} Route
      </strong>
      
      <div>
        <strong>Distance:</strong> {distanceKm} km ({distanceMi} mi)
      </div>
      <div>
        <strong>Total Climb:</strong> {stats.totalClimb.toFixed(0)}m ({climbFt} ft)
      </div>
      <div>
        <strong>Total Descent:</strong> {stats.totalDescent.toFixed(0)}m ({descentFt} ft)
      </div>
      <div>
        <strong>Max Grade:</strong> {stats.maxGrade.toFixed(1)}%
      </div>
      <div>
        <strong>Segments:</strong> {stats.segmentCount}
      </div>
    </div>
  );
}