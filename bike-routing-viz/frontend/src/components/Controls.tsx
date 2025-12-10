import type { RouteType } from '../types/api.types';

interface ControlsProps {
  onFindRoute: (type: RouteType) => void;
  onToggleTerrain: () => void;
  loading: boolean;
}

export default function Controls({
  onFindRoute,
  onToggleTerrain,
  loading,
}: ControlsProps) {
  const buttonStyle: React.CSSProperties = {
    background: loading ? '#ccc' : '#3887be',
    color: 'white',
    border: 'none',
    padding: '12px 20px',
    borderRadius: '5px',
    cursor: loading ? 'not-allowed' : 'pointer',
    margin: '5px 0',
    width: '100%',
    fontSize: '14px',
    fontWeight: 500,
    transition: 'background 0.2s',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        zIndex: 1,
        maxWidth: '320px',
      }}
    >
      <h3 style={{ margin: '0 0 15px 0' }}>🚴 St. Louis Bike Router</h3>

      <button
        onClick={() => onFindRoute('fastest')}
        disabled={loading}
        style={buttonStyle}
      >
        {loading ? 'Finding Route...' : 'Find Fastest Route'}
      </button>

      <button
        onClick={() => onFindRoute('safest')}
        disabled={loading}
        style={buttonStyle}
      >
        {loading ? 'Finding Route...' : 'Find Safest Route (Avoid Hills)'}
      </button>

      <button
        onClick={onToggleTerrain}
        disabled={loading}
        style={buttonStyle}
      >
        Toggle 3D Terrain
      </button>
    </div>
  );
}