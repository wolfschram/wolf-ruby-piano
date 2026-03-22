import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Song, NoteEvent, PlaybackMode, PlaybackState } from '../types';
import { Piano } from '../components/Piano';
import { FallingNotes } from '../components/FallingNotes';
import { SpeedControl } from '../components/SpeedControl';
import { LoopControl } from '../components/LoopControl';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { SongBrowser } from '../components/SongBrowser';
import { PlaybackEngine } from '../engine/PlaybackEngine';
import { ScoreEngine } from '../engine/ScoreEngine';
import audioEngine from '../engine/AudioEngine';
import midiInput from '../midi/MidiInput';
import { useMcpBridge } from '../hooks/useMcpBridge';

interface WolfModeProps {
  songs: Song[];
  onImportSong: (song: Song) => void;
  onBack: () => void;
  onSwitchMode?: () => void;
}

export const WolfMode: React.FC<WolfModeProps> = ({ songs, onImportSong, onBack, onSwitchMode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [showLibrary, setShowLibrary] = useState(true);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false, currentTimeMs: 0, speedMultiplier: 1.0,
    mode: 'listen', handFilter: 'both',
  });
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [activeHand, setActiveHand] = useState<Map<number, 'left' | 'right'>>(new Map());
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDeviceName, setMidiDeviceName] = useState('');
  const [waitingIndex, setWaitingIndex] = useState<number | undefined>();
  const [hitNotes, setHitNotes] = useState<Set<number>>(new Set());
  const [samplesReady, setSamplesReady] = useState(false);

  const playbackRef = useRef(new PlaybackEngine());
  const scoreRef = useRef(new ScoreEngine());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 500 });

  // MCP Bridge — push state to Claude
  const handleMcpCommand = useCallback((action: string, params: Record<string, unknown>) => {
    const pb = playbackRef.current;
    if (action === 'play') pb.play();
    else if (action === 'pause') pb.pause();
    else if (action === 'stop') pb.stop();
    else if (action === 'seek' && typeof params.timeMs === 'number') pb.seekTo(params.timeMs);
    else if (action === 'setSpeed' && typeof params.speed === 'number') pb.setSpeed(params.speed);
  }, []);

  const { reportNoteOn, reportNoteOff } = useMcpBridge({
    mode: 'wolf',
    currentSong,
    playbackState,
    midiConnected,
    midiDeviceName,
    songList: songs,
    onCommand: handleMcpCommand,
  });

  // Compute song duration for timeline scrubber
  const songDurationMs = useMemo(() => {
    if (!currentSong || currentSong.notes.length === 0) return 0;
    return Math.max(...currentSong.notes.map(n => n.startTime + n.duration));
  }, [currentSong]);

  // Resize handler
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(rect.height - 200, 300),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [showLibrary]);

  // Init audio + MIDI
  useEffect(() => {
    const initAll = async () => {
      await audioEngine.init();
      // Wait for real piano samples to finish loading
      await audioEngine.waitForLoad();
      setSamplesReady(audioEngine.isReady());
      console.log('[WolfMode] Piano samples ready:', audioEngine.isReady());
      const midiOk = await midiInput.init();
      if (midiOk) {
        setMidiConnected(midiInput.connected);
        setMidiDeviceName(midiInput.deviceInfo?.name ?? '');
      }
    };
    initAll();

    // MIDI transport keys
    const TRANSPORT_PLAY_PAUSE = 21;   // A0 — leftmost white key
    const TRANSPORT_STOP_REWIND = 23;  // B0 — second white key from left
    const TRANSPORT_STEP_BACK = 108;   // C8 — rightmost white key
    const TRANSPORT_PLAY_FROM_HERE = 107; // B7 — second white key from right

    midiInput.setCallbacks({
      onNoteOn: (note, velocity) => {
        // Intercept transport keys — don't play sound
        if (note === TRANSPORT_PLAY_PAUSE) {
          audioEngine.ensureRunning();
          const pb = playbackRef.current;
          if (pb.getState().isPlaying) pb.pause(); else pb.play();
          return;
        }
        if (note === TRANSPORT_STOP_REWIND) {
          playbackRef.current.stop();
          // Visual reset — force UI back to square one
          setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: 0 }));
          setActiveNotes(new Set());
          setHitNotes(new Set());
          setWaitingIndex(undefined);
          return;
        }
        if (note === TRANSPORT_STEP_BACK) {
          // Step back one note — each press goes back one note
          const pb = playbackRef.current;
          const newTime = pb.stepBackOneNote();
          if (newTime >= 0) {
            setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: newTime }));
            setActiveNotes(new Set());
          }
          return;
        }
        if (note === TRANSPORT_PLAY_FROM_HERE) {
          // Play from current stepped-back position
          const pb = playbackRef.current;
          if (!pb.getState().isPlaying) {
            pb.play();
          }
          return;
        }

        // Only play through computer speakers in listen mode
        // In practice/perform, the piano's own speakers handle the sound
        const currentMode = playbackRef.current.getState().mode;
        if (currentMode === 'listen') {
          audioEngine.noteOn(note, velocity);
        }
        reportNoteOn(note, velocity);
        setActiveNotes(prev => new Set([...prev, note]));

        // Forward to playback engine
        const result = playbackRef.current.onUserInput(note);
        if (result.matched) {
          scoreRef.current.recordPracticeHit(result.noteIndex);
          setHitNotes(prev => new Set([...prev, result.noteIndex]));
        }
      },
      onNoteOff: (note) => {
        // Skip transport keys
        if (note === TRANSPORT_PLAY_PAUSE || note === TRANSPORT_STOP_REWIND ||
            note === TRANSPORT_STEP_BACK || note === TRANSPORT_PLAY_FROM_HERE) return;

        const currentMode = playbackRef.current.getState().mode;
        if (currentMode === 'listen') {
          audioEngine.noteOff(note);
        }
        reportNoteOff(note);
        setActiveNotes(prev => {
          const next = new Set(prev);
          next.delete(note);
          return next;
        });
      },
      onConnectionChange: (connected, device) => {
        setMidiConnected(connected);
        setMidiDeviceName(device?.name ?? '');
      },
    });

    return () => {
      playbackRef.current.dispose();
      midiInput.dispose();
    };
  }, []);

  // Playback callbacks
  useEffect(() => {
    const pb = playbackRef.current;
    pb.setCallbacks({
      onUpdate: (state, notes) => {
        setPlaybackState({ ...state });
        const noteSet = new Set(notes.map(n => n.pitch));
        const handMap = new Map(notes.map(n => [n.pitch, n.hand]));
        setActiveNotes(noteSet);
        setActiveHand(handMap);
      },
      onNoteHit: (note, idx) => {
        setHitNotes(prev => new Set([...prev, idx]));
      },
      onWaitForInput: (note, idx) => {
        setWaitingIndex(idx);
      },
      onSongEnd: () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
      },
    });
  }, []);

  const selectSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setShowLibrary(false);
    setHitNotes(new Set());
    setWaitingIndex(undefined);

    const pb = playbackRef.current;
    pb.loadNotes(song.notes);
    pb.setSpeed(1.0);
    pb.setMode('listen');

    scoreRef.current.reset(song.notes.length);
  }, []);

  const togglePlay = useCallback(async () => {
    await audioEngine.init();
    const pb = playbackRef.current;
    if (pb.getState().isPlaying) {
      pb.pause();
    } else {
      pb.play();
    }
  }, []);

  const setMode = useCallback((mode: PlaybackMode) => {
    playbackRef.current.setMode(mode);
    playbackRef.current.reset();
    setHitNotes(new Set());
    setWaitingIndex(undefined);
    scoreRef.current.reset(currentSong?.notes.length ?? 0);
    setPlaybackState(prev => ({ ...prev, mode }));
  }, [currentSong]);

  // Mouse/touch: use noteOn/noteOff for proper sustain
  // Mouse/touch on-screen piano — same audio rules as MIDI
  const handleKeyPress = useCallback((midiNote: number) => {
    const currentMode = playbackRef.current.getState().mode;
    if (currentMode === 'listen') {
      audioEngine.noteOn(midiNote, 100);
    }
    setActiveNotes(prev => new Set([...prev, midiNote]));

    const result = playbackRef.current.onUserInput(midiNote);
    if (result.matched) {
      scoreRef.current.recordPracticeHit(result.noteIndex);
      setHitNotes(prev => new Set([...prev, result.noteIndex]));
    }
  }, []);

  const handleKeyRelease = useCallback((midiNote: number) => {
    const currentMode = playbackRef.current.getState().mode;
    if (currentMode === 'listen') {
      audioEngine.noteOff(midiNote);
    }
    setActiveNotes(prev => {
      const next = new Set(prev);
      next.delete(midiNote);
      return next;
    });
  }, []);

  // Timeline scrubber handler
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeMs = parseFloat(e.target.value);
    playbackRef.current.seekTo(timeMs);
    setPlaybackState(prev => ({ ...prev, currentTimeMs: timeMs }));
  }, []);

  // Song library view
  if (showLibrary) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#0A0A12',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar — draggable, padded for macOS traffic lights */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px 16px 80px',
          borderBottom: '1px solid #1A1A2E',
          WebkitAppRegion: 'drag',
        }}>
          <button onClick={onBack} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13,
            WebkitAppRegion: 'no-drag',
          }}>
            ← Back
          </button>

          {/* Mode toggle */}
          {onSwitchMode && (
            <div style={{
              display: 'flex', borderRadius: 8, overflow: 'hidden',
              border: '1px solid #1A1A2E',
              WebkitAppRegion: 'no-drag',
            }}>
              <div style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 700,
                backgroundColor: '#CC8833', color: '#FFF',
              }}>
                Wolf
              </div>
              <button onClick={onSwitchMode} style={{
                padding: '6px 14px', fontSize: 12, fontWeight: 400, border: 'none',
                backgroundColor: '#1A1A2E', color: '#666', cursor: 'pointer',
              }}>
                Ruby
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: midiConnected ? '#5DCAA5' : '#CC4444',
            }} />
            <span style={{ fontSize: 12, color: '#666' }}>
              {midiConnected ? midiDeviceName : 'No keyboard'}
            </span>
            {!samplesReady && (
              <span style={{ fontSize: 12, color: '#FFAA33', marginLeft: 12 }}>
                Loading piano samples...
              </span>
            )}
          </div>
        </div>
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <SongBrowser
            songs={songs}
            onSelectSong={selectSong}
            onImportSong={onImportSong}
            mode="wolf"
          />
        </div>
      </div>
    );
  }

  // Playing view
  return (
    <div ref={containerRef} style={{
      height: '100vh',
      backgroundColor: '#0A0A12',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top HUD — draggable, padded left for macOS traffic lights */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 16px 8px 80px',
        borderBottom: '1px solid #1A1A2E',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      }}>
        {/* Left: song info + back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' as any }}>
          <button onClick={() => { playbackRef.current.stop(); setShowLibrary(true); }}
            style={{
              padding: '4px 10px', borderRadius: 4, border: 'none',
              backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 12,
            }}>
            ← Songs
          </button>
          <div>
            <span style={{ color: '#EEE', fontWeight: 600, fontSize: 14 }}>
              {currentSong?.title}
            </span>
            <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>
              {currentSong?.artist}
            </span>
          </div>
        </div>

        {/* Center: mode toggle + playback mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, WebkitAppRegion: 'no-drag' as any }}>
          {/* Wolf/Ruby toggle */}
          {onSwitchMode && (
            <div style={{
              display: 'flex', borderRadius: 8, overflow: 'hidden',
              border: '1px solid #1A1A2E',
            }}>
              <div style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 700,
                backgroundColor: '#CC8833', color: '#FFF',
              }}>
                Wolf
              </div>
              <button onClick={onSwitchMode} style={{
                padding: '4px 12px', fontSize: 11, fontWeight: 400, border: 'none',
                backgroundColor: '#1A1A2E', color: '#666', cursor: 'pointer',
              }}>
                Ruby
              </button>
            </div>
          )}

          {/* Playback mode selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['listen', 'practice', 'perform'] as PlaybackMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: '4px 12px', borderRadius: 4, border: 'none',
                  fontSize: 12, fontWeight: playbackState.mode === m ? 700 : 400,
                  cursor: 'pointer', textTransform: 'capitalize',
                  backgroundColor: playbackState.mode === m ? '#CC8833' : '#1A1A2E',
                  color: playbackState.mode === m ? '#FFF' : '#888',
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Right: MIDI status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            backgroundColor: midiConnected ? '#5DCAA5' : '#CC4444',
          }} />
          <span style={{ fontSize: 11, color: '#555' }}>
            {midiConnected ? midiDeviceName : 'No keyboard'}
          </span>
        </div>
      </div>

      {/* Falling Notes Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <FallingNotes
          notes={currentSong?.notes ?? []}
          currentTimeMs={playbackState.currentTimeMs}
          speedMultiplier={playbackState.speedMultiplier}
          mode="wolf"
          handFilter={playbackState.handFilter}
          width={dimensions.width}
          height={dimensions.height}
          waitingNoteIndex={waitingIndex}
          hitNotes={hitNotes}
        />

        {/* Waiting indicator */}
        {playbackRef.current.isWaiting() && (
          <div style={{
            position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)',
            padding: '8px 20px', borderRadius: 8, backgroundColor: '#CC883380',
            color: '#FFF', fontSize: 14, fontWeight: 600,
          }}>
            Your turn — play the note!
          </div>
        )}
      </div>

      {/* Piano Keyboard */}
      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        <Piano
          startNote={36}
          endNote={96}
          activeNotes={activeNotes}
          activeHand={activeHand}
          mode="wolf"
          onKeyPress={handleKeyPress}
          onKeyRelease={handleKeyRelease}
          width={dimensions.width}
          height={100}
        />
      </div>

      {/* Bottom Bar — timeline + controls in one row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderTop: '1px solid #1A1A2E',
        flexShrink: 0,
        backgroundColor: '#0A0A12',
        gap: 8,
      }}>
        {/* Play/Pause + Stop */}
        <button
          onClick={togglePlay}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            backgroundColor: '#CC8833', color: '#FFF', fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
          {playbackState.isPlaying ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => { playbackRef.current.stop(); setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: 0 })); setActiveNotes(new Set()); setHitNotes(new Set()); setWaitingIndex(undefined); }}
          style={{
            width: 24, height: 24, borderRadius: '50%', border: 'none',
            backgroundColor: '#1A1A2E', color: '#888', fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
          ⏹
        </button>

        {/* Timeline scrubber */}
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
          {formatTime(playbackState.currentTimeMs)}
        </span>
        {songDurationMs > 0 && (
          <input
            type="range"
            min={0}
            max={songDurationMs}
            value={playbackState.currentTimeMs}
            onChange={handleSeek}
            style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: '#CC8833', minWidth: 60 }}
          />
        )}
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
          {formatTime(songDurationMs)}
        </span>

        {/* Speed */}
        <SpeedControl
          speed={playbackState.speedMultiplier}
          onChange={(s) => playbackRef.current.setSpeed(s)}
          mode="wolf"
        />

        {/* Hand filter */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {(['both', 'left', 'right'] as const).map(h => (
            <button
              key={h}
              onClick={() => {
                playbackRef.current.setHandFilter(h);
                setPlaybackState(prev => ({ ...prev, handFilter: h }));
              }}
              style={{
                padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 10,
                fontWeight: playbackState.handFilter === h ? 700 : 400,
                cursor: 'pointer', textTransform: 'capitalize',
                backgroundColor: playbackState.handFilter === h
                  ? (h === 'left' ? '#3366BB' : h === 'right' ? '#CC8833' : '#555')
                  : '#1A1A2E',
                color: playbackState.handFilter === h ? '#FFF' : '#666',
              }}>
              {h === 'both' ? 'Both' : h === 'left' ? 'L' : 'R'}
            </button>
          ))}
        </div>

        {/* Loop */}
        <LoopControl
          totalBars={Math.ceil((currentSong?.durationMs ?? 0) / 2000)}
          loopStart={playbackState.loopStart}
          loopEnd={playbackState.loopEnd}
          onLoopChange={(s, e) => playbackRef.current.setLoop(s, e)}
          mode="wolf"
        />

        {playbackState.mode === 'perform' && (
          <ScoreDisplay score={scoreRef.current.getState()} mode="wolf" />
        )}
      </div>
    </div>
  );
};

/** Format milliseconds as m:ss */
function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default WolfMode;
