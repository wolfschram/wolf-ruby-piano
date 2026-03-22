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
  onReady?: () => void;
}

// Colors
const WOLF_LEFT = '#3366BB';
const WOLF_RIGHT = '#CC8833';
const WOLF_HIT_LINE = '#FFFFFF20';
const BG_WOLF = '#0A0A12';
const BG_RUBY = '#0A0A12';

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

    const dpr = dprRef.current;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = mode === 'wolf' ? BG_WOLF : BG_RUBY;
    ctx.fillRect(0, 0, width, height);

    const hitLineY = height - HIT_LINE_Y_OFFSET;
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

    // Filter notes by hand
    const filtered = handFilter === 'both'
      ? notes
      : notes.filter(n => n.hand === handFilter);

    // Draw visible notes
    for (let i = 0; i < filtered.length; i++) {
      const note = filtered[i];
      const relativeStart = note.startTime - currentTimeMs;
      const relativeEnd = relativeStart + note.duration;

      // Skip notes that are fully past or too far ahead
      if (relativeEnd < -500) continue;
      if (relativeStart > LOOKAHEAD_MS + 1000) break; // notes are sorted by startTime

      // Calculate Y position (note falls downward, hitLineY = time 0)
      const noteTopY = hitLineY - (relativeStart + note.duration) * pxPerMs;
      const noteBottomY = hitLineY - relativeStart * pxPerMs;
      const noteH = Math.max(noteBottomY - noteTopY, mode === 'ruby' ? 20 : 8);

      // Get X position — both modes use the same full piano layout
      const keyPos = getKeyX(note.pitch);

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

      // Is this note currently at the hit line?
      const isAtHitLine = relativeStart <= 0 && relativeEnd >= 0;
      // Is this note the one we're waiting for?
      const isWaiting = waitingNoteIndex !== undefined &&
        notes.indexOf(note) === waitingNoteIndex;
      // Was this note already hit?
      const wasHit = hitNotes.has(notes.indexOf(note));

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

      // Ruby mode: draw emoji inside
      if (mode === 'ruby' && noteH > 30) {
        ctx.globalAlpha = wasHit ? 0.3 : 1;
        ctx.shadowBlur = 0;
        const emoji = getAnimalEmoji(midiToNoteName(note.pitch));
        ctx.font = `${Math.min(noteH - 10, 32)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, noteX + noteW / 2, noteTopY + noteH / 2);
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
    }

    // Draw sparkle particles for recently hit notes (Ruby mode)
    if (mode === 'ruby') {
      drawSparkles(ctx, width, height, hitLineY);
    }

  }, [notes, currentTimeMs, mode, handFilter, width, height, startNote, endNote,
      speedMultiplier, waitingNoteIndex, hitNotes, getKeyX]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
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
