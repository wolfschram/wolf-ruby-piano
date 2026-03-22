import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Song, NoteEvent, PlaybackState, PlaybackMode } from '../types';
import { Piano } from '../components/Piano';
import { FallingNotes, addSparkle } from '../components/FallingNotes';
import { SpeedControl } from '../components/SpeedControl';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { SongBrowser } from '../components/SongBrowser';
import { PlaybackEngine } from '../engine/PlaybackEngine';
import { ScoreEngine } from '../engine/ScoreEngine';
import audioEngine from '../engine/AudioEngine';
import midiInput from '../midi/MidiInput';
import { useMcpBridge } from '../hooks/useMcpBridge';
import { getAnimalForNote, getAvailableNotes, RUBY_LEVELS } from '../animals/animal-map';
import { midiToNoteName } from '../types';

interface RubyModeProps {
  songs: Song[];
  onImportSong: (song: Song) => void;
  onBack: () => void;
  onSwitchMode?: () => void;
}

export const RubyMode: React.FC<RubyModeProps> = ({ songs, onImportSong, onBack, onSwitchMode }) => {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [rubyLevel, setRubyLevel] = useState(1);
  const [rubyPlayMode, setRubyPlayMode] = useState<'listen' | 'practice'>('listen');
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false, currentTimeMs: 0, speedMultiplier: 0.4,
    mode: 'listen', handFilter: 'both',
  });
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());
  const [waitingIndex, setWaitingIndex] = useState<number | undefined>();
  const [hitNotes, setHitNotes] = useState<Set<number>>(new Set());
  const [samplesReady, setSamplesReady] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [encouragement, setEncouragement] = useState('');

  const playbackRef = useRef(new PlaybackEngine());
  const scoreRef = useRef(new ScoreEngine());
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 400 });

  const ENCOURAGEMENTS = [
    'Amazing! 🌟', 'You rock! 🎸', 'Wow! 🎉', 'Keep going! 💪',
    'So good! ✨', 'Fantastic! 🦄', 'Awesome! 🎵', 'Brilliant! 🌈',
  ];

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
    mode: 'ruby',
    currentSong,
    playbackState,
    midiConnected: false, // Ruby mode doesn't show MIDI status currently
    midiDeviceName: '',
    songList: songs,
    onCommand: handleMcpCommand,
  });

  // Song duration for timeline scrubber
  const songDurationMs = useMemo(() => {
    if (!currentSong || currentSong.notes.length === 0) return 0;
    return Math.max(...currentSong.notes.map(n => n.startTime + n.duration));
  }, [currentSong]);

  // Resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(rect.height - 250, 250),
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [showLibrary, showIntro]);

  // Init
  useEffect(() => {
    const initAll = async () => {
      await audioEngine.init();
      await audioEngine.waitForLoad();
      setSamplesReady(audioEngine.isReady());
      console.log('[RubyMode] Piano samples ready:', audioEngine.isReady());
      await midiInput.init();
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
          setEncouragement('');
          return;
        }
        if (note === TRANSPORT_STEP_BACK) {
          const pb = playbackRef.current;
          const newTime = pb.stepBackOneNote();
          if (newTime >= 0) {
            setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: newTime }));
            setActiveNotes(new Set());
          }
          return;
        }
        if (note === TRANSPORT_PLAY_FROM_HERE) {
          const pb = playbackRef.current;
          if (!pb.getState().isPlaying) {
            pb.play();
          }
          return;
        }

        // Only play through computer speakers in listen mode
        const currentMode = playbackRef.current.getState().mode;
        if (currentMode === 'listen') {
          audioEngine.noteOn(note, velocity);
        }
        reportNoteOn(note, velocity);
        setActiveNotes(prev => new Set([...prev, note]));
        handleNoteInput(note);
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
    });

    return () => {
      playbackRef.current.dispose();
    };
  }, []);

  // Playback callbacks
  useEffect(() => {
    playbackRef.current.setCallbacks({
      onUpdate: (state, notes) => {
        setPlaybackState({ ...state });
        setActiveNotes(new Set(notes.map(n => n.pitch)));
      },
      onNoteHit: (note, idx) => {
        setHitNotes(prev => new Set([...prev, idx]));
        const animal = getAnimalForNote(midiToNoteName(note.pitch));
        if (animal) {
          addSparkle(dimensions.width / 2, dimensions.height - 30, animal.color);
        }
      },
      onWaitForInput: (note, idx) => {
        setWaitingIndex(idx);
      },
      onSongEnd: () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        const score = scoreRef.current.getState();
        if (score.stars >= 3) {
          setEncouragement('You did it! ⭐⭐⭐ Amazing job!');
        } else {
          setEncouragement('Great try! Want to play again?');
        }
      },
    });
  }, [dimensions]);

  const handleNoteInput = useCallback((midiNote: number) => {
    const result = playbackRef.current.onUserInput(midiNote);
    if (result.matched) {
      scoreRef.current.recordPracticeHit(result.noteIndex);
      setHitNotes(prev => new Set([...prev, result.noteIndex]));

      // Random encouragement every 5 correct notes
      const score = scoreRef.current.getState();
      if (score.hitNotes % 5 === 0 && score.hitNotes > 0) {
        const msg = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
        setEncouragement(msg);
        setTimeout(() => setEncouragement(''), 2000);
      }
    }
  }, []);

  // Mouse/touch on-screen piano — same audio rules as MIDI
  const handleKeyPress = useCallback((midiNote: number) => {
    const currentMode = playbackRef.current.getState().mode;
    if (currentMode === 'listen') {
      audioEngine.noteOn(midiNote, 100);
    }
    setActiveNotes(prev => new Set([...prev, midiNote]));
    handleNoteInput(midiNote);
  }, [handleNoteInput]);

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

  const selectSong = useCallback((song: Song) => {
    setCurrentSong(song);
    setShowLibrary(false);
    setShowIntro(false);
    setHitNotes(new Set());
    setWaitingIndex(undefined);
    setEncouragement('');

    const pb = playbackRef.current;
    pb.loadNotes(song.notes);
    pb.setSpeed(0.4); // Slower for kids
    pb.setMode(rubyPlayMode); // listen or practice
    scoreRef.current.reset(song.notes.length);
  }, [rubyPlayMode]);

  const startFirstSong = useCallback(async () => {
    await audioEngine.init();
    const firstSong = songs.find(s => s.category === 'ruby' && s.difficulty === 1);
    if (firstSong) {
      selectSong(firstSong);
      setTimeout(() => playbackRef.current.play(), 500);
    } else if (songs.length > 0) {
      selectSong(songs.filter(s => s.category === 'ruby')[0] ?? songs[0]);
    }
  }, [songs, selectSong]);

  // Timeline scrubber handler
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const timeMs = parseFloat(e.target.value);
    playbackRef.current.seekTo(timeMs);
    setPlaybackState(prev => ({ ...prev, currentTimeMs: timeMs }));
  }, []);

  function togglePlay() {
    const pb = playbackRef.current;
    if (pb.getState().isPlaying) pb.pause();
    else pb.play();
  }

  function switchRubyMode(newMode: 'listen' | 'practice') {
    setRubyPlayMode(newMode);
    const pb = playbackRef.current;
    pb.setMode(newMode);
    pb.stop();
    setHitNotes(new Set());
    setWaitingIndex(undefined);
    setEncouragement('');
    scoreRef.current.reset(currentSong?.notes.length ?? 0);
    setPlaybackState(prev => ({ ...prev, mode: newMode, isPlaying: false, currentTimeMs: 0 }));
  }

  // ======== Mode toggle pill (shared across views) ========
  const ModeToggle = () => onSwitchMode ? (
    <div
      style={{
        display: 'flex', borderRadius: 8, overflow: 'hidden',
        border: '1px solid #1A1A2E',
        WebkitAppRegion: 'no-drag',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button onClick={(e) => { e.stopPropagation(); onSwitchMode(); }} style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 400, border: 'none',
        backgroundColor: '#1A1A2E', color: '#666', cursor: 'pointer',
        WebkitAppRegion: 'no-drag',
      }}>
        Wolf
      </button>
      <div style={{
        padding: '6px 14px', fontSize: 12, fontWeight: 700,
        backgroundColor: '#5DCAA5', color: '#FFF',
      }}>
        Ruby
      </div>
    </div>
  ) : null;

  // ============================================================
  // Intro screen — "The 5-minute magic trick"
  // ============================================================
  if (showIntro) {
    return (
      <div ref={containerRef} style={{
        height: '100vh',
        backgroundColor: '#0A0A12',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}>
        {/* Top bar — draggable, padded for macOS traffic lights */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px 12px 80px',
          WebkitAppRegion: 'drag',
        }}>
          <button onClick={onBack} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13,
            WebkitAppRegion: 'no-drag',
          }}>
            ← Back
          </button>
          <ModeToggle />
          <div style={{ width: 80 }} /> {/* Spacer */}
        </div>

        <h1 style={{
          fontSize: 48, fontWeight: 800,
          background: 'linear-gradient(135deg, #5DCAA5, #F0997B)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          textAlign: 'center', margin: 0,
        }}>
          🎹 Ruby's Piano!
        </h1>

        <p style={{
          fontSize: 20, color: '#888', textAlign: 'center', maxWidth: 400,
          margin: 0, lineHeight: 1.5,
        }}>
          Tap the animals to make music!
        </p>

        {/* Preview the 3 animal keys */}
        <div style={{ display: 'flex', gap: 16, margin: '16px 0' }}>
          {['C', 'D', 'E'].map(note => {
            const animal = getAnimalForNote(note);
            if (!animal) return null;
            return (
              <button
                key={note}
                onClick={async () => {
                  await audioEngine.init();
                  const midiNote = note === 'C' ? 60 : note === 'D' ? 62 : 64;
                  audioEngine.playNote(midiNote, 100, 0.5);
                }}
                style={{
                  width: 100, height: 120, borderRadius: 16,
                  border: 'none', cursor: 'pointer',
                  backgroundColor: animal.color,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 40, transition: 'transform 0.1s ease',
                  boxShadow: `0 4px 16px ${animal.color}40`,
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <span>{animal.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#FFF' }}>
                  {animal.animal.charAt(0).toUpperCase() + animal.animal.slice(1)}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={startFirstSong}
          style={{
            padding: '16px 40px', borderRadius: 16,
            border: 'none', fontSize: 22, fontWeight: 700,
            cursor: 'pointer',
            backgroundColor: '#F0997B', color: '#FFF',
            boxShadow: '0 4px 16px rgba(240,153,123,0.4)',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          Ready to play a song? 🎵
        </button>

        <button
          onClick={() => { setShowIntro(false); setShowLibrary(true); }}
          style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            fontSize: 14, cursor: 'pointer',
            backgroundColor: 'transparent', color: '#666',
          }}
        >
          Browse all songs →
        </button>
      </div>
    );
  }

  // ============================================================
  // Song library
  // ============================================================
  if (showLibrary) {
    return (
      <div style={{
        height: '100vh',
        backgroundColor: '#0A0A12',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px 16px 80px', borderBottom: '1px solid #1A1A2E',
          WebkitAppRegion: 'drag',
        }}>
          <button onClick={onBack} style={{
            padding: '8px 16px', borderRadius: 6, border: 'none',
            backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13,
            WebkitAppRegion: 'no-drag',
          }}>
            ← Back
          </button>

          <ModeToggle />

          <div style={{ display: 'flex', gap: 6, WebkitAppRegion: 'no-drag' as any }}>
            {RUBY_LEVELS.map(l => (
              <button
                key={l.level}
                onClick={() => setRubyLevel(l.level)}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none',
                  fontSize: 12, fontWeight: rubyLevel === l.level ? 700 : 400,
                  cursor: 'pointer',
                  backgroundColor: rubyLevel === l.level ? '#5DCAA5' : '#1A1A2E',
                  color: rubyLevel === l.level ? '#FFF' : '#666',
                }}>
                Level {l.level}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          <SongBrowser
            songs={songs}
            onSelectSong={(song) => { selectSong(song); setTimeout(() => playbackRef.current.play(), 500); }}
            onImportSong={onImportSong}
            mode="ruby"
          />
        </div>
      </div>
    );
  }

  // ============================================================
  // Playing view
  // ============================================================
  return (
    <div ref={containerRef} style={{
      height: '100vh',
      backgroundColor: '#0A0A12',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Top Bar — draggable, padded for macOS traffic lights */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 16px 8px 80px', borderBottom: '1px solid #1A1A2E', flexShrink: 0,
        WebkitAppRegion: 'drag',
      }}>
        <button onClick={() => { playbackRef.current.stop(); setShowLibrary(true); }}
          style={{
            padding: '6px 12px', borderRadius: 6, border: 'none',
            backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 12,
            WebkitAppRegion: 'no-drag',
          }}>
          ← Songs
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' as any }}>
          <ModeToggle />
          {/* Listen / Play Along toggle */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1A1A2E' }}>
            <button onClick={() => switchRubyMode('listen')} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: rubyPlayMode === 'listen' ? 700 : 400,
              border: 'none', cursor: 'pointer',
              backgroundColor: rubyPlayMode === 'listen' ? '#5DCAA5' : '#1A1A2E',
              color: rubyPlayMode === 'listen' ? '#FFF' : '#666',
            }}>
              Listen
            </button>
            <button onClick={() => switchRubyMode('practice')} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: rubyPlayMode === 'practice' ? 700 : 400,
              border: 'none', cursor: 'pointer',
              backgroundColor: rubyPlayMode === 'practice' ? '#F0997B' : '#1A1A2E',
              color: rubyPlayMode === 'practice' ? '#FFF' : '#666',
            }}>
              Play Along
            </button>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#EEE' }}>
            🎵 {currentSong?.title ?? 'Choose a song'}
          </span>
        </div>

        <div style={{ WebkitAppRegion: 'no-drag' as any }}>
          <ScoreDisplay score={scoreRef.current.getState()} mode="ruby" />
        </div>
      </div>

      {/* Encouragement banner */}
      {encouragement && (
        <div style={{
          textAlign: 'center', padding: '8px 0',
          fontSize: 20, fontWeight: 700, color: '#5DCAA5',
        }}>
          {encouragement}
        </div>
      )}

      {/* Falling Notes */}
      <div style={{ flex: 1, position: 'relative' }}>
        <FallingNotes
          notes={currentSong?.notes ?? []}
          currentTimeMs={playbackState.currentTimeMs}
          speedMultiplier={playbackState.speedMultiplier}
          mode="ruby"
          rubyLevel={rubyLevel}
          handFilter="both"
          width={dimensions.width}
          height={dimensions.height}
          waitingNoteIndex={waitingIndex}
          hitNotes={hitNotes}
        />
      </div>

      {/* Piano (real keys with animal overlays) */}
      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        <Piano
          startNote={36}
          endNote={96}
          activeNotes={activeNotes}
          mode="ruby"
          rubyLevel={rubyLevel}
          onKeyPress={handleKeyPress}
          onKeyRelease={handleKeyRelease}
          width={dimensions.width}
          height={100}
        />
      </div>

      {/* Bottom Bar — play + timeline + speed in one row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '5px 12px', gap: 8, borderTop: '1px solid #1A1A2E', flexShrink: 0,
        backgroundColor: '#0A0A12',
      }}>
        <button
          onClick={async () => { await audioEngine.init(); togglePlay(); }}
          style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none',
            backgroundColor: '#5DCAA5', color: '#FFF', fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
          {playbackState.isPlaying ? '⏸' : '▶'}
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
            style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: '#5DCAA5', minWidth: 60 }}
          />
        )}
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>
          {formatTime(songDurationMs)}
        </span>

        <SpeedControl
          speed={playbackState.speedMultiplier}
          onChange={(s) => playbackRef.current.setSpeed(s)}
          mode="ruby"
        />
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

export default RubyMode;
