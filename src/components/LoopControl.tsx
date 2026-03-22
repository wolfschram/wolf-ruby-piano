import React, { useState } from 'react';

interface LoopControlProps {
  totalBars: number;
  loopStart?: number;
  loopEnd?: number;
  onLoopChange: (start?: number, end?: number) => void;
  mode?: 'wolf' | 'ruby';
}

export const LoopControl: React.FC<LoopControlProps> = ({
  totalBars,
  loopStart,
  loopEnd,
  onLoopChange,
  mode = 'wolf',
}) => {
  const [editing, setEditing] = useState(false);
  const isWolf = mode === 'wolf';
  const isActive = loopStart !== undefined && loopEnd !== undefined;

  if (!editing && !isActive) {
    return (
      <button
        onClick={() => setEditing(true)}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          border: 'none',
          fontSize: 12,
          cursor: 'pointer',
          backgroundColor: isWolf ? '#1A1A2E' : '#FFF5E8',
          color: isWolf ? '#888' : '#666',
        }}
      >
        Loop
      </button>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      borderRadius: 8,
      backgroundColor: isWolf ? '#1A1A2E' : '#FFF5E8',
    }}>
      <span style={{ fontSize: 12, color: isWolf ? '#888' : '#666' }}>Loop:</span>
      <input
        type="number"
        min={1}
        max={totalBars}
        value={loopStart ?? 1}
        onChange={(e) => onLoopChange(parseInt(e.target.value), loopEnd ?? totalBars)}
        style={{
          width: 48,
          padding: '2px 4px',
          borderRadius: 4,
          border: `1px solid ${isWolf ? '#333' : '#DDD'}`,
          backgroundColor: isWolf ? '#0A0A12' : '#FFF',
          color: isWolf ? '#EEE' : '#333',
          fontSize: 12,
          textAlign: 'center',
        }}
      />
      <span style={{ fontSize: 12, color: isWolf ? '#555' : '#999' }}>to</span>
      <input
        type="number"
        min={1}
        max={totalBars}
        value={loopEnd ?? totalBars}
        onChange={(e) => onLoopChange(loopStart ?? 1, parseInt(e.target.value))}
        style={{
          width: 48,
          padding: '2px 4px',
          borderRadius: 4,
          border: `1px solid ${isWolf ? '#333' : '#DDD'}`,
          backgroundColor: isWolf ? '#0A0A12' : '#FFF',
          color: isWolf ? '#EEE' : '#333',
          fontSize: 12,
          textAlign: 'center',
        }}
      />
      <button
        onClick={() => { onLoopChange(undefined, undefined); setEditing(false); }}
        style={{
          padding: '2px 8px',
          borderRadius: 4,
          border: 'none',
          fontSize: 11,
          cursor: 'pointer',
          backgroundColor: isActive ? '#CC4444' : '#555',
          color: '#FFF',
        }}
      >
        {isActive ? 'Clear' : 'Cancel'}
      </button>
    </div>
  );
};

export default LoopControl;
