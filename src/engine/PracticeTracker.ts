/**
 * PracticeTracker — spaced repetition and mastery tracking for Wolf.
 *
 * Tracks which songs and sections have been practiced, when, and how well.
 * Uses a simplified spaced repetition algorithm to suggest what to review.
 *
 * Data persists via Electron IPC (saved to userData/practice-data.json).
 */

export interface SongPracticeData {
  songId: string;
  totalSessions: number;
  totalPracticeMs: number;
  lastPracticedAt: number;    // timestamp
  bestAccuracy: number;       // 0-100
  sectionMastery: SectionMastery[];
}

export interface SectionMastery {
  startNoteIndex: number;
  endNoteIndex: number;
  level: 'untouched' | 'learning' | 'familiar' | 'mastered';
  attempts: number;
  lastAccuracy: number;
  lastPracticedAt: number;
}

export interface PracticeSessionLog {
  songId: string;
  startedAt: number;
  endedAt: number;
  mode: string;
  accuracy: number;
  notesPlayed: number;
  totalNotes: number;
}

export interface ReviewSuggestion {
  songId: string;
  songTitle: string;
  reason: string;          // "Due for review", "Needs more practice", etc.
  priority: number;        // 1 = highest
  daysSinceLastPractice: number;
}

class PracticeTracker {
  private data: Map<string, SongPracticeData> = new Map();
  private sessions: PracticeSessionLog[] = [];
  private currentSessionStart: number = 0;

  /**
   * Load practice data from persisted JSON.
   */
  loadFromJSON(json: string): void {
    try {
      const parsed = JSON.parse(json);
      if (parsed.songs) {
        this.data = new Map(Object.entries(parsed.songs));
      }
      if (parsed.sessions) {
        this.sessions = parsed.sessions;
      }
    } catch {
      console.warn('[PracticeTracker] Failed to parse saved data');
    }
  }

  /**
   * Serialize practice data to JSON for persistence.
   */
  toJSON(): string {
    const songs: Record<string, SongPracticeData> = {};
    this.data.forEach((v, k) => { songs[k] = v; });
    return JSON.stringify({
      songs,
      sessions: this.sessions.slice(-100), // Keep last 100 sessions
    });
  }

  /**
   * Start a practice session for a song.
   */
  startSession(songId: string): void {
    this.currentSessionStart = Date.now();

    if (!this.data.has(songId)) {
      this.data.set(songId, {
        songId,
        totalSessions: 0,
        totalPracticeMs: 0,
        lastPracticedAt: Date.now(),
        bestAccuracy: 0,
        sectionMastery: [],
      });
    }
  }

  /**
   * End the current practice session and log results.
   */
  endSession(songId: string, accuracy: number, notesPlayed: number, totalNotes: number, mode: string): void {
    const now = Date.now();
    const duration = now - this.currentSessionStart;

    const songData = this.data.get(songId);
    if (songData) {
      songData.totalSessions++;
      songData.totalPracticeMs += duration;
      songData.lastPracticedAt = now;
      songData.bestAccuracy = Math.max(songData.bestAccuracy, accuracy);
    }

    this.sessions.push({
      songId,
      startedAt: this.currentSessionStart,
      endedAt: now,
      mode,
      accuracy,
      notesPlayed,
      totalNotes,
    });
  }

  /**
   * Update section mastery for a song.
   * Divides the song into sections and tracks mastery per section.
   */
  updateSectionMastery(songId: string, totalNotes: number, hitNotes: Set<number>): void {
    const songData = this.data.get(songId);
    if (!songData) return;

    const sectionSize = 16; // notes per section
    const numSections = Math.ceil(totalNotes / sectionSize);
    const now = Date.now();

    // Initialize sections if needed
    if (songData.sectionMastery.length !== numSections) {
      songData.sectionMastery = Array.from({ length: numSections }, (_, i) => ({
        startNoteIndex: i * sectionSize,
        endNoteIndex: Math.min((i + 1) * sectionSize - 1, totalNotes - 1),
        level: 'untouched' as const,
        attempts: 0,
        lastAccuracy: 0,
        lastPracticedAt: 0,
      }));
    }

    // Update each section based on which notes were hit
    for (const section of songData.sectionMastery) {
      let sectionHits = 0;
      let sectionTotal = section.endNoteIndex - section.startNoteIndex + 1;

      for (let i = section.startNoteIndex; i <= section.endNoteIndex; i++) {
        if (hitNotes.has(i)) sectionHits++;
      }

      if (sectionHits > 0) {
        section.attempts++;
        section.lastAccuracy = Math.round((sectionHits / sectionTotal) * 100);
        section.lastPracticedAt = now;

        // Update mastery level
        if (section.lastAccuracy >= 90 && section.attempts >= 3) {
          section.level = 'mastered';
        } else if (section.lastAccuracy >= 70) {
          section.level = 'familiar';
        } else if (section.attempts > 0) {
          section.level = 'learning';
        }
      }
    }
  }

  /**
   * Get section mastery heatmap data for a song.
   * Returns array of { level, accuracy } for each section.
   */
  getSectionHeatmap(songId: string): Array<{ level: string; accuracy: number }> {
    const songData = this.data.get(songId);
    if (!songData) return [];
    return songData.sectionMastery.map(s => ({
      level: s.level,
      accuracy: s.lastAccuracy,
    }));
  }

  /**
   * Generate "Review Today" suggestions based on spaced repetition.
   * Songs practiced recently need less review; songs not practiced in days
   * need more. Songs with low accuracy need priority.
   */
  getReviewSuggestions(songTitles: Map<string, string>): ReviewSuggestion[] {
    const now = Date.now();
    const DAY_MS = 86400000;
    const suggestions: ReviewSuggestion[] = [];

    this.data.forEach((songData, songId) => {
      const daysSince = Math.floor((now - songData.lastPracticedAt) / DAY_MS);
      const title = songTitles.get(songId) ?? songId;

      // Spaced repetition intervals (simplified Leitner-style)
      let dueForReview = false;
      let reason = '';

      if (songData.bestAccuracy < 50) {
        dueForReview = daysSince >= 1;
        reason = 'Needs more practice (accuracy below 50%)';
      } else if (songData.bestAccuracy < 80) {
        dueForReview = daysSince >= 2;
        reason = 'Due for review — building familiarity';
      } else if (songData.totalSessions < 5) {
        dueForReview = daysSince >= 3;
        reason = 'Due for review — still early';
      } else {
        dueForReview = daysSince >= 7;
        reason = 'Weekly review — maintain mastery';
      }

      if (dueForReview) {
        suggestions.push({
          songId,
          songTitle: title,
          reason,
          priority: songData.bestAccuracy < 50 ? 1 : songData.bestAccuracy < 80 ? 2 : 3,
          daysSinceLastPractice: daysSince,
        });
      }
    });

    return suggestions.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get practice statistics for a song.
   */
  getSongStats(songId: string): SongPracticeData | null {
    return this.data.get(songId) ?? null;
  }

  /**
   * Get total practice time across all songs (in minutes).
   */
  getTotalPracticeMinutes(): number {
    let total = 0;
    this.data.forEach(d => { total += d.totalPracticeMs; });
    return Math.round(total / 60000);
  }

  /**
   * Get practice streak (consecutive days with at least one session).
   */
  getPracticeStreak(): number {
    if (this.sessions.length === 0) return 0;

    const DAY_MS = 86400000;
    const today = Math.floor(Date.now() / DAY_MS);

    // Get unique practice days
    const practiceDays = new Set<number>();
    for (const session of this.sessions) {
      practiceDays.add(Math.floor(session.startedAt / DAY_MS));
    }

    // Count consecutive days ending at today (or yesterday)
    let streak = 0;
    let checkDay = today;

    // Start from today or yesterday
    if (!practiceDays.has(checkDay)) {
      checkDay = today - 1;
    }

    while (practiceDays.has(checkDay)) {
      streak++;
      checkDay--;
    }

    return streak;
  }
}

export const practiceTracker = new PracticeTracker();
export default practiceTracker;
