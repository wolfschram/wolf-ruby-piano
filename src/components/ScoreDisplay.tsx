import React from 'react';
import { ScoreState } from '../types';

interface ScoreDisplayProps {
  score: ScoreState;
  mode: 'wolf' | 'ruby';
}

export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({ score, mode }) => {
  if (mode === 'ruby') {
    return <RubyScore score={score} />;
  }
  return <WolfScore score={score} />;
};

const WolfScore: React.FC<{ score: ScoreState }> = ({ score }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '6px 16px',
    borderRadius: 8,
    backgroundColor: '#1A1A2E',
    fontSize: 13,
    color: '#AAA',
  }}>
    <div>
      <span style={{ color: '#666', marginRight: 4 }}>Accuracy</span>
      <span style={{
        color: score.accuracy >= 80 ? '#5DCAA5' : score.accuracy >= 50 ? '#FAC775' : '#F0997B',
        fontWeight: 700,
        fontSize: 16,
      }}>
        {score.accuracy}%
      </span>
    </div>
    <div style={{ width: 1, height: 20, backgroundColor: '#333' }} />
    <div>
      <span style={{ color: '#666', marginRight: 4 }}>Streak</span>
      <span style={{ color: '#CC8833', fontWeight: 700 }}>{score.streak}</span>
    </div>
    <div style={{ width: 1, height: 20, backgroundColor: '#333' }} />
    <div>
      <span style={{ color: '#666', marginRight: 4 }}>Notes</span>
      <span style={{ color: '#888' }}>{score.hitNotes}/{score.totalNotes}</span>
    </div>
  </div>
);

const RubyScore: React.FC<{ score: ScoreState }> = ({ score }) => {
  const stars = [];
  for (let i = 0; i < 5; i++) {
    stars.push(
      <span
        key={i}
        style={{
          fontSize: 28,
          filter: i < score.stars ? 'none' : 'grayscale(1) opacity(0.3)',
          transition: 'all 0.3s ease',
          transform: i < score.stars ? 'scale(1.1)' : 'scale(0.9)',
        }}
      >
        ⭐
      </span>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
    }}>
      <div style={{ display: 'flex', gap: 2 }}>{stars}</div>
      {score.streak >= 3 && (
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#F0997B',
          animation: 'bounce 0.5s ease',
        }}>
          {score.streak} in a row! 🎉
        </div>
      )}
    </div>
  );
};

export default ScoreDisplay;
