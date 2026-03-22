import { ScoreState, NoteEvent, HitResult } from '../types';

/**
 * ScoreEngine — tracks accuracy and scoring for both modes.
 *
 * Wolf Mode (perform): tracks timing accuracy, streak, percentage.
 * Ruby Mode: tracks stars (visual reward for a 5-year-old).
 */
export class ScoreEngine {
  private state: ScoreState;
  private hitResults: HitResult[] = [];

  constructor() {
    this.state = this.createEmptyState();
  }

  reset(totalNotes: number = 0): void {
    this.state = this.createEmptyState();
    this.state.totalNotes = totalNotes;
    this.hitResults = [];
  }

  /**
   * Record a note hit. Called by PlaybackEngine when user plays a note.
   */
  recordHit(noteIndex: number, expectedTime: number, actualTime: number): HitResult {
    const offset = Math.abs(actualTime - expectedTime);

    let accuracy: 'perfect' | 'good' | 'miss';
    if (offset <= 50) {
      accuracy = 'perfect';
      this.state.perfectHits++;
    } else if (offset <= 150) {
      accuracy = 'good';
      this.state.goodHits++;
    } else {
      accuracy = 'miss';
      this.state.misses++;
    }

    if (accuracy !== 'miss') {
      this.state.hitNotes++;
      this.state.streak++;
      this.state.maxStreak = Math.max(this.state.maxStreak, this.state.streak);
    } else {
      this.state.streak = 0;
    }

    // Update accuracy percentage
    this.state.accuracy = this.state.totalNotes > 0
      ? Math.round((this.state.hitNotes / this.state.totalNotes) * 100)
      : 0;

    // Stars for Ruby mode (generous scoring)
    this.state.stars = this.calculateStars();

    const result: HitResult = { noteIndex, accuracy, timingOffsetMs: offset };
    this.hitResults.push(result);
    return result;
  }

  /**
   * Record a correct note in practice mode (always counts as perfect).
   */
  recordPracticeHit(noteIndex: number): void {
    this.state.hitNotes++;
    this.state.perfectHits++;
    this.state.streak++;
    this.state.maxStreak = Math.max(this.state.maxStreak, this.state.streak);
    this.state.accuracy = this.state.totalNotes > 0
      ? Math.round((this.state.hitNotes / this.state.totalNotes) * 100)
      : 0;
    this.state.stars = this.calculateStars();
  }

  /**
   * Stars: generous for Ruby (a 5-year-old should feel great).
   */
  private calculateStars(): number {
    const pct = this.state.totalNotes > 0
      ? (this.state.hitNotes / this.state.totalNotes) * 100
      : 0;

    if (pct >= 90) return 5;
    if (pct >= 70) return 4;
    if (pct >= 50) return 3;
    if (pct >= 30) return 2;
    if (pct > 0) return 1;
    return 0;
  }

  getState(): ScoreState {
    return { ...this.state };
  }

  getHitResults(): HitResult[] {
    return [...this.hitResults];
  }

  private createEmptyState(): ScoreState {
    return {
      totalNotes: 0,
      hitNotes: 0,
      perfectHits: 0,
      goodHits: 0,
      misses: 0,
      streak: 0,
      maxStreak: 0,
      accuracy: 0,
      stars: 0,
    };
  }
}

export const scoreEngine = new ScoreEngine();
export default scoreEngine;
