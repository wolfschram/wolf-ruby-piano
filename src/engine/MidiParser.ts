import { Midi } from '@tonejs/midi';
import { NoteEvent, midiToNoteName } from '../types';
import { Song } from '../types';

/**
 * MIDI instrument families considered "piano-like" for track selection.
 * General MIDI program numbers 0-7 = Piano, 8-15 = Chromatic Percussion (celesta, vibraphone, etc.)
 */
const PIANO_PROGRAMS = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, // Piano family (acoustic grand → clavinet)
]);
const KEYBOARD_PROGRAMS = new Set([
  0, 1, 2, 3, 4, 5, 6, 7,     // Piano
  8, 9, 10, 11, 12, 13, 14, 15, // Chromatic percussion (celesta, glockenspiel, vibraphone, etc.)
  16, 17, 18, 19, 20, 21, 22, 23, // Organ
  24, 25, 26, 27, 28, 29, 30, 31, // Guitar (close enough for melody)
]);

/**
 * Score a track for "piano-playability". Higher = better candidate.
 * Considers: instrument type, pitch range, note density, duration.
 */
function scoreTrackForPiano(track: { notes: Array<{ midi: number; time: number; duration: number; velocity: number }>; instrument: { number: number; name: string }; channel: number }): number {
  if (track.notes.length === 0) return -1;
  if (track.channel === 9) return -1; // Channel 10 = percussion, skip

  let score = 0;
  const program = track.instrument.number;

  // Strongly prefer piano instruments
  if (PIANO_PROGRAMS.has(program)) score += 100;
  else if (KEYBOARD_PROGRAMS.has(program)) score += 50;
  else score += 5; // Non-keyboard instruments get low base score

  // Prefer tracks in playable piano range (A1=33 to C7=96)
  let inRange = 0;
  for (const n of track.notes) {
    if (n.midi >= 33 && n.midi <= 96) inRange++;
  }
  const rangePct = inRange / track.notes.length;
  score += rangePct * 30;

  // Prefer reasonable note density (not too sparse, not too dense)
  const duration = track.notes[track.notes.length - 1].time - track.notes[0].time;
  if (duration > 0) {
    const notesPerSecond = track.notes.length / duration;
    if (notesPerSecond > 0.5 && notesPerSecond < 8) score += 20;
    else if (notesPerSecond >= 8) score -= 10; // Too dense = probably arpeggiated strings
  }

  // Bonus for tracks with reasonable note count
  if (track.notes.length >= 10 && track.notes.length <= 500) score += 15;

  return score;
}

/**
 * Parse a MIDI file buffer into a Song object.
 *
 * Smart track selection:
 *   - 1-2 tracks: use all tracks (likely already a piano arrangement)
 *   - 3+ tracks: score each track for piano-playability and pick
 *     the top 2 (melody + accompaniment), assigning right/left hand
 *   - Pitch-based hand assignment: notes >= middle C (60) = right, below = left
 */
export function parseMidiBuffer(buffer: ArrayBuffer, meta?: { title?: string; artist?: string; filePath?: string; source?: 'built-in' | 'imported' | 'downloaded' }): Song {
  const midi = new Midi(buffer);
  const notes: NoteEvent[] = [];

  // Get tracks with notes
  const tracksWithNotes = midi.tracks
    .map((track, idx) => ({ track, idx }))
    .filter(t => t.track.notes.length > 0);

  // Decide which tracks to use
  let selectedTracks: Array<{ track: typeof midi.tracks[0]; idx: number; role: 'right' | 'left' | 'auto' }>;
  let isOrchestralReduction = false;

  if (tracksWithNotes.length <= 2) {
    // Simple case: 1-2 tracks, use them directly
    selectedTracks = tracksWithNotes.map((t, i) => ({
      ...t,
      role: tracksWithNotes.length === 1 ? 'auto' as const :
            i === 0 ? 'right' as const : 'left' as const,
    }));
    console.log(`[MidiParser] Simple ${tracksWithNotes.length}-track file, using all tracks`);
  } else {
    // Multi-track orchestral file: score and select best tracks for piano
    const scored = tracksWithNotes
      .map(t => ({
        ...t,
        score: scoreTrackForPiano(t.track as any),
        avgPitch: t.track.notes.reduce((sum, n) => sum + n.midi, 0) / t.track.notes.length,
      }))
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log(`[MidiParser] Multi-track file (${tracksWithNotes.length} tracks with notes). Track scores:`);
    scored.forEach(t => {
      console.log(`  Track ${t.idx}: score=${t.score.toFixed(0)}, notes=${t.track.notes.length}, instrument=${t.track.instrument.name}, avgPitch=${t.avgPitch.toFixed(0)}`);
    });

    // Take top 2 tracks (or just 1 if only 1 is good)
    const topTracks = scored.slice(0, Math.min(2, scored.length));

    if (topTracks.length === 2) {
      // Higher average pitch = right hand
      topTracks.sort((a, b) => b.avgPitch - a.avgPitch);
      selectedTracks = [
        { ...topTracks[0], role: 'right' as const },
        { ...topTracks[1], role: 'left' as const },
      ];
    } else {
      selectedTracks = topTracks.map(t => ({ ...t, role: 'auto' as const }));
    }

    console.log(`[MidiParser] Selected ${selectedTracks.length} tracks for piano arrangement`);
    isOrchestralReduction = true;
  }

  // Extract notes from selected tracks
  for (const { track, role } of selectedTracks) {
    for (const note of track.notes) {
      let hand: 'left' | 'right';
      if (role === 'auto') {
        hand = note.midi >= 60 ? 'right' : 'left';
      } else {
        hand = role;
      }

      notes.push({
        pitch: note.midi,
        startTime: note.time * 1000,
        duration: note.duration * 1000,
        hand,
        velocity: Math.round(note.velocity * 127),
        noteName: midiToNoteName(note.midi),
      });
    }
  }

  // Sort by start time
  notes.sort((a, b) => a.startTime - b.startTime);

  // Merge adjacent/overlapping notes at the same pitch + hand.
  // Many MIDI arrangements split sustained notes into repeated short events
  // which makes practice mode unplayable (requires hitting the same key
  // dozens of times for what should be one held note).
  const merged = mergeAdjacentNotes(notes);
  // Replace notes array contents with merged result
  notes.length = 0;
  notes.push(...merged);

  let durationMs = 0;
  for (const n of notes) {
    const end = n.startTime + n.duration;
    if (end > durationMs) durationMs = end;
  }

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
    orchestralReduction: isOrchestralReduction,
  };
}

/**
 * Merge adjacent or overlapping notes at the same pitch + hand into
 * a single sustained note. This fixes MIDI arrangements that use
 * repeated short note events instead of one long held note.
 *
 * Gap tolerance: if two same-pitch notes are within 50ms of each other,
 * they're merged into one sustained note.
 */
function mergeAdjacentNotes(notes: NoteEvent[]): NoteEvent[] {
  if (notes.length === 0) return notes;

  const GAP_TOLERANCE_MS = 50; // merge notes within 50ms of each other

  // Group notes by pitch + hand
  const groups = new Map<string, NoteEvent[]>();
  for (const note of notes) {
    const key = `${note.pitch}:${note.hand}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(note);
  }

  const result: NoteEvent[] = [];

  for (const [, group] of groups) {
    // Group is already sorted by startTime (parent array was sorted)
    let current = { ...group[0] };

    for (let i = 1; i < group.length; i++) {
      const next = group[i];
      const currentEnd = current.startTime + current.duration;

      // If next note starts within GAP_TOLERANCE_MS of current note's end, merge
      if (next.startTime <= currentEnd + GAP_TOLERANCE_MS) {
        // Extend current note to cover both
        const newEnd = Math.max(currentEnd, next.startTime + next.duration);
        current.duration = newEnd - current.startTime;
        // Keep the higher velocity
        current.velocity = Math.max(current.velocity, next.velocity);
      } else {
        // Gap too large — emit current and start new
        result.push(current);
        current = { ...next };
      }
    }
    // Don't forget the last note in the group
    result.push(current);
  }

  // Re-sort by start time
  result.sort((a, b) => a.startTime - b.startTime);

  const reduction = notes.length - result.length;
  if (reduction > 0) {
    console.log(`[MidiParser] Merged ${reduction} adjacent notes (${notes.length} → ${result.length})`);
  }

  return result;
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

  let maxEndMs = 0, minPitch = 127, maxPitch = 0;
  for (const n of notes) {
    const end = n.startTime + n.duration;
    if (end > maxEndMs) maxEndMs = end;
    if (n.pitch < minPitch) minPitch = n.pitch;
    if (n.pitch > maxPitch) maxPitch = n.pitch;
  }
  const durationSec = maxEndMs / 1000;
  const notesPerSecond = notes.length / Math.max(durationSec, 1);
  const pitchRange = maxPitch - minPitch;
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
