import React, { useRef, useEffect, useCallback } from 'react';
import { NoteEvent, isBlackKey, midiToNoteName } from '../types';
import { getAnimalForNote, getAnimalEmoji } from '../animals/animal-map';

interface FallingNotesProps {
  notes: NoteEvent[];
  currentTimeMs: number;
  speedMultiplier: number;
  mode: 'wolf' | 'ruby';
  rubyLevel?: number;
  handFilter?: 'both' | 'left' | 'right';
  width: number;
  height: number;
  startNote?: number;
  endNote?: number;
  waitingNoteIndex?: number;
  hitNotes?: Set<number>;
  userNoteVelocities?: Map<number, number>; // noteIndex -> velocity mapping
  onReady?: () => void;
}

// Colors
const WOLF_LEFT = '#3366BB';
const WOLF_RIGHT = '#CC8833';
const WOLF_HIT_LINE = '#FFFFFF20';
const BG_WOLF = '#0A0A12';
const BG_RUBY = '#0A0A12';

/**
 * Get velocity tint color based on MIDI velocity (0-127).
 * - Too soft (<40) = blue tint
 * - Good (40-100) = green tint
 * - Too hard (>100) = red tint
 */
function getVelocityTint(velocity: number): string {
  if (velocity < 40) return '#4488FF'; // Blue
  if (velocity <= 100) return '#44FF88'; // Green
  return '#FF6644'; // Red
}

/**
 * FallingNotes — Canvas-based 60fps falling note renderer.
 * Notes fall from top to bottom. Hit line is near the bottom.
 *
 * Wolf Mode: colored rounded rectangles, height = duration.
 * Ruby Mode: animal emoji blocks, bigger, rounder.
 */
export const FallingNotes: React.FC<FallingNotesProps> = ({
  notes,
  currentTimeMs,
  speedMultiplier,
  mode,
  rubyLevel = 1,
  handFilter = 'both',
  width,
  height,
  startNote = 36,
  endNote = 96,
  waitingNoteIndex,
  hitNotes = new Set(),
  userNoteVelocities = new Map(),
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dprRef = useRef(window.devicePixelRatio || 1);

  // How many ms of future notes are visible
  const LOOKAHEAD_MS = 3000;
  // Hit line position from bottom (pixels)
  const HIT_LINE_Y_OFFSET = 20;

  const getKeyX = useCallback((midiNote: number): { x: number; w: number } => {
    // Calculate x position based on piano key layout
    let whiteCount = 0;
    for (let n = startNote; n <= endNote; n++) {
      if (!isBlackKey(n)) whiteCount++;
    }

    const whiteW = width / whiteCount;
    const blackW = whiteW * 0.6;

    let whiteIndex = 0;
    for (let n = startNote; n <= endNote; n++) {
      if (n === midiNote) {
        if (isBlackKey(n)) {
          return { x: whiteIndex * whiteW - blackW / 2, w: blackW };
        }
        return { x: whiteIndex * whiteW, w: whiteW };
      }
      if (!isBlackKey(n)) whiteIndex++;
    }
    return { x: 0, w: whiteW };
  }, [startNote, endNote, width]);

  // Ruby mode: map note to wider key position (only visible keys)
  const getRubyKeyX = useCallback((midiNote: number): { x: number; w: number } | null => {
    const RUBY_LEVELS_NOTES = [
      ['C', 'D', 'E'],
      ['C', 'D', 'E', 'F', 'G'],
      ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
      ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    ];
    const visibleNotes = RUBY_LEVELS_NOTES[Math.min(rubyLevel - 1, 3)];
    const base = midiToNoteName(midiNote).replace(/[0-9]/g, '');
    const idx = visibleNotes.indexOf(base);
    if (idx < 0) return null;

    const keyW = width / visibleNotes.length;
    return { x: idx * keyW, w: keyW };
  }, [width, rubyLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Guard against invalid dimensions
    if (width <= 0 || height <= 0) return;

    try {

    const dpr = dprRef.current;
    const safeHeight = Math.max(height, 100);
    canvas.width = width * dpr;
    canvas.height = safeHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = mode === 'wolf' ? BG_WOLF : BG_RUBY;
    ctx.fillRect(0, 0, width, safeHeight);

    const hitLineY = safeHeight - HIT_LINE_Y_OFFSET;
    const pxPerMs = (hitLineY) / LOOKAHEAD_MS;

    // Draw hit line
    ctx.strokeStyle = mode === 'wolf' ? WOLF_HIT_LINE : '#FFFFFF20';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, hitLineY);
    ctx.lineTo(width, hitLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw visible notes — iterate original array to preserve indices
    // (avoids O(n) indexOf calls that were freezing the app on large files)
    const MAX_VISIBLE_NOTES = 500;
    let visibleCount = 0;

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];

      // Filter by hand
      if (handFilter !== 'both' && note.hand !== handFilter) continue;

      const relativeStart = note.startTime - currentTimeMs;
      const relativeEnd = relativeStart + note.duration;

      // Skip notes that are fully past or too far ahead
      if (relativeEnd < -500) continue;
      if (relativeStart > LOOKAHEAD_MS + 1000) break; // notes are sorted by startTime

      // Calculate Y position (note falls downward, hitLineY = time 0)
      const noteTopY = hitLineY - (relativeStart + note.duration) * pxPerMs;
      const noteBottomY = hitLineY - relativeStart * pxPerMs;
      const noteH = Math.max(noteBottomY - noteTopY, mode === 'ruby' ? 20 : 8);

      // Get X position — Ruby uses simplified key layout, Wolf uses full piano
      let keyPos: { x: number; w: number };
      if (mode === 'ruby') {
        const rubyPos = getRubyKeyX(note.pitch);
        if (!rubyPos) continue; // Note not in current Ruby level — skip it
        keyPos = rubyPos;
      } else {
        keyPos = getKeyX(note.pitch);
      }

      const noteX = keyPos.x + 2;
      const noteW = keyPos.w - 4;

      // Determine color
      let color: string;
      if (mode === 'ruby') {
        const animal = getAnimalForNote(midiToNoteName(note.pitch));
        color = animal?.color ?? '#888';
      } else {
        color = note.hand === 'left' ? WOLF_LEFT : WOLF_RIGHT;
      }

      // Use loop index directly — O(1) instead of O(n) indexOf
      const noteIdx = i;
      const isAtHitLine = relativeStart <= 0 && relativeEnd >= 0;
      const isWaiting = waitingNoteIndex !== undefined && noteIdx === waitingNoteIndex;
      const wasHit = hitNotes.has(noteIdx);
      const userVelocity = userNoteVelocities.get(noteIdx);

      // Draw the note block
      ctx.save();

      if (wasHit) {
        ctx.globalAlpha = 0.3;
      } else if (isAtHitLine || isWaiting) {
        ctx.globalAlpha = 1;
        // Glow effect
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
      } else {
        ctx.globalAlpha = 0.85;
      }

      // Rounded rectangle
      const radius = mode === 'ruby' ? 12 : 6;
      ctx.beginPath();
      ctx.roundRect(noteX, noteTopY, noteW, noteH, radius);
      ctx.fillStyle = color;
      ctx.fill();

      // Velocity visualization: subtle colored border around hit notes
      if (wasHit && userVelocity !== undefined) {
        const velocityColor = getVelocityTint(userVelocity);
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = velocityColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(noteX + 1, noteTopY + 1, noteW - 2, noteH - 2, radius);
        ctx.stroke();
        ctx.restore();
      }

      // Ruby mode: draw emoji + hand indicator
      if (mode === 'ruby') {
        ctx.shadowBlur = 0;

        // Hand indicator: colored side stripe + L/R badge
        const handColor = note.hand === 'left' ? '#3366BB' : '#CC8833';
        const handLabel = note.hand === 'left' ? 'L' : 'R';

        // Side stripe (4px colored bar on left edge of note)
        ctx.save();
        ctx.globalAlpha = wasHit ? 0.2 : 0.9;
        ctx.fillStyle = handColor;
        ctx.beginPath();
        ctx.roundRect(noteX, noteTopY, 5, noteH, [radius, 0, 0, radius]);
        ctx.fill();
        ctx.restore();

        // L/R badge at top of note
        if (noteH > 18) {
          ctx.save();
          ctx.globalAlpha = wasHit ? 0.3 : 1;
          const badgeSize = Math.min(18, noteW * 0.4);
          const badgeX = noteX + noteW - badgeSize - 2;
          const badgeY = noteTopY + 3;
          ctx.fillStyle = handColor;
          ctx.beginPath();
          ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFF';
          ctx.font = `bold ${Math.round(badgeSize * 0.65)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(handLabel, badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 1);
          ctx.restore();
        }

        // Animal emoji (centered, below badge)
        if (noteH > 30) {
          ctx.globalAlpha = wasHit ? 0.3 : 1;
          const emoji = getAnimalEmoji(midiToNoteName(note.pitch));
          const emojiY = noteH > 50 ? noteTopY + noteH / 2 + 6 : noteTopY + noteH / 2;
          ctx.font = `${Math.min(noteH - 16, 28)}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emoji, noteX + noteW / 2, emojiY);
        }
      }

      // Pulsing border for waiting note
      if (isWaiting) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(noteX, noteTopY, noteW, noteH, radius);
        ctx.stroke();
      }

      ctx.restore();

      // Increment visible count and break if we've hit the limit
      visibleCount++;
      if (visibleCount >= MAX_VISIBLE_NOTES) break;
    }

    // Draw sparkle particles for recently hit notes (Ruby mode)
    if (mode === 'ruby') {
      drawSparkles(ctx, width, height, hitLineY);
    }

    } catch (err) {
      console.error('[FallingNotes] Canvas render error:', err);
    }

  }, [notes, currentTimeMs, mode, handFilter, width, height, startNote, endNote,
      speedMultiplier, waitingNoteIndex, hitNotes, userNoteVelocities, getKeyX, getRubyKeyX, rubyLevel]);

  const safeHeight = Math.max(height, 100);
  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height: safeHeight,
        display: 'block',
      }}
    />
  );
};

// Simple sparkle effect for Ruby mode
let sparkles: { x: number; y: number; life: number; color: string; vx: number; vy: number }[] = [];

export function addSparkle(x: number, y: number, color: string) {
  for (let i = 0; i < 8; i++) {
    sparkles.push({
      x,
      y,
      life: 1,
      color,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4 - 2,
    });
  }
  // Keep sparkle array bounded
  if (sparkles.length > 100) sparkles = sparkles.slice(-60);
}

function drawSparkles(ctx: CanvasRenderingContext2D, width: number, height: number, hitLineY: number) {
  sparkles = sparkles.filter(s => {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= 0.03;
    s.vy += 0.1; // gravity

    if (s.life <= 0) return false;

    ctx.save();
    ctx.globalAlpha = s.life;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    const size = s.life * 6;
    // Star shape
    ctx.arc(s.x, s.y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    return true;
  });
}

export default FallingNotes;
