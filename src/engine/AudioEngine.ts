import * as Tone from 'tone';

/**
 * AudioEngine — plays REAL piano sounds via Tone.Sampler.
 *
 * Uses Salamander Grand Piano samples (Yamaha C5, recorded at 48kHz/24bit).
 * 30 sample points across the full 88-key range; Tone.Sampler pitch-shifts
 * between them automatically so every key sounds authentic.
 *
 * Samples load from the official Tone.js CDN (~5MB).
 * Falls back gracefully while loading.
 */

// Salamander Grand Piano — sampled every minor third across the full range
const PIANO_SAMPLES: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  'D#1': 'Ds1.mp3',
  'F#1': 'Fs1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  'D#2': 'Ds2.mp3',
  'F#2': 'Fs2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  'D#3': 'Ds3.mp3',
  'F#3': 'Fs3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  'D#4': 'Ds4.mp3',
  'F#4': 'Fs4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  'D#5': 'Ds5.mp3',
  'F#5': 'Fs5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  'D#6': 'Ds6.mp3',
  'F#6': 'Fs6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  'D#7': 'Ds7.mp3',
  'F#7': 'Fs7.mp3',
  A7: 'A7.mp3',
  C8: 'C8.mp3',
};

const SAMPLE_BASE_URL = 'https://tonejs.github.io/audio/salamander/';

class AudioEngine {
  private sampler: Tone.Sampler | null = null;
  private initialized = false;
  private samplesLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Initialize audio. Must be called after a user gesture (click/keypress)
   * because browsers block autoplay.
   *
   * Samples load asynchronously (~5MB). The engine is usable immediately
   * but notes won't sound until samples finish loading.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    await Tone.start();

    this.loadingPromise = new Promise<void>((resolve) => {
      this.sampler = new Tone.Sampler({
        urls: PIANO_SAMPLES,
        baseUrl: SAMPLE_BASE_URL,
        release: 1.2,
        onload: () => {
          console.log('[AudioEngine] Salamander Grand Piano samples loaded');
          this.samplesLoaded = true;
          resolve();
        },
        onerror: (err: Error) => {
          console.error('[AudioEngine] Failed to load piano samples:', err);
          resolve(); // Don't block — degrade gracefully
        },
      }).toDestination();

      // Set initial volume
      this.sampler.volume.value = -8;
    });

    this.initialized = true;

    // Wait for samples to load (with a timeout so we don't block forever)
    await Promise.race([
      this.loadingPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 15000)),
    ]);
  }

  /**
   * Ensure audio context is running. Call before playback.
   */
  async ensureRunning(): Promise<void> {
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }
  }

  /**
   * Play a note by MIDI number with real piano sound.
   */
  playNote(midiNote: number, velocity: number = 100, durationSec: number = 0.5): void {
    if (!this.sampler || !this.initialized || !this.samplesLoaded) return;

    if (Tone.context.state !== 'running') {
      Tone.context.resume();
    }

    const noteName = Tone.Frequency(midiNote, 'midi').toNote();
    const vel = Math.max(0.01, Math.min(1, velocity / 127));

    this.sampler.triggerAttackRelease(noteName, durationSec, undefined, vel);
  }

  /**
   * Start a note (note-on) — real piano attack with sustain.
   */
  noteOn(midiNote: number, velocity: number = 100): void {
    if (!this.sampler || !this.initialized || !this.samplesLoaded) return;

    if (Tone.context.state !== 'running') {
      Tone.context.resume();
    }

    const noteName = Tone.Frequency(midiNote, 'midi').toNote();
    const vel = Math.max(0.01, Math.min(1, velocity / 127));

    this.sampler.triggerAttack(noteName, undefined, vel);
  }

  /**
   * Stop a note (note-off) — natural piano release.
   */
  noteOff(midiNote: number): void {
    if (!this.sampler || !this.initialized || !this.samplesLoaded) return;

    const noteName = Tone.Frequency(midiNote, 'midi').toNote();
    this.sampler.triggerRelease(noteName);
  }

  /**
   * Stop all currently playing notes.
   */
  stopAll(): void {
    if (!this.sampler) return;
    this.sampler.releaseAll();
  }

  /**
   * Set master volume (-60 to 0 dB).
   */
  setVolume(db: number): void {
    if (!this.sampler) return;
    this.sampler.volume.value = db;
  }

  /**
   * True once init() has been called (samples may still be loading).
   */
  isReady(): boolean {
    return this.initialized && this.samplesLoaded;
  }

  /**
   * True if samples are still downloading.
   */
  isLoading(): boolean {
    return this.initialized && !this.samplesLoaded;
  }

  /**
   * Wait for samples to finish loading.
   */
  async waitForLoad(): Promise<void> {
    if (this.loadingPromise) {
      await this.loadingPromise;
    }
  }

  dispose(): void {
    this.sampler?.dispose();
    this.sampler = null;
    this.initialized = false;
    this.samplesLoaded = false;
    this.loadingPromise = null;
  }
}

// Singleton
export const audioEngine = new AudioEngine();
export default audioEngine;
