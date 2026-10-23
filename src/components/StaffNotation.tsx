import React, { useRef, useEffect, useCallback } from 'react';
import { NoteEvent, midiToNoteName, isBlackKey } from '../types';

interface StaffNotationProps {
  notes: NoteEvent[];
  currentTimeMs: number;
  width: number;
  height?: number;
  mode?: 'wolf' | 'ruby';
  handFilter?: 'both' | 'left' | 'right';
}

// Staff lines represent E4, G4, B4, D5, F5 (treble clef lines bottom to top)
// Ledger lines for Middle C (C4) below the staff
const TREBLE_LINES = [64, 67, 71, 74, 77]; // E4, G4, B4, D5, F5
const TREBLE_SPACES = [65, 69, 72, 76]; // F4, A4, C5, E5

// Map MIDI note to Y position on the staff (0 = middle of staff)
// Each step = half a staff-line spacing
function noteToStaffY(midi: number): number {
  // C4=60 is 2 ledger-line-spaces below the bottom staff line (E4=64)
  // We use a lookup based on note name within the octave
  const NOTE_OFFSETS: Record<number, number> = {
    0: 0,   // C
    1: 0.5, // C#
    2: 1,   // D
    3: 1.5, // D#
    4: 2,   // E
    5: 3,   // F
    6: 3.5, // F#
    7: 4,   // G
    8: 4.5, // G#
    9: 5,   // A
    10: 5.5, // A#
    11: 6,  // B
  };

  const octave = Math.floor(midi / 12) - 1;
  const noteInOctave = midi % 12;
  const baseOffset = NOTE_OFFSETS[noteInOctave];

  // Position relative to C4 (midi 60)
  // C4 = 0, D4 = 1, E4 = 2, F4 = 3, G4 = 4, A4 = 5, B4 = 6
  // C5 = 7, etc.
  const stepsFromC4 = (octave - 4) * 7 + baseOffset;
  return stepsFromC4;
}

// Check if a note is sharp/flat
function isSharp(midi: number): boolean {
  return isBlackKey(midi);
}

/**
 * StaffNotation — Canvas-based simplified sheet music preview.
 * Shows a window of upcoming notes on a treble clef staff.
 *
 * For Ruby: simplified with big note heads, note names inside, colorful
 * For Wolf: traditional look with proper stems
 */
export const StaffNotation: React.FC<StaffNotationProps> = ({
  notes,
  currentTimeMs,
  width,
  height = 120,
  mode = 'ruby',
  handFilter = 'both',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dprRef = useRef(window.devicePixelRatio || 1);

  // How many ms of notes to show ahead
  const LOOKAHEAD_MS = 4000;
  // How many ms of past notes to show
  const LOOKBEHIND_MS = 500;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = dprRef.current;
    const w = width;
    const h = height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    // Background
    const isRuby = mode === 'ruby';
    ctx.fillStyle = isRuby ? '#12121E' : '#0D0D18';
    ctx.fillRect(0, 0, w, h);

    // Staff parameters
    const staffTop = 25;
    const staffLineSpacing = (h - 50) / 4; // 5 lines, 4 spaces
    const noteRadius = isRuby ? Math.min(staffLineSpacing * 0.45, 14) : Math.min(staffLineSpacing * 0.38, 11);

    // Draw staff lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const y = staffTop + i * staffLineSpacing;
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 10, y);
      ctx.stroke();
    }

    // Treble clef symbol (simplified)
    ctx.font = `${staffLineSpacing * 3.5}px serif`;
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const clefY = staffTop + staffLineSpacing * 2;
    ctx.fillText('𝄞', 22, clefY + staffLineSpacing * 0.3);

    // Filter notes by hand
    const filteredNotes = handFilter === 'both'
      ? notes
      : notes.filter(n => n.hand === handFilter);

    // Get visible notes (current window)
    const windowStart = currentTimeMs - LOOKBEHIND_MS;
    const windowEnd = currentTimeMs + LOOKAHEAD_MS;

    const visibleNotes = filteredNotes.filter(n =>
      n.startTime >= windowStart && n.startTime <= windowEnd
    );

    // Limit to prevent overdraw
    const maxNotes = 40;
    const displayNotes = visibleNotes.slice(0, maxNotes);

    // Time cursor line (shows "now")
    const nowX = 40 + ((LOOKBEHIND_MS) / (LOOKBEHIND_MS + LOOKAHEAD_MS)) * (w - 50);
    ctx.strokeStyle = isRuby ? '#5DCAA540' : '#CC883340';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(nowX, staffTop - 5);
    ctx.lineTo(nowX, staffTop + staffLineSpacing * 4 + 5);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Now" label
    ctx.font = '9px system-ui';
    ctx.fillStyle = isRuby ? '#5DCAA580' : '#CC883380';
    ctx.textAlign = 'center';
    ctx.fillText('now', nowX, staffTop - 10);

    // Draw each visible note
    for (const note of displayNotes) {
      // X position based on time
      const timeDelta = note.startTime - currentTimeMs;
      const xRatio = (timeDelta + LOOKBEHIND_MS) / (LOOKBEHIND_MS + LOOKAHEAD_MS);
      const noteX = 40 + xRatio * (w - 50);

      // Y position based on pitch
      const stepsFromC4 = noteToStaffY(note.pitch);
      // E4 (bottom line) = stepsFromC4 of 2
      // Each step up from E4 = half a staffLineSpacing up
      const bottomLineY = staffTop + staffLineSpacing * 4; // Bottom staff line = E4
      const noteY = bottomLineY - (stepsFromC4 - 2) * (staffLineSpacing / 2);

      // Clamp Y to reasonable range
      const clampedY = Math.max(5, Math.min(h - 5, noteY));

      // Note opacity (past notes fade, future notes are bright)
      const isPast = note.startTime < currentTimeMs;
      const alpha = isPast ? 0.3 : Math.max(0.4, 1 - (timeDelta / LOOKAHEAD_MS) * 0.6);

      // Colors
      const leftColor = '#3366BB';
      const rightColor = isRuby ? '#F0997B' : '#CC8833';
      const noteColor = note.hand === 'left' ? leftColor : rightColor;

      // Ledger lines (for notes below or above the staff)
      ctx.strokeStyle = `${noteColor}${Math.round(alpha * 80).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 1;

      // Below staff: C4 (step 0), D4 (step 1) need ledger line at C4
      if (stepsFromC4 <= 0) {
        // Ledger line for middle C
        const ledgerY = bottomLineY + 1 * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(noteX - noteRadius - 4, ledgerY);
        ctx.lineTo(noteX + noteRadius + 4, ledgerY);
        ctx.stroke();
      }
      if (stepsFromC4 <= -2) {
        // Ledger line below middle C (A3)
        const ledgerY = bottomLineY + 2 * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(noteX - noteRadius - 4, ledgerY);
        ctx.lineTo(noteX + noteRadius + 4, ledgerY);
        ctx.stroke();
      }

      // Above staff: A5 (step 12), B5 (step 13) need ledger at A5
      if (stepsFromC4 >= 12) {
        const ledgerY = staffTop - 1 * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(noteX - noteRadius - 4, ledgerY);
        ctx.lineTo(noteX + noteRadius + 4, ledgerY);
        ctx.stroke();
      }

      // Draw note head
      ctx.beginPath();
      if (isRuby) {
        // Ruby: big filled circles with note name inside
        ctx.arc(noteX, clampedY, noteRadius, 0, Math.PI * 2);
        ctx.fillStyle = noteColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // White outline for visibility
        ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Note name inside
        const noteName = midiToNoteName(note.pitch);
        const letter = noteName.replace(/[0-9#]/g, '');
        ctx.font = `bold ${Math.round(noteRadius * 1.1)}px system-ui`;
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.9})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letter, noteX, clampedY);

        // Sharp indicator
        if (isSharp(note.pitch)) {
          ctx.font = `bold ${Math.round(noteRadius * 0.8)}px system-ui`;
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
          ctx.fillText('♯', noteX + noteRadius + 6, clampedY);
        }
      } else {
        // Wolf: traditional filled ovals with stems
        ctx.save();
        ctx.translate(noteX, clampedY);
        ctx.scale(1, 0.75); // Oval shape
        ctx.arc(0, 0, noteRadius, 0, Math.PI * 2);
        ctx.restore();
        ctx.fillStyle = noteColor + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.fill();

        // Stem
        ctx.strokeStyle = noteColor + Math.round(alpha * 200).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.5;
        const stemUp = clampedY > staffTop + staffLineSpacing * 2;
        ctx.beginPath();
        if (stemUp) {
          ctx.moveTo(noteX + noteRadius - 1, clampedY);
          ctx.lineTo(noteX + noteRadius - 1, clampedY - staffLineSpacing * 2.5);
        } else {
          ctx.moveTo(noteX - noteRadius + 1, clampedY);
          ctx.lineTo(noteX - noteRadius + 1, clampedY + staffLineSpacing * 2.5);
        }
        ctx.stroke();

        // Sharp indicator
        if (isSharp(note.pitch)) {
          ctx.font = `${Math.round(noteRadius * 1.2)}px serif`;
          ctx.fillStyle = `rgba(255,255,255,${alpha * 0.6})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('♯', noteX - noteRadius - 8, clampedY);
        }
      }
    }

    // Label at left
    ctx.font = '10px system-ui';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(isRuby ? 'Notes' : 'Staff', 5, h - 14);

  }, [notes, currentTimeMs, width, height, mode, handFilter, LOOKAHEAD_MS, LOOKBEHIND_MS]);

  // Redraw on every render (driven by parent's animation frame)
  useEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width,
        height,
        display: 'block',
        borderBottom: mode === 'ruby' ? '1px solid #1A1A2E' : '1px solid #1A1A2E',
      }}
    />
  );
};

export default StaffNotation;
