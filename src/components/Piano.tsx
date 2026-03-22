import React, { useCallback, useMemo } from 'react';
import { PianoKey, isBlackKey, midiToNoteName } from '../types';
import { getAnimalForNote } from '../animals/animal-map';

interface PianoProps {
  startNote?: number;
  endNote?: number;
  activeNotes?: Set<number>;
  activeHand?: Map<number, 'left' | 'right'>;
  mode?: 'wolf' | 'ruby';
  rubyLevel?: number;
  onKeyPress?: (midiNote: number) => void;
  onKeyRelease?: (midiNote: number) => void;
  width?: number;
  height?: number;
}

const WOLF_COLORS = {
  left: '#4488DD',
  right: '#CC8833',
};

/**
 * Piano — renders a 3D-perspective piano keyboard for BOTH modes.
 *
 * Uses CSS perspective + rotateX to create the angled "looking down
 * at a real piano" effect, like Simply Piano / Synthesia.
 *
 * Wolf Mode: standard keys, blue/amber glow on active notes.
 * Ruby Mode: IDENTICAL layout, just adds animal emoji + note letter
 *            on each white key. Same range, same sizing.
 */
export const Piano: React.FC<PianoProps> = ({
  startNote = 36,
  endNote = 96,
  activeNotes = new Set(),
  activeHand = new Map(),
  mode = 'wolf',
  rubyLevel = 1,
  onKeyPress,
  onKeyRelease,
  width,
  height = 120,
}) => {
  // Ruby level visible notes
  const rubyVisibleNotes = useMemo(() => {
    const LEVELS = [
      ['C', 'D', 'E'],
      ['C', 'D', 'E', 'F', 'G'],
      ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    ];
    return new Set(LEVELS[Math.min(rubyLevel - 1, 3)]);
  }, [rubyLevel]);

  // Standard piano key layout — IDENTICAL for both modes
  const keys = useMemo(() => {
    const whiteKeys: PianoKey[] = [];
    const blackKeys: PianoKey[] = [];

    let whiteCount = 0;
    for (let n = startNote; n <= endNote; n++) {
      if (!isBlackKey(n)) whiteCount++;
    }

    const containerW = width ?? 1200;
    const whiteW = containerW / whiteCount;
    const whiteH = height;
    const blackW = whiteW * 0.58;
    const blackH = whiteH * 0.60;

    let whiteIndex = 0;
    for (let n = startNote; n <= endNote; n++) {
      const name = midiToNoteName(n);
      const octave = Math.floor(n / 12) - 1;

      if (!isBlackKey(n)) {
        whiteKeys.push({
          midiNote: n, noteName: name, isBlack: false, octave,
          x: whiteIndex * whiteW, width: whiteW, height: whiteH,
        });
        whiteIndex++;
      } else {
        blackKeys.push({
          midiNote: n, noteName: name, isBlack: true, octave,
          x: whiteIndex * whiteW - blackW / 2, width: blackW, height: blackH,
        });
      }
    }

    return { whiteKeys, blackKeys, containerW, whiteH };
  }, [startNote, endNote, width, height]);

  const handleMouseDown = useCallback((midiNote: number) => {
    onKeyPress?.(midiNote);
  }, [onKeyPress]);

  const handleMouseUp = useCallback((midiNote: number) => {
    onKeyRelease?.(midiNote);
  }, [onKeyRelease]);

  // ================================================================
  // White Key — 3D with front face visible
  // ================================================================
  const renderWhiteKey = (key: PianoKey) => {
    const isActive = activeNotes.has(key.midiNote);
    const base = key.noteName.replace(/[0-9]/g, '');
    const animal = getAnimalForNote(base);
    const isRubyVisible = rubyVisibleNotes.has(base);
    // Show animal label only on level-appropriate keys, but ALL keys look the same
    const showAnimalLabel = mode === 'ruby' && animal && isRubyVisible;

    let activeColor = '';
    if (isActive) {
      if (mode === 'wolf') {
        const hand = activeHand.get(key.midiNote) ?? 'right';
        activeColor = hand === 'left' ? WOLF_COLORS.left : WOLF_COLORS.right;
      } else if (animal) {
        activeColor = animal.color;
      }
    }

    // The front face depth (the visible edge at bottom of key)
    const frontH = 8;

    return (
      <div
        key={key.midiNote}
        onMouseDown={() => handleMouseDown(key.midiNote)}
        onMouseUp={() => handleMouseUp(key.midiNote)}
        onMouseLeave={() => handleMouseUp(key.midiNote)}
        style={{
          position: 'absolute',
          left: key.x,
          top: 0,
          width: key.width - 1.5,
          height: key.height,
          cursor: 'pointer',
          zIndex: 1,
          userSelect: 'none',
          transition: 'transform 0.05s ease',
          transformOrigin: 'top center',
          transform: isActive ? 'rotateX(1.5deg)' : 'rotateX(0deg)',
        }}
      >
        {/* TOP SURFACE of white key */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: key.height - frontH,
          borderRadius: '0 0 4px 4px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingBottom: 6,

          background: isActive && activeColor
            ? `linear-gradient(180deg, ${activeColor}15 0%, ${activeColor}25 60%, ${activeColor}40 100%)`
            : 'linear-gradient(180deg, #F8F8FA 0%, #EDEDF0 40%, #E2E2E8 80%, #D8D8DE 100%)',

          borderLeft: '1px solid #C0C0C8',
          borderRight: '1px solid #C0C0C8',

          boxShadow: isActive && activeColor
            ? `inset 0 -2px 8px ${activeColor}30, 0 0 14px ${activeColor}50`
            : 'inset 0 1px 0 rgba(255,255,255,0.8), inset 0 -2px 4px rgba(0,0,0,0.04)',
        }}>
          {/* Subtle top bevel highlight */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 2,
            right: 2,
            height: 5,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.6) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />

          {/* Key separator line */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 1,
            height: '100%',
            background: 'linear-gradient(180deg, #C0C0C8 0%, #A8A8B0 100%)',
            pointerEvents: 'none',
          }} />

          {/* Ruby mode: animal emoji + letter on level-appropriate keys */}
          {showAnimalLabel && (
            <>
              <span style={{
                fontSize: 18,
                lineHeight: 1,
                marginBottom: 2,
                filter: isActive ? 'brightness(1.2) drop-shadow(0 0 4px rgba(255,255,255,0.5))' : 'none',
              }}>
                {animal.emoji}
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: isActive ? activeColor : '#888',
                letterSpacing: 0.5,
              }}>
                {animal.note}
              </span>
            </>
          )}

          {/* Wolf mode: C labels */}
          {mode === 'wolf' && base === 'C' && (
            <span style={{
              fontSize: 10,
              color: isActive ? '#FFF' : '#999',
              fontFamily: 'monospace',
              fontWeight: 600,
              textShadow: isActive ? `0 0 6px ${activeColor}` : 'none',
            }}>
              {key.noteName}
            </span>
          )}

          {/* Wolf mode: active note letter */}
          {mode === 'wolf' && isActive && base !== 'C' && (
            <span style={{
              fontSize: 9,
              color: activeColor || '#AAA',
              fontFamily: 'monospace',
              fontWeight: 600,
              opacity: 0.9,
            }}>
              {base}
            </span>
          )}
        </div>

        {/* FRONT FACE of white key (the visible edge) */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: frontH,
          borderRadius: '0 0 4px 4px',
          background: isActive && activeColor
            ? `linear-gradient(180deg, ${activeColor}35 0%, ${activeColor}55 100%)`
            : 'linear-gradient(180deg, #CDCDD4 0%, #B8B8C0 50%, #A8A8B0 100%)',
          borderLeft: '1px solid #A0A0A8',
          borderRight: '1px solid #A0A0A8',
          borderBottom: '1px solid #909098',
          boxShadow: isActive && activeColor
            ? `0 2px 6px ${activeColor}40`
            : '0 2px 4px rgba(0,0,0,0.25)',
        }} />
      </div>
    );
  };

  // ================================================================
  // Black Key — 3D raised with top surface + front face
  // ================================================================
  const renderBlackKey = (key: PianoKey) => {
    const isActive = activeNotes.has(key.midiNote);
    const base = key.noteName.replace(/[0-9]/g, '');
    const animal = getAnimalForNote(base);

    let activeColor = '';
    if (isActive) {
      if (mode === 'wolf') {
        const hand = activeHand.get(key.midiNote) ?? 'right';
        activeColor = hand === 'left' ? WOLF_COLORS.left : WOLF_COLORS.right;
      } else if (animal) {
        activeColor = animal.color;
      }
    }

    const frontH = 6;

    return (
      <div
        key={key.midiNote}
        onMouseDown={() => handleMouseDown(key.midiNote)}
        onMouseUp={() => handleMouseUp(key.midiNote)}
        onMouseLeave={() => handleMouseUp(key.midiNote)}
        style={{
          position: 'absolute',
          left: key.x,
          top: 0,
          width: key.width,
          height: key.height,
          cursor: 'pointer',
          zIndex: 2,
          userSelect: 'none',
          transition: 'transform 0.05s ease',
          transformOrigin: 'top center',
          transform: isActive ? 'rotateX(1deg)' : 'rotateX(0deg)',
        }}
      >
        {/* TOP SURFACE of black key */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: key.height - frontH,
          borderRadius: '0 0 3px 3px',

          background: isActive && activeColor
            ? `linear-gradient(180deg, ${activeColor}80 0%, ${activeColor}60 50%, ${activeColor}40 100%)`
            : 'linear-gradient(180deg, #303038 0%, #222228 35%, #18181E 70%, #101014 100%)',

          borderLeft: '1px solid #404048',
          borderRight: '1px solid #08080C',

          boxShadow: isActive && activeColor
            ? `inset 0 -4px 6px ${activeColor}30, 0 0 12px ${activeColor}50`
            : 'inset 0 1px 0 rgba(80,80,90,0.5), inset 0 -4px 6px rgba(0,0,0,0.5)',
        }}>
          {/* Top shine highlight */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 3,
            right: 3,
            height: '50%',
            background: isActive && activeColor
              ? `linear-gradient(180deg, ${activeColor}25 0%, transparent 100%)`
              : 'linear-gradient(180deg, rgba(60,60,68,0.5) 0%, transparent 100%)',
            borderRadius: '0 0 2px 2px',
            pointerEvents: 'none',
          }} />

          {/* Left bevel edge */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 2,
            height: '85%',
            background: 'linear-gradient(180deg, rgba(80,80,88,0.35) 0%, transparent 100%)',
            pointerEvents: 'none',
          }} />
        </div>

        {/* FRONT FACE of black key */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: frontH,
          borderRadius: '0 0 3px 3px',
          background: isActive && activeColor
            ? `linear-gradient(180deg, ${activeColor}50 0%, ${activeColor}30 100%)`
            : 'linear-gradient(180deg, #0C0C10 0%, #060608 100%)',
          borderLeft: '1px solid #303038',
          borderRight: '1px solid #060608',
          borderBottom: '1px solid #040406',
          boxShadow: isActive && activeColor
            ? `0 3px 8px ${activeColor}40`
            : '0 3px 6px rgba(0,0,0,0.5)',
        }} />
      </div>
    );
  };

  // The perspective wrapper creates the 3D "looking down at the piano" angle
  // perspectiveOrigin is centered horizontally, above the piano
  return (
    <div style={{
      perspective: '800px',
      perspectiveOrigin: '50% -20%',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'relative',
        width: keys.containerW,
        height: keys.whiteH,
        overflow: 'visible',
        // Slight tilt — looking down at the piano from above
        transform: 'rotateX(8deg)',
        transformOrigin: 'center top',
        // Dark background behind the keys
        background: 'linear-gradient(180deg, #06060A 0%, #0A0A12 100%)',
        borderTop: '2px solid #18181E',
      }}>
        {/* Top felt/bumper strip */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #1A1A24 0%, #222230 50%, #1A1A24 100%)',
          zIndex: 3,
          pointerEvents: 'none',
        }} />

        {keys.whiteKeys.map(renderWhiteKey)}
        {keys.blackKeys.map(renderBlackKey)}

        {/* Hit line glow at the top edge */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          zIndex: 4,
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
};

export default Piano;
