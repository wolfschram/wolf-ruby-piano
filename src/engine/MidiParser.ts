import { Midi } from '@tonejs/midi';
import { NoteEvent, midiToNoteName } from '../types';
import { Song } from '../types';

/**
 * Parse a MIDI file buffer into a Song object.
 * Separates left/right hand by track index or MIDI channel:
 *   - Track 0 or channels 0-7  → right hand
 *   - Track 1 or channels 8-15 → left hand
 * Single-track files default to right hand.
 */
export function parseMidiBuffer(buffer: ArrayBuffer, meta?: { title?: string; artist?: string; filePath?: string; source?: 'built-in' | 'imported' | 'downloaded' }): Song {
  const midi = new Midi(buffer);
  const notes: NoteEvent[] = [];

  midi.tracks.forEach((track, trackIndex) => {
    track.notes.forEach((note) => {
      // Determine hand: track 0 = right, track 1+ = left
      // If single track, use channel: 0-7 = right, 8-15 = left
      let hand: 'left' | 'right' = 'right';
      if (midi.tracks.length >= 2) {
        hand = trackIndex === 0 ? 'right' : 'left';
      } else {
        hand = note.midi < 60 ? 'left' : 'right'; // Below middle C = left
      }

      notes.push({
        pitch: note.midi,
        startTime: note.time * 1000,       // seconds → ms
        duration: note.duration * 1000,    // seconds → ms
        hand,
        velocity: Math.round(note.velocity * 127),
        noteName: midiToNoteName(note.midi),
      });
    });
  });

  // Sort by start time
  notes.sort((a, b) => a.startTime - b.startTime);

  const durationMs = notes.length > 0
    ? Math.max(...notes.map(n => n.startTime + n.duration))
    : 0;

  const bpm = midi.header.tempos.length > 0
    ? Math.round(midi.header.tempos[0].bpm)
    : 120;

  // Auto-detect difficulty
  const difficulty = autoDetectDifficulty(notes, bpm);

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `song-${Date.now()}`,
    title: meta?.title ?? midi.header.name ?? 'Untitled',
    artist: meta?.artist ?? 'Unknown',
    difficulty,
    notes,
    durationMs,
    bpm,
    source: meta?.source ?? 'imported',
    filePath: meta?.filePath ?? '',
  };
}

/**
 * Parse a MIDI file from a File object (browser/Electron file picker).
 */
export async function parseMidiFile(file: File, meta?: { title?: string; artist?: string }): Promise<Song> {
  const buffer = await file.arrayBuffer();
  return parseMidiBuffer(buffer, { ...meta, filePath: file.name, source: 'imported' });
}

/**
 * Auto-detect difficulty 1-5 based on note density, range, and tempo.
 */
function autoDetectDifficulty(notes: NoteEvent[], bpm: number): 1 | 2 | 3 | 4 | 5 {
  if (notes.length === 0) return 1;

  const durationSec = (Math.max(...notes.map(n => n.startTime + n.duration))) / 1000;
  const notesPerSecond = notes.length / Math.max(durationSec, 1);
  const pitchRange = Math.max(...notes.map(n => n.pitch)) - Math.min(...notes.map(n => n.pitch));
  const hasBothHands = new Set(notes.map(n => n.hand)).size > 1;

  // Simultaneous notes (chords)
  const chordCount = countSimultaneousNotes(notes);

  let score = 0;
  if (notesPerSecond > 4) score += 2;
  else if (notesPerSecond > 2) score += 1;

  if (pitchRange > 36) score += 2;
  else if (pitchRange > 24) score += 1;

  if (hasBothHands) score += 1;
  if (bpm > 140) score += 1;
  if (chordCount > notes.length * 0.3) score += 1;

  return Math.min(5, Math.max(1, Math.round(score * 5 / 7))) as 1 | 2 | 3 | 4 | 5;
}

function countSimultaneousNotes(notes: NoteEvent[]): number {
  let count = 0;
  for (let i = 1; i < notes.length; i++) {
    if (Math.abs(notes[i].startTime - notes[i - 1].startTime) < 30) {
      count++;
    }
  }
  return count;
}
