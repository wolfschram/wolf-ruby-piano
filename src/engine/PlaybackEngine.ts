import { NoteEvent, PlaybackState, PlaybackMode } from '../types';
import audioEngine from './AudioEngine';

export type PlaybackCallback = (state: PlaybackState, activeNotes: NoteEvent[]) => void;
export type NoteHitCallback = (note: NoteEvent, noteIndex: number) => void;
export type WaitForInputCallback = (expectedNote: NoteEvent, noteIndex: number) => void;

/**
 * PlaybackEngine — manages song playback timing, speed, looping.
 *
 * Three modes:
 *   LISTEN  — auto-plays, user watches
 *   PRACTICE — pauses at each note, waits for correct input
 *   PERFORM — plays at speed, scores accuracy
 */
export class PlaybackEngine {
  private notes: NoteEvent[] = [];
  private state: PlaybackState;
  private animFrameId: number | null = null;
  private startTimestamp: number = 0;
  private pausedAt: number = 0;
  private currentNoteIndex: number = 0;
  private playedNotes: Set<number> = new Set();
  private waitingForInput: boolean = false;

  // Callbacks
  private onUpdate: PlaybackCallback | null = null;
  private onNoteHit: NoteHitCallback | null = null;
  private onWaitForInput: WaitForInputCallback | null = null;
  private onSongEnd: (() => void) | null = null;

  constructor() {
    this.state = {
      isPlaying: false,
      currentTimeMs: 0,
      speedMultiplier: 0.5,  // Default 50% for new songs
      mode: 'listen',
      handFilter: 'both',
    };
  }

  loadNotes(notes: NoteEvent[]): void {
    this.notes = [...notes];
    this.reset();
  }

  setCallbacks(opts: {
    onUpdate?: PlaybackCallback;
    onNoteHit?: NoteHitCallback;
    onWaitForInput?: WaitForInputCallback;
    onSongEnd?: () => void;
  }): void {
    if (opts.onUpdate) this.onUpdate = opts.onUpdate;
    if (opts.onNoteHit) this.onNoteHit = opts.onNoteHit;
    if (opts.onWaitForInput) this.onWaitForInput = opts.onWaitForInput;
    if (opts.onSongEnd) this.onSongEnd = opts.onSongEnd;
  }

  play(): void {
    if (this.state.isPlaying) return;
    this.state.isPlaying = true;
    this.startTimestamp = performance.now() - (this.pausedAt / this.state.speedMultiplier);
    this.waitingForInput = false;
    this.tick();
  }

  pause(): void {
    this.state.isPlaying = false;
    this.pausedAt = this.state.currentTimeMs;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    audioEngine.stopAll();
  }

  stop(): void {
    this.pause();
    this.reset();
  }

  reset(): void {
    this.state.currentTimeMs = 0;
    this.state.isPlaying = false;
    this.pausedAt = 0;
    this.currentNoteIndex = 0;
    this.playedNotes.clear();
    this.waitingForInput = false;
    audioEngine.stopAll();
  }

  setSpeed(multiplier: number): void {
    if (this.state.isPlaying) {
      this.pausedAt = this.state.currentTimeMs;
      this.startTimestamp = performance.now() - (this.pausedAt / multiplier);
    }
    this.state.speedMultiplier = Math.max(0.25, Math.min(1.5, multiplier));
  }

  setMode(mode: PlaybackMode): void {
    this.state.mode = mode;
    if (mode === 'practice') {
      this.waitingForInput = false;
    }
  }

  setHandFilter(filter: 'both' | 'left' | 'right'): void {
    this.state.handFilter = filter;
  }

  setLoop(startBar?: number, endBar?: number): void {
    this.state.loopStart = startBar;
    this.state.loopEnd = endBar;
  }

  seekTo(timeMs: number): void {
    this.pausedAt = timeMs;
    this.state.currentTimeMs = timeMs;
    if (this.state.isPlaying) {
      this.startTimestamp = performance.now() - (timeMs / this.state.speedMultiplier);
    }
    // Recalculate current note index
    this.currentNoteIndex = this.getFilteredNotes().findIndex(n => n.startTime >= timeMs);
    if (this.currentNoteIndex < 0) this.currentNoteIndex = this.getFilteredNotes().length;
    this.playedNotes.clear();
  }

  /**
   * Step back one note from the current position.
   * Returns the new time position, or -1 if already at the start.
   */
  stepBackOneNote(): number {
    const filtered = this.getFilteredNotes();
    if (filtered.length === 0) return -1;

    // Find the note just before current time
    const currentTime = this.state.currentTimeMs;
    let targetIdx = -1;
    for (let i = filtered.length - 1; i >= 0; i--) {
      if (filtered[i].startTime < currentTime - 50) { // 50ms tolerance to avoid re-landing on same note
        targetIdx = i;
        break;
      }
    }

    if (targetIdx < 0) targetIdx = 0;

    const targetTime = filtered[targetIdx].startTime;
    this.seekTo(targetTime);

    // Pause so user can see where they are
    const wasPlaying = this.state.isPlaying;
    if (wasPlaying) this.pause();

    return targetTime;
  }

  /**
   * Get the note at or near the current position (for display).
   */
  getCurrentNote(): { pitch: number; startTime: number } | null {
    const filtered = this.getFilteredNotes();
    if (this.currentNoteIndex >= 0 && this.currentNoteIndex < filtered.length) {
      return filtered[this.currentNoteIndex];
    }
    return null;
  }

  /**
   * Called by MIDI input or virtual keyboard when user presses a note.
   * In PRACTICE mode, checks if it matches the expected note and advances.
   * In PERFORM mode, scores the hit.
   */
  onUserInput(midiNote: number): { matched: boolean; noteIndex: number } {
    const filtered = this.getFilteredNotes();

    if (this.state.mode === 'practice' && this.waitingForInput) {
      const expected = filtered[this.currentNoteIndex];
      if (expected && expected.pitch === midiNote) {
        this.playedNotes.add(this.currentNoteIndex);
        this.onNoteHit?.(expected, this.currentNoteIndex);
        this.currentNoteIndex++;
        this.waitingForInput = false;

        // Resume playback to next note
        if (this.state.isPlaying || this.state.mode === 'practice') {
          const nextNote = filtered[this.currentNoteIndex];
          if (nextNote) {
            this.pausedAt = nextNote.startTime;
            this.state.currentTimeMs = nextNote.startTime;
            this.startTimestamp = performance.now() - (this.pausedAt / this.state.speedMultiplier);
            if (!this.animFrameId) this.tick();
          }
        }
        return { matched: true, noteIndex: this.currentNoteIndex - 1 };
      }
      return { matched: false, noteIndex: -1 };
    }

    if (this.state.mode === 'perform') {
      // Find closest note within a timing window
      const window = 200; // ms tolerance
      const time = this.state.currentTimeMs;
      for (let i = this.currentNoteIndex; i < filtered.length; i++) {
        if (filtered[i].startTime > time + window) break;
        if (filtered[i].pitch === midiNote && !this.playedNotes.has(i)) {
          this.playedNotes.add(i);
          this.onNoteHit?.(filtered[i], i);
          return { matched: true, noteIndex: i };
        }
      }
    }

    return { matched: false, noteIndex: -1 };
  }

  getState(): PlaybackState {
    return { ...this.state };
  }

  getNotes(): NoteEvent[] {
    return this.notes;
  }

  getFilteredNotes(): NoteEvent[] {
    if (this.state.handFilter === 'both') return this.notes;
    return this.notes.filter(n => n.hand === this.state.handFilter);
  }

  getActiveNotes(timeMs?: number): NoteEvent[] {
    const t = timeMs ?? this.state.currentTimeMs;
    return this.getFilteredNotes().filter(
      n => n.startTime <= t && (n.startTime + n.duration) >= t
    );
  }

  getCurrentNoteIndex(): number {
    return this.currentNoteIndex;
  }

  isWaiting(): boolean {
    return this.waitingForInput;
  }

  private tick = (): void => {
    if (!this.state.isPlaying && !this.waitingForInput) return;

    if (!this.waitingForInput) {
      const elapsed = (performance.now() - this.startTimestamp) * this.state.speedMultiplier;
      this.state.currentTimeMs = elapsed;
    }

    const filtered = this.getFilteredNotes();
    const time = this.state.currentTimeMs;

    // Check for notes that should play
    while (this.currentNoteIndex < filtered.length) {
      const note = filtered[this.currentNoteIndex];
      if (note.startTime > time) break;

      if (!this.playedNotes.has(this.currentNoteIndex)) {
        if (this.state.mode === 'practice') {
          // Pause and wait for input
          this.waitingForInput = true;
          this.state.currentTimeMs = note.startTime;
          this.onWaitForInput?.(note, this.currentNoteIndex);
          this.onUpdate?.(this.state, this.getActiveNotes());
          this.animFrameId = requestAnimationFrame(this.tick);
          return;
        }

        // LISTEN or PERFORM — auto-play the note sound
        if (this.state.mode === 'listen') {
          audioEngine.playNote(note.pitch, note.velocity, note.duration / 1000);
          this.playedNotes.add(this.currentNoteIndex);
          this.onNoteHit?.(note, this.currentNoteIndex);
        }
        this.currentNoteIndex++;
      } else {
        this.currentNoteIndex++;
      }
    }

    // Check song end
    const songEnd = filtered.length > 0
      ? Math.max(...filtered.map(n => n.startTime + n.duration))
      : 0;

    if (time >= songEnd && filtered.length > 0) {
      // Check for loop
      if (this.state.loopStart !== undefined && this.state.loopEnd !== undefined) {
        this.seekTo(0); // Simplified — full bar-based looping needs BPM math
        this.play();
        return;
      }
      this.pause();
      this.onSongEnd?.();
      return;
    }

    // Notify UI
    this.onUpdate?.(this.state, this.getActiveNotes());

    this.animFrameId = requestAnimationFrame(this.tick);
  };

  dispose(): void {
    this.stop();
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }
}

export const playbackEngine = new PlaybackEngine();
export default playbackEngine;
