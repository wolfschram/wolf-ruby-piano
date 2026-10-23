// ============================================================
// Wolf & Ruby Piano — Core Types
// ============================================================

export interface NoteEvent {
  pitch: number;        // MIDI note number (60 = middle C)
  startTime: number;    // milliseconds from song start
  duration: number;     // milliseconds
  hand: 'left' | 'right';
  velocity: number;     // 0-127
  noteName?: string;    // e.g. 'C4', 'D#5'
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  notes: NoteEvent[];
  durationMs: number;
  bpm: number;
  source: 'built-in' | 'imported' | 'downloaded';
  filePath: string;
  category?: 'wolf' | 'ruby';
  orchestralReduction?: boolean;  // true if MIDI was multi-track orchestral, not a piano arrangement
}

export type PlaybackMode = 'listen' | 'practice' | 'perform';

export interface PlaybackState {
  isPlaying: boolean;
  currentTimeMs: number;
  speedMultiplier: number;   // 0.25 to 1.5
  loopStart?: number;        // bar number
  loopEnd?: number;          // bar number
  mode: PlaybackMode;
  handFilter: 'both' | 'left' | 'right';
}

export interface AnimalMapping {
  note: string;
  animal: string;
  emoji: string;
  color: string;
  sound?: string;
}

export type AppMode = 'wolf' | 'ruby';

export interface HitResult {
  noteIndex: number;
  accuracy: 'perfect' | 'good' | 'miss';
  timingOffsetMs: number;
}

export interface ScoreState {
  totalNotes: number;
  hitNotes: number;
  perfectHits: number;
  goodHits: number;
  misses: number;
  streak: number;
  maxStreak: number;
  accuracy: number;        // 0-100
  stars: number;           // 0-5 for Ruby mode
}

// Piano key layout helpers
export interface PianoKey {
  midiNote: number;
  noteName: string;
  isBlack: boolean;
  octave: number;
  x: number;
  width: number;
  height: number;
}

export const MIDI_NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = MIDI_NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

export function noteNameToBase(name: string): string {
  return name.replace(/[0-9]/g, '');
}

export function isBlackKey(midi: number): boolean {
  const n = midi % 12;
  return [1, 3, 6, 8, 10].includes(n);
}
