import React from 'react';

interface SpeedControlProps {
  speed: number;
  onChange: (speed: number) => void;
  mode?: 'wolf' | 'ruby';
}

export const SpeedControl: React.FC<SpeedControlProps> = ({ speed, onChange, mode = 'wolf' }) => {
  const isWolf = mode === 'wolf';
  const pct = Math.round(speed * 100);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 12px',
      borderRadius: 8,
      backgroundColor: isWolf ? '#1A1A2E' : '#FFF5E8',
    }}>
      <span style={{
        fontSize: 12,
        color: isWolf ? '#888' : '#999',
        fontWeight: 600,
        minWidth: 44,
      }}>
        {pct}%
      </span>
      <input
        type="range"
        min={25}
        max={150}
        value={pct}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
        style={{
          width: 120,
          accentColor: isWolf ? '#CC8833' : '#F0997B',
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        {[25, 50, 75, 100].map(p => (
          <button
            key={p}
            onClick={() => onChange(p / 100)}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              border: 'none',
              fontSize: 11,
              fontWeight: pct === p ? 700 : 400,
              cursor: 'pointer',
              backgroundColor: pct === p
                ? (isWolf ? '#CC8833' : '#F0997B')
                : (isWolf ? '#2A2A3E' : '#FFF0DD'),
              color: pct === p ? '#FFF' : (isWolf ? '#888' : '#666'),
            }}
          >
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
};

export default SpeedControl;
