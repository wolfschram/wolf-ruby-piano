import { NoteEvent, PlaybackState, PlaybackMode } from '../types';
import audioEngine from './AudioEngine';

export type PlaybackCallback = (state: PlaybackState, activeNotes: NoteEvent[]) => void;
export type NoteHitCallback = (note: NoteEvent, noteIndex: number) => void;
export type WaitForInputCallback = (expectedNote: NoteEvent, noteIndex: number) => void;

/**
 * Backward chaining state — practice from the END of a phrase, expanding backward.
 * Each successful pass adds one more note at the front.
 */
export interface BackwardChainState {
  active: boolean;
  anchorIndex: number;   // The fixed end-point note index
  startIndex: number;    // The current start note index (moves backward)
  passesAtCurrent: number; // Consecutive successful passes at this length
  requiredPasses: number;  // How many passes to nail before expanding (default 2)
}

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

  // Cached song end time — computed once on loadNotes, NOT every frame
  private cachedSongEndMs: number = 0;

  // Song BPM — used for bar-based loop calculations
  private bpm: number = 120;

  // Loop support — millisecond-based boundaries
  private loopStartMs: number | null = null;
  private loopEndMs: number | null = null;

  // Backward chaining
  private backwardChain: BackwardChainState = {
    active: false, anchorIndex: 0, startIndex: 0,
    passesAtCurrent: 0, requiredPasses: 2,
  };
  private chainMissed: boolean = false; // Track if user missed a note in current chain pass

  // Callbacks
  private onUpdate: PlaybackCallback | null = null;
  private onNoteHit: NoteHitCallback | null = null;
  private onNoteMiss: NoteHitCallback | null = null;
  private onWaitForInput: WaitForInputCallback | null = null;
  private onSongEnd: (() => void) | null = null;

  constructor() {
    this.state = {
      isPlaying: false,
      currentTimeMs: 0,
      speedMultiplier: 1.0,
      mode: 'listen',
      handFilter: 'both',
    };
  }

  loadNotes(notes: NoteEvent[], bpm?: number): void {
    this.notes = [...notes];
    this.bpm = bpm ?? 120;
    // Cache song end time ONCE — never recompute in tick()
    this.cachedSongEndMs = 0;
    for (const n of this.notes) {
      const end = n.startTime + n.duration;
      if (end > this.cachedSongEndMs) this.cachedSongEndMs = end;
    }
    this.reset();
  }

  setCallbacks(opts: {
    onUpdate?: PlaybackCallback;
    onNoteHit?: NoteHitCallback;
    onNoteMiss?: NoteHitCallback;
    onWaitForInput?: WaitForInputCallback;
    onSongEnd?: () => void;
  }): void {
    if (opts.onUpdate) this.onUpdate = opts.onUpdate;
    if (opts.onNoteHit) this.onNoteHit = opts.onNoteHit;
    if (opts.onNoteMiss) this.onNoteMiss = opts.onNoteMiss;
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

  /**
   * Milliseconds per bar based on the song's BPM (assumes 4/4 time).
   */
  private getMsPerBar(): number {
    return (60000 / this.bpm) * 4; // 4 beats per bar
  }

  /**
   * Set loop boundaries in milliseconds.
   * When playback reaches loopEndMs, it will jump back to loopStartMs.
   */
  setLoopMs(startMs: number, endMs: number): void {
    if (startMs < 0 || endMs <= startMs) {
      console.warn('[PlaybackEngine] Invalid loop boundaries');
      return;
    }
    this.loopStartMs = startMs;
    this.loopEndMs = endMs;
    // Update state for UI display (bar-based)
    const msPerBar = this.getMsPerBar();
    this.state.loopStart = Math.floor(startMs / msPerBar);
    this.state.loopEnd = Math.floor(endMs / msPerBar);
  }

  /**
   * Convert bar numbers to milliseconds and set loop.
   * Uses song BPM for accurate bar boundaries (4/4 time assumed).
   */
  setLoop(startBar?: number, endBar?: number): void {
    if (startBar !== undefined && endBar !== undefined && startBar < endBar) {
      const msPerBar = this.getMsPerBar();
      const startMs = startBar * msPerBar;
      const endMs = endBar * msPerBar;
      this.setLoopMs(startMs, endMs);
    } else {
      this.clearLoop();
    }
    this.state.loopStart = startBar;
    this.state.loopEnd = endBar;
  }

  /**
   * Clear any active loop.
   */
  clearLoop(): void {
    this.loopStartMs = null;
    this.loopEndMs = null;
    this.state.loopStart = undefined;
    this.state.loopEnd = undefined;
  }

  /**
   * Get loop state (for debugging/UI).
   */
  getLoopState(): { startMs: number | null; endMs: number | null } {
    return { startMs: this.loopStartMs, endMs: this.loopEndMs };
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

        // Backward chain: check if we hit the anchor (end of chain pass)
        if (this.backwardChain.active && this.currentNoteIndex >= this.backwardChain.anchorIndex) {
          const hitIdx = this.currentNoteIndex;
          this.currentNoteIndex++;
          this.waitingForInput = false;
          this.advanceBackwardChain();
          // After advanceBackwardChain, seekTo has been called; restart practice tick
          if (this.backwardChain.active) {
            if (!this.animFrameId) this.tick();
          }
          return { matched: true, noteIndex: hitIdx };
        }

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

      // Wrong note in backward chain — mark as missed
      if (this.backwardChain.active) {
        this.chainMissed = true;
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

  /**
   * Start backward chaining at the current position.
   * The current note becomes the "anchor" (end point).
   * Practice starts with just that one note, then expands backward.
   */
  startBackwardChain(phraseLength: number = 8): void {
    const filtered = this.getFilteredNotes();
    if (filtered.length === 0) return;

    // Anchor = the note at or nearest to current time
    let anchorIdx = this.currentNoteIndex;
    if (anchorIdx >= filtered.length) anchorIdx = filtered.length - 1;

    // If we're starting from a position mid-song, anchor at end of a phrase
    // Use phraseLength to define the max phrase to chain through
    const endIdx = Math.min(anchorIdx + phraseLength - 1, filtered.length - 1);

    this.backwardChain = {
      active: true,
      anchorIndex: endIdx,
      startIndex: endIdx,      // Start with JUST the last note
      passesAtCurrent: 0,
      requiredPasses: 2,
    };
    this.chainMissed = false;

    // Seek to the start note
    this.seekTo(filtered[endIdx].startTime);
    this.state.mode = 'practice';
  }

  /**
   * Called when backward chain pass completes (hit the anchor note).
   * If passes met, expand backward by one note.
   */
  private advanceBackwardChain(): void {
    if (!this.backwardChain.active) return;

    if (!this.chainMissed) {
      this.backwardChain.passesAtCurrent++;
    }

    if (this.backwardChain.passesAtCurrent >= this.backwardChain.requiredPasses) {
      // Expand backward by one note
      if (this.backwardChain.startIndex > 0) {
        this.backwardChain.startIndex--;
        this.backwardChain.passesAtCurrent = 0;
      } else {
        // Reached the beginning — chain complete!
        this.backwardChain.active = false;
      }
    }

    // Reset for next pass
    this.chainMissed = false;
    const filtered = this.getFilteredNotes();
    if (this.backwardChain.active && this.backwardChain.startIndex < filtered.length) {
      this.seekTo(filtered[this.backwardChain.startIndex].startTime);
    }
  }

  /**
   * Stop backward chaining and return to normal practice.
   */
  stopBackwardChain(): void {
    this.backwardChain.active = false;
    this.chainMissed = false;
  }

  /**
   * Get the current backward chain state (for UI display).
   */
  getBackwardChainState(): BackwardChainState {
    return { ...this.backwardChain };
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
    const filtered = this.getFilteredNotes();
    return filtered.filter(n => {
      // Check if note is within current time
      if (!(n.startTime <= t && (n.startTime + n.duration) >= t)) {
        return false;
      }
      // If loop is active, exclude notes outside loop range
      if (this.loopStartMs !== null && this.loopEndMs !== null) {
        const noteStart = n.startTime;
        const noteEnd = n.startTime + n.duration;
        // Note must overlap with loop range
        if (noteEnd < this.loopStartMs || noteStart > this.loopEndMs) {
          return false;
        }
      }
      return true;
    });
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

      // Skip notes outside loop range (if loop is active)
      if (this.loopStartMs !== null && this.loopEndMs !== null) {
        if (note.startTime < this.loopStartMs || note.startTime >= this.loopEndMs) {
          this.currentNoteIndex++;
          continue;
        }
      }

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

        if (this.state.mode === 'listen') {
          // LISTEN — auto-play the note sound
          audioEngine.playNote(note.pitch, note.velocity, note.duration / 1000);
          this.playedNotes.add(this.currentNoteIndex);
          this.onNoteHit?.(note, this.currentNoteIndex);
        } else if (this.state.mode === 'perform') {
          // PERFORM — if note's timing window has passed, record as miss
          const missWindow = 200; // same as onUserInput tolerance
          if (time > note.startTime + missWindow) {
            this.playedNotes.add(this.currentNoteIndex);
            this.onNoteMiss?.(note, this.currentNoteIndex);
          } else {
            break; // Still within timing window — wait for user input
          }
        }
        this.currentNoteIndex++;
      } else {
        this.currentNoteIndex++;
      }
    }

    // Check for loop boundaries
    if (this.loopStartMs !== null && this.loopEndMs !== null && time >= this.loopEndMs) {
      // Jump back to loop start and continue playing
      this.seekTo(this.loopStartMs);
      if (this.state.isPlaying) {
        this.startTimestamp = performance.now() - (this.loopStartMs / this.state.speedMultiplier);
        this.animFrameId = requestAnimationFrame(this.tick);
      }
      return;
    }

    // Check song end (unless looping) — uses cached value, NO per-frame allocation
    const songEnd = this.cachedSongEndMs;

    if (time >= songEnd && this.notes.length > 0 && !(this.loopStartMs !== null && this.loopEndMs !== null)) {
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
