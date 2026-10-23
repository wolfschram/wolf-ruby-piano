/**
 * usePianoPlayback — shared hook for MIDI init, transport keys,
 * playback callbacks, and note handling. Used by both WolfMode and RubyMode.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Song, NoteEvent, PlaybackState, PlaybackMode } from '../types';
import { PlaybackEngine } from '../engine/PlaybackEngine';
import { ScoreEngine } from '../engine/ScoreEngine';
import audioEngine from '../engine/AudioEngine';
import midiInput from '../midi/MidiInput';
import { useMcpBridge } from './useMcpBridge';

// MIDI transport key assignments (piano extremes — never used musically)
const TRANSPORT_PLAY_PAUSE = 21;      // A0 — leftmost white key
const TRANSPORT_BACKWARD_CHAIN = 22;  // A#0/Bb0 — first black key
const TRANSPORT_STOP_REWIND = 23;     // B0 — second white key
const TRANSPORT_PLAY_FROM_HERE = 107; // B7 — second from right
const TRANSPORT_STEP_BACK = 108;      // C8 — rightmost white key

const TRANSPORT_KEYS = new Set([
  TRANSPORT_PLAY_PAUSE, TRANSPORT_BACKWARD_CHAIN, TRANSPORT_STOP_REWIND,
  TRANSPORT_PLAY_FROM_HERE, TRANSPORT_STEP_BACK,
]);

export interface UsePianoPlaybackOptions {
  mode: 'wolf' | 'ruby';
  songs: Song[];
  /** Called when a note is matched in playback (for mode-specific scoring) */
  onNoteMatched?: (noteIndex: number, velocity: number, playbackMode: PlaybackMode) => void;
  /** Called when playback hits a note (listen mode auto-play, or user hit) */
  onNoteHit?: (note: NoteEvent, noteIndex: number) => void;
  /** Called when a note is missed in perform mode */
  onNoteMiss?: (note: NoteEvent, noteIndex: number) => void;
  /** Called when waiting for user input in practice mode */
  onWaitForInput?: (note: NoteEvent, noteIndex: number) => void;
  /** Called when playback ends */
  onSongEnd?: () => void;
  /** Called when backward chain state changes */
  onBackwardChainChange?: (active: boolean) => void;
  /** Extra reset logic when stop/rewind transport is pressed */
  onTransportReset?: () => void;
  /** Initial playback speed (default: 1.0) */
  initialSpeed?: number;
  /** Initial playback mode (default: 'listen') */
  initialMode?: PlaybackMode;
  /** Whether to enable backward chain transport key (Wolf only) */
  enableBackwardChain?: boolean;
  /** Whether to handle sustain pedal CC64 */
  enableSustainPedal?: boolean;
}

export interface UsePianoPlaybackReturn {
  // Refs
  playbackRef: React.MutableRefObject<PlaybackEngine>;
  scoreRef: React.MutableRefObject<ScoreEngine>;
  containerRef: React.RefObject<HTMLDivElement | null>;

  // State
  playbackState: PlaybackState;
  setPlaybackState: React.Dispatch<React.SetStateAction<PlaybackState>>;
  activeNotes: Set<number>;
  activeHand: Map<number, 'left' | 'right'>;
  midiConnected: boolean;
  midiDeviceName: string;
  waitingIndex: number | undefined;
  hitNotes: Set<number>;
  userNoteVelocities: Map<number, number>;
  samplesReady: boolean;
  sustainActive: boolean;
  dimensions: { width: number; height: number };
  songDurationMs: number;
  currentSong: Song | null;
  showLibrary: boolean;

  // Actions
  selectSong: (song: Song) => void;
  togglePlay: () => Promise<void>;
  setMode: (mode: PlaybackMode) => void;
  handleKeyPress: (midiNote: number) => void;
  handleKeyRelease: (midiNote: number) => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setShowLibrary: React.Dispatch<React.SetStateAction<boolean>>;
  setHitNotes: React.Dispatch<React.SetStateAction<Set<number>>>;
  setWaitingIndex: React.Dispatch<React.SetStateAction<number | undefined>>;
  setActiveNotes: React.Dispatch<React.SetStateAction<Set<number>>>;
  reportNoteOn: (note: number, velocity: number) => void;
  reportNoteOff: (note: number) => void;
}

export function usePianoPlayback(opts: UsePianoPlaybackOptions): UsePianoPlaybackReturn {
  const {
    mode, songs, onNoteMatched, onNoteHit, onNoteMiss, onWaitForInput,
    onSongEnd, onBackwardChainChange, onTransportReset,
    initialSpeed = 1.0, initialMode = 'listen',
    enableBackwardChain = false, enableSustainPedal = false,
  } = opts;

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false, currentTimeMs: 0, speedMultiplier: initialSpeed,
    mode: initialMode, handFilter: 'both',
  });
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [activeHand, setActiveHand] = useState<Map<number, 'left' | 'right'>>(new Map());
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDeviceName, setMidiDeviceName] = useState('');
  const [waitingIndex, setWaitingIndex] = useState<number | undefined>();
  const [hitNotes, setHitNotes] = useState<Set<number>>(new Set());
  const [userNoteVelocities, setUserNoteVelocities] = useState<Map<number, number>>(new Map());
  const [samplesReady, setSamplesReady] = useState(false);
  const [sustainActive, setSustainActive] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 500 });

  const playbackRef = useRef(new PlaybackEngine());
  const scoreRef = useRef(new ScoreEngine());
  const containerRef = useRef<HTMLDivElement>(null);

  // MCP Bridge
  const handleMcpCommand = useCallback((action: string, params: Record<string, unknown>) => {
    const pb = playbackRef.current;
    if (action === 'play') pb.play();
    else if (action === 'pause') pb.pause();
    else if (action === 'stop') pb.stop();
    else if (action === 'seek' && typeof params.timeMs === 'number') pb.seekTo(params.timeMs);
    else if (action === 'setSpeed' && typeof params.speed === 'number') pb.setSpeed(params.speed);
  }, []);

  const { reportNoteOn, reportNoteOff } = useMcpBridge({
    mode, currentSong, playbackState, midiConnected, midiDeviceName,
    songList: songs, onCommand: handleMcpCommand,
  });

  // Song duration
  const songDurationMs = useMemo(() => {
    if (!currentSong || currentSong.notes.length === 0) return 0;
    let max = 0;
    for (const n of currentSong.notes) {
      const end = n.startTime + n.duration;
      if (end > max) max = end;
    }
    return max;
  }, [currentSong]);

  // Resize
  useEffect(() => {
    const chromeHeight = mode === 'ruby' ? 250 : 200;
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(rect.height - chromeHeight, 200),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [showLibrary, mode]);

  // Init audio + MIDI
  useEffect(() => {
    const initAll = async () => {
      await audioEngine.init();
      await audioEngine.waitForLoad();
      setSamplesReady(audioEngine.isReady());
      const midiOk = await midiInput.init();
      if (midiOk) {
        setMidiConnected(midiInput.connected);
        setMidiDeviceName(midiInput.deviceInfo?.name ?? '');
      }
    };
    initAll();

    midiInput.setCallbacks({
      onNoteOn: (note, velocity) => {
        // Transport: play/pause
        if (note === TRANSPORT_PLAY_PAUSE) {
          audioEngine.ensureRunning();
          const pb = playbackRef.current;
          if (pb.getState().isPlaying) pb.pause(); else pb.play();
          return;
        }
        // Transport: stop & rewind
        if (note === TRANSPORT_STOP_REWIND) {
          playbackRef.current.stop();
          setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: 0 }));
          setActiveNotes(new Set());
          setHitNotes(new Set());
          setWaitingIndex(undefined);
          onTransportReset?.();
          return;
        }
        // Transport: step back
        if (note === TRANSPORT_STEP_BACK) {
          const pb = playbackRef.current;
          const newTime = pb.stepBackOneNote();
          if (newTime >= 0) {
            setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: newTime }));
            setActiveNotes(new Set());
          }
          return;
        }
        // Transport: play from here
        if (note === TRANSPORT_PLAY_FROM_HERE) {
          const pb = playbackRef.current;
          if (!pb.getState().isPlaying) pb.play();
          return;
        }
        // Transport: backward chain (Wolf only)
        if (note === TRANSPORT_BACKWARD_CHAIN && enableBackwardChain) {
          const pb = playbackRef.current;
          const chainState = pb.getBackwardChainState();
          if (chainState.active) {
            pb.stopBackwardChain();
            onBackwardChainChange?.(false);
          } else {
            pb.startBackwardChain(8);
            onBackwardChainChange?.(true);
            if (!pb.getState().isPlaying) pb.play();
          }
          return;
        }

        // Regular note: play sound only in listen mode
        const currentMode = playbackRef.current.getState().mode;
        if (currentMode === 'listen') {
          audioEngine.noteOn(note, velocity);
        }
        reportNoteOn(note, velocity);
        setActiveNotes(prev => { const s = new Set(prev); s.add(note); return s; });

        // Forward to playback engine
        const result = playbackRef.current.onUserInput(note);
        if (result.matched) {
          setHitNotes(prev => { const s = new Set(prev); s.add(result.noteIndex); return s; });
          setUserNoteVelocities(prev => new Map([...prev, [result.noteIndex, velocity]]));
          onNoteMatched?.(result.noteIndex, velocity, currentMode);
        }
      },
      onNoteOff: (note) => {
        if (TRANSPORT_KEYS.has(note)) return;
        const currentMode = playbackRef.current.getState().mode;
        if (currentMode === 'listen') {
          audioEngine.noteOff(note);
        }
        reportNoteOff(note);
        setActiveNotes(prev => { const s = new Set(prev); s.delete(note); return s; });
      },
      onControlChange: (cc, value) => {
        if (cc === 64 && enableSustainPedal) {
          const pedalDown = value >= 64;
          audioEngine.setSustain(pedalDown);
          setSustainActive(pedalDown);
        }
      },
      onConnectionChange: (connected, device) => {
        setMidiConnected(connected);
        setMidiDeviceName(device?.name ?? '');
      },
    });

    return () => { playbackRef.current.dispose(); };
  }, [enableBackwardChain, enableSustainPedal]);

  // Playback callbacks
  useEffect(() => {
    playbackRef.current.setCallbacks({
      onUpdate: (state, notes) => {
        setPlaybackState({ ...state });
        setActiveNotes(new Set(notes.map(n => n.pitch)));
        setActiveHand(new Map(notes.map(n => [n.pitch, n.hand])));
      },
      onNoteHit: (note, idx) => {
        setHitNotes(prev => { const s = new Set(prev); s.add(idx); return s; });
        onNoteHit?.(note, idx);
      },
      onNoteMiss: (note, idx) => { onNoteMiss?.(note, idx); },
      onWaitForInput: (note, idx) => {
        setWaitingIndex(idx);
        onWaitForInput?.(note, idx);
      },
      onSongEnd: () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        onSongEnd?.();
      },
    });
  }, [onNoteHit, onNoteMiss, onWaitForInput, onSongEnd]);

  const selectSong = useCallback((song: Song) => {
    try {
      setCurrentSong(song);
      setShowLibrary(false);
      setHitNotes(new Set());
      setUserNoteVelocities(new Map());
      setWaitingIndex(undefined);
      setPlaybackState(prev => ({
        ...prev, isPlaying: false, currentTimeMs: 0,
        speedMultiplier: initialSpeed, mode: initialMode,
      }));
      const pb = playbackRef.current;
      pb.loadNotes(song.notes, song.bpm);
      pb.setSpeed(initialSpeed);
      pb.setMode(initialMode);
      scoreRef.current.reset(song.notes.length);
    } catch (err) {
      console.error(`[${mode}Mode] Failed to load song:`, err);
      setShowLibrary(true);
    }
  }, [initialSpeed, initialMode, mode]);

  const togglePlay = useCallback(async () => {
    await audioEngine.init();
    const pb = playbackRef.current;
    if (pb.getState().isPlaying) pb.pause(); else pb.play();
  }, []);

  const setMode = useCallback((m: PlaybackMode) => {
    playbackRef.current.setMode(m);
    playbackRef.current.reset();
    setHitNotes(new Set());
    setUserNoteVelocities(new Map());
    setWaitingIndex(undefined);
    scoreRef.current.reset(currentSong?.notes.length ?? 0);
    setPlaybackState(prev => ({ ...prev, mode: m }));
  }, [currentSong]);

  const handleKeyPress = useCallback((midiNote: number) => {
    const currentMode = playbackRef.current.getState().mode;
    if (currentMode === 'listen') audioEngine.noteOn(midiNote, 100);
    setActiveNotes(prev => { const s = new Set(prev); s.add(midiNote); return s; });
    const result = playbackRef.current.onUserInput(midiNote);
    if (result.matched) {
      scoreRef.current.recordPracticeHit(result.noteIndex);
      setHitNotes(prev => { const s = new Set(prev); s.add(result.noteIndex); return s; });
      onNoteMatched?.(result.noteIndex, 100, currentMode);
    }
  }, [onNoteMatched]);

  const handleKeyRelease = useCallback((midiNote: number) => {
    const currentMode = playbackRef.current.getState().mode;
    if (currentMode === 'listen') audioEngine.noteOff(midiNote);
    setActiveNotes(prev => { const s = new Set(prev); s.delete(midiNote); return s; });
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeMs = parseFloat(e.target.value);
    playbackRef.current.seekTo(timeMs);
    setPlaybackState(prev => ({ ...prev, currentTimeMs: timeMs }));
  }, []);

  return {
    playbackRef, scoreRef, containerRef,
    playbackState, setPlaybackState,
    activeNotes, activeHand, midiConnected, midiDeviceName,
    waitingIndex, hitNotes, userNoteVelocities, samplesReady, sustainActive,
    dimensions, songDurationMs, currentSong, showLibrary,
    selectSong, togglePlay, setMode, handleKeyPress, handleKeyRelease, handleSeek,
    setShowLibrary, setHitNotes, setWaitingIndex, setActiveNotes,
    reportNoteOn, reportNoteOff,
  };
}
