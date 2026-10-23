import React, { useState, useMemo } from 'react';
import { Song } from '../types';
import { Exercise, ExerciseCategory, getAllExercises, exerciseToSong, getExerciseHand } from '../exercises/ExerciseLibrary';

interface ExerciseBrowserProps {
  mode: 'wolf' | 'ruby';
  onSelectExercise: (song: Song) => void;
}

const CATEGORIES: { key: ExerciseCategory; label: string }[] = [
  { key: 'finger-independence', label: 'Finger Independence' },
  { key: 'two-hand-coordination', label: 'Two-Hand Coordination' },
  { key: 'rhythm', label: 'Rhythm' },
  { key: 'scales', label: 'Scales' },
  { key: 'finger-strength', label: 'Finger Strength' },
  { key: 'five-finger-patterns', label: 'Five-Finger Patterns' },
];

const DIFFICULTY_COLORS: Record<number, string> = {
  1: '#5DCAA5',
  2: '#5DCAA5',
  3: '#CC8833',
  4: '#CC4444',
  5: '#CC0044',
};

const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  'finger-independence': '#6366F1',
  'two-hand-coordination': '#8B5CF6',
  'rhythm': '#EC4899',
  'scales': '#06B6D4',
  'finger-strength': '#F59E0B',
  'five-finger-patterns': '#10B981',
};

export const ExerciseBrowser: React.FC<ExerciseBrowserProps> = ({ mode, onSelectExercise }) => {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<number | 'all'>('all');
  const [hoveredExerciseId, setHoveredExerciseId] = useState<string | null>(null);

  // Get all exercises for this mode
  const allExercises = useMemo(() => {
    const exercises = getAllExercises();
    if (mode === 'wolf') {
      return exercises.filter(e => e.mode === 'wolf' || e.mode === 'both');
    } else {
      return exercises.filter(e => e.mode === 'ruby' || e.mode === 'both');
    }
  }, [mode]);

  // Filter exercises
  const filteredExercises = useMemo(() => {
    let result = allExercises;

    if (selectedCategory !== 'all') {
      result = result.filter(e => e.category === selectedCategory);
    }

    if (selectedDifficulty !== 'all') {
      result = result.filter(e => e.difficulty === selectedDifficulty);
    }

    return result;
  }, [allExercises, selectedCategory, selectedDifficulty]);

  // Get the currently hovered exercise
  const hoveredExercise = useMemo(() => {
    return filteredExercises.find(e => e.id === hoveredExerciseId) || null;
  }, [hoveredExerciseId, filteredExercises]);

  const isDarkMode = mode === 'wolf';
  const modeColor = isDarkMode ? '#CC8833' : '#5DCAA5';
  const bgColor = isDarkMode ? '#0A0A12' : '#0D0D18';
  const cardBgColor = isDarkMode ? '#0D0D18' : '#1A1A2E';
  const borderColor = isDarkMode ? '#1A1A2E' : '#2A2A3E';
  const textPrimary = isDarkMode ? '#EEE' : '#FFF';
  const textSecondary = isDarkMode ? '#888' : '#AAA';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: bgColor,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${borderColor}`,
      }}>
        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: textPrimary,
          margin: '0 0 12px 0',
        }}>
          {mode === 'wolf' ? '🐺 Exercises' : '🧩 Practice Exercises'}
        </h2>
      </div>

      {/* Filters Row */}
      <div style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        gap: 12,
        overflow: 'auto',
        alignItems: 'center',
      }}>
        {/* All Categories button */}
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '6px 12px',
            borderRadius: 6,
            border: 'none',
            fontSize: 12,
            fontWeight: selectedCategory === 'all' ? 700 : 400,
            cursor: 'pointer',
            backgroundColor: selectedCategory === 'all' ? modeColor : borderColor,
            color: selectedCategory === 'all' ? '#FFF' : textSecondary,
            whiteSpace: 'nowrap',
            transition: 'all 0.2s',
          }}
        >
          All
        </button>

        {/* Category filter tabs */}
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => setSelectedCategory(cat.key)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: 'none',
              fontSize: 12,
              fontWeight: selectedCategory === cat.key ? 700 : 400,
              cursor: 'pointer',
              backgroundColor: selectedCategory === cat.key
                ? CATEGORY_COLORS[cat.key]
                : borderColor,
              color: selectedCategory === cat.key ? '#FFF' : textSecondary,
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Difficulty Filter */}
      <div style={{
        padding: '12px 20px',
        borderBottom: `1px solid ${borderColor}`,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: textSecondary, fontWeight: 600 }}>
          Difficulty:
        </span>
        <button
          onClick={() => setSelectedDifficulty('all')}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: 'none',
            fontSize: 11,
            fontWeight: selectedDifficulty === 'all' ? 700 : 400,
            cursor: 'pointer',
            backgroundColor: selectedDifficulty === 'all' ? modeColor : borderColor,
            color: selectedDifficulty === 'all' ? '#FFF' : textSecondary,
          }}
        >
          All
        </button>
        {[1, 2, 3, 4, 5].map(d => (
          <button
            key={d}
            onClick={() => setSelectedDifficulty(d)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              fontSize: 12,
              fontWeight: selectedDifficulty === d ? 700 : 400,
              cursor: 'pointer',
              backgroundColor: selectedDifficulty === d
                ? DIFFICULTY_COLORS[d]
                : borderColor,
              color: selectedDifficulty === d ? '#FFF' : textSecondary,
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Main Content: Cards + Pedagogy Panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: 16,
        padding: 20,
        overflow: 'hidden',
      }}>
        {/* Exercise Cards Column */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {filteredExercises.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: textSecondary,
              fontSize: 14,
            }}>
              No exercises found
            </div>
          ) : (
            filteredExercises.map(exercise => (
              <button
                key={exercise.id}
                onClick={() => onSelectExercise(exerciseToSong(exercise))}
                onMouseEnter={() => setHoveredExerciseId(exercise.id)}
                onMouseLeave={() => setHoveredExerciseId(null)}
                style={{
                  padding: '12px 16px',
                  borderRadius: 8,
                  border: `1px solid ${hoveredExerciseId === exercise.id ? modeColor : borderColor}`,
                  backgroundColor: hoveredExerciseId === exercise.id ? cardBgColor : bgColor,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: textPrimary,
                    marginBottom: 4,
                  }}>
                    {exercise.title}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: textSecondary,
                    display: 'flex',
                    gap: 12,
                  }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 3,
                      backgroundColor: CATEGORY_COLORS[exercise.category] + '30',
                      color: CATEGORY_COLORS[exercise.category],
                      fontWeight: 500,
                    }}>
                      {exercise.category.replace('-', ' ')}
                    </span>
                    {/* Hand indicator */}
                    {(() => {
                      const hand = getExerciseHand(exercise);
                      const handLabel = hand === 'both' ? 'Both' : hand === 'left' ? 'LH' : 'RH';
                      const handColor = hand === 'both' ? '#8B5CF6' : hand === 'left' ? '#3366BB' : '#CC8833';
                      return (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 3,
                          backgroundColor: handColor + '30',
                          color: handColor,
                          fontWeight: 600,
                          fontSize: 10,
                        }}>
                          {hand === 'left' ? '🫲 ' : hand === 'right' ? '🫱 ' : '🤲 '}{handLabel}
                        </span>
                      );
                    })()}
                    <span>
                      {Math.round(exercise.durationMs / 1000)}s
                    </span>
                  </div>
                </div>

                {/* Difficulty Stars */}
                <div style={{
                  display: 'flex',
                  gap: 2,
                  flexShrink: 0,
                }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <div
                      key={star}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: star <= exercise.difficulty
                          ? DIFFICULTY_COLORS[exercise.difficulty]
                          : borderColor,
                      }}
                    />
                  ))}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Pedagogy Panel */}
        {hoveredExercise ? (
          <div style={{
            width: 280,
            backgroundColor: cardBgColor,
            borderRadius: 8,
            border: `1px solid ${borderColor}`,
            padding: 16,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div>
              <h3 style={{
                fontSize: 12,
                fontWeight: 700,
                color: modeColor,
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Why This Exercise?
              </h3>
              <p style={{
                fontSize: 12,
                color: textSecondary,
                margin: 0,
                lineHeight: 1.5,
              }}>
                {hoveredExercise.description}
              </p>
            </div>

            <div style={{
              height: 1,
              backgroundColor: borderColor,
            }} />

            <div>
              <h3 style={{
                fontSize: 12,
                fontWeight: 700,
                color: modeColor,
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Technique Tips
              </h3>
              <p style={{
                fontSize: 12,
                color: textSecondary,
                margin: 0,
                lineHeight: 1.5,
              }}>
                {hoveredExercise.technique}
              </p>
            </div>

            <div style={{
              height: 1,
              backgroundColor: borderColor,
            }} />



            <div>
              <h3 style={{
                fontSize: 12,
                fontWeight: 700,
                color: '#CC4444',
                margin: '0 0 8px 0',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                Watch Out For
              </h3>
              <p style={{
                fontSize: 12,
                color: textSecondary,
                margin: 0,
                lineHeight: 1.5,
              }}>
                {hoveredExercise.commonMistakes}
              </p>
            </div>

            {/* Finger Info */}
            {hoveredExercise.fingerInfo && (
              <>
                <div style={{ height: 1, backgroundColor: borderColor }} />
                <div>
                  <h3 style={{
                    fontSize: 12, fontWeight: 700, color: '#06B6D4',
                    margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    Hand & Finger Position
                  </h3>
                  <p style={{ fontSize: 12, color: textSecondary, margin: 0, lineHeight: 1.5 }}>
                    {hoveredExercise.fingerInfo}
                  </p>
                </div>
              </>
            )}

            {/* Hand indicator badge */}
            {(() => {
              const hand = getExerciseHand(hoveredExercise);
              const handLabel = hand === 'both' ? 'Both Hands' : hand === 'left' ? 'Left Hand' : 'Right Hand';
              const handColor = hand === 'both' ? '#8B5CF6' : hand === 'left' ? '#3366BB' : '#CC8833';
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 6,
                  backgroundColor: handColor + '15',
                  border: `1px solid ${handColor}40`,
                }}>
                  <span style={{ fontSize: 20 }}>
                    {hand === 'left' ? '🫲' : hand === 'right' ? '🫱' : '🤲'}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: handColor }}>
                    {handLabel}
                  </span>
                </div>
              );
            })()}

            <div style={{
              marginTop: 'auto',
              paddingTop: 8,
              borderTop: `1px solid ${borderColor}`,
              fontSize: 11,
              color: textSecondary,
            }}>
              <div>BPM: {hoveredExercise.bpm}</div>
              <div>Duration: {Math.round(hoveredExercise.durationMs / 1000)}s</div>
            </div>
          </div>
        ) : (
          <div style={{
            width: 280,
            backgroundColor: cardBgColor,
            borderRadius: 8,
            border: `1px solid ${borderColor}`,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: textSecondary,
            fontSize: 12,
            textAlign: 'center',
          }}>
            Hover over an exercise to see details
          </div>
        )}
      </div>
    </div>
  );
};

export default ExerciseBrowser;
