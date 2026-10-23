import React, { useState, useEffect, useCallback } from 'react';
import { Song, PlaybackState } from '../types';
import { Piano } from '../components/Piano';
import { FallingNotes, addSparkle } from '../components/FallingNotes';
import { SpeedControl } from '../components/SpeedControl';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { ExerciseBrowser } from '../components/ExerciseBrowser';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { usePianoPlayback } from '../hooks/usePianoPlayback';
import { formatTime } from '../utils/formatTime';
import audioEngine from '../engine/AudioEngine';
import { getAnimalForNote, RUBY_LEVELS } from '../animals/animal-map';
import { midiToNoteName } from '../types';

interface RubyModeProps {
  songs: Song[];
  onImportSong: (song: Song) => void;
  onBack: () => void;
  onSwitchMode?: () => void;
}

const ENCOURAGEMENTS = [
  'Amazing! 🌟', 'You rock! 🎸', 'Wow! 🎉', 'Keep going! 💪',
  'So good! ✨', 'Fantastic! 🦄', 'Awesome! 🎵', 'Brilliant! 🌈',
];
const CARD_COLORS = ['#2D5A4E', '#4A3B6B', '#5A3B3B', '#3B4A5A', '#4A5A3B', '#3B5A4A', '#5A4A3B', '#3B3B5A'];
const CARD_EMOJIS = ['🐱', '🐶', '🐸', '🦊', '🐻', '🐰', '🐼', '🦁', '🐮', '🐷'];

export const RubyMode: React.FC<RubyModeProps> = ({ songs, onImportSong, onBack, onSwitchMode }) => {
  const [libraryTab, setLibraryTab] = useState<'songs' | 'exercises'>('songs');
  const [rubyLevel, setRubyLevel] = useState(1);
  const [rubyPlayMode, setRubyPlayMode] = useState<'listen' | 'practice'>('practice');
  const [showIntro, setShowIntro] = useState(false);
  const [encouragement, setEncouragement] = useState('');
  const [totalStars, setTotalStars] = useState(0);
  const [completedSongs, setCompletedSongs] = useState<Set<string>>(new Set());
  const [unlockedSongs, setUnlockedSongs] = useState<Set<string>>(new Set());

  const pb = usePianoPlayback({
    mode: 'ruby', songs, initialSpeed: 0.4, initialMode: 'practice',
    enableBackwardChain: false, enableSustainPedal: false,
    onTransportReset: useCallback(() => setEncouragement(''), []),
  });

  // Wire Ruby-specific callbacks via effect (avoids circular ref with pb)
  useEffect(() => {
    pb.playbackRef.current.setCallbacks({
      onUpdate: (state, notes) => {
        pb.setPlaybackState({ ...state });
        pb.setActiveNotes(new Set(notes.map(n => n.pitch)));
      },
      onNoteHit: (note, idx) => {
        pb.setHitNotes(prev => { const s = new Set(prev); s.add(idx); return s; });
        const animal = getAnimalForNote(midiToNoteName(note.pitch));
        if (animal) addSparkle(pb.dimensions.width / 2, pb.dimensions.height - 30, animal.color);
      },
      onWaitForInput: (_note, idx) => { pb.setWaitingIndex(idx); },
      onSongEnd: () => {
        pb.setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        const score = pb.scoreRef.current.getState();
        setEncouragement(score.stars >= 3 ? 'You did it! ⭐⭐⭐ Amazing job!' : 'Great try! Want to play again?');
        if (pb.currentSong) {
          setTotalStars(prev => prev + (score.stars ?? 0));
          setCompletedSongs(prev => {
            const next = new Set([...prev, pb.currentSong!.id]);
            if (score.stars >= 2 && rubyLevel < 4 && next.size >= rubyLevel * 2) {
              setRubyLevel(rubyLevel + 1);
              setEncouragement(`Level ${rubyLevel + 1} unlocked! 🎉`);
            }
            return next;
          });
        }
      },
    });
  }, [pb.dimensions, pb.currentSong, rubyLevel]);

  // Load/save progress
  useEffect(() => {
    (async () => {
      try {
        const json = await window.electronAPI?.loadRubyProgress();
        if (json) {
          const p = JSON.parse(json);
          if (p.level) setRubyLevel(p.level);
          if (p.totalStars) setTotalStars(p.totalStars);
          if (p.completedSongs) setCompletedSongs(new Set(p.completedSongs));
          if (p.unlockedSongs) setUnlockedSongs(new Set(p.unlockedSongs));
        }
      } catch (_e) { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    window.electronAPI?.saveRubyProgress?.(JSON.stringify({
      level: rubyLevel, totalStars,
      completedSongs: Array.from(completedSongs),
      unlockedSongs: Array.from(unlockedSongs),
      timestamp: new Date().toISOString(),
    })).catch(() => {});
  }, [rubyLevel, totalStars, completedSongs, unlockedSongs]);

  const selectSong = useCallback((song: Song) => {
    pb.selectSong(song);
    setShowIntro(false);
    setEncouragement('');
    pb.playbackRef.current.setSpeed(0.4);
    pb.playbackRef.current.setMode(rubyPlayMode);
    pb.setPlaybackState((prev: PlaybackState) => ({ ...prev, speedMultiplier: 0.4, mode: rubyPlayMode }));
  }, [pb.selectSong, rubyPlayMode]);

  const startFirstSong = useCallback(async () => {
    await audioEngine.init();
    const first = songs.find(s => s.category === 'ruby' && s.difficulty === 1);
    if (first) { selectSong(first); setTimeout(() => pb.playbackRef.current.play(), 500); }
    else if (songs.length > 0) selectSong(songs.filter(s => s.category === 'ruby')[0] ?? songs[0]);
  }, [songs, selectSong]);

  function switchRubyMode(newMode: 'listen' | 'practice') {
    setRubyPlayMode(newMode);
    pb.playbackRef.current.setMode(newMode);
    pb.playbackRef.current.stop();
    pb.setHitNotes(new Set());
    pb.setWaitingIndex(undefined);
    setEncouragement('');
    pb.scoreRef.current.reset(pb.currentSong?.notes.length ?? 0);
    pb.setPlaybackState(prev => ({ ...prev, mode: newMode, isPlaying: false, currentTimeMs: 0 }));
  }

  const ModeToggle = () => onSwitchMode ? (
    <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1A1A2E', WebkitAppRegion: 'no-drag' }} onMouseDown={e => e.stopPropagation()}>
      <button onClick={e => { e.stopPropagation(); onSwitchMode(); }} style={{ padding: '6px 14px', fontSize: 12, border: 'none', backgroundColor: '#1A1A2E', color: '#666', cursor: 'pointer', WebkitAppRegion: 'no-drag' }}>Wolf</button>
      <div style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, backgroundColor: '#5DCAA5', color: '#FFF' }}>Ruby</div>
    </div>
  ) : null;

  // ============================================================
  // Intro
  // ============================================================
  if (showIntro) {
    return (
      <div style={{ height: '100vh', backgroundColor: '#0A0A12', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px 12px 80px', WebkitAppRegion: 'drag' }}>
          <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13, WebkitAppRegion: 'no-drag' }}>← Back</button>
          <ModeToggle />
          <div style={{ width: 80 }} />
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, background: 'linear-gradient(135deg, #5DCAA5, #F0997B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', margin: 0 }}>🎹 Ruby's Piano!</h1>
        <p style={{ fontSize: 20, color: '#888', textAlign: 'center', maxWidth: 400, margin: 0 }}>Tap the animals to make music!</p>
        <div style={{ display: 'flex', gap: 16, margin: '16px 0' }}>
          {['C', 'D', 'E'].map(note => {
            const animal = getAnimalForNote(note);
            if (!animal) return null;
            return (
              <button key={note} onClick={async () => { await audioEngine.init(); audioEngine.playNote(note === 'C' ? 60 : note === 'D' ? 62 : 64, 100, 0.5); }}
                style={{ width: 100, height: 120, borderRadius: 16, border: 'none', cursor: 'pointer', backgroundColor: animal.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 40 }}>
                <span>{animal.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#FFF' }}>{animal.animal.charAt(0).toUpperCase() + animal.animal.slice(1)}</span>
              </button>
            );
          })}
        </div>
        <button onClick={startFirstSong} style={{ padding: '16px 40px', borderRadius: 16, border: 'none', fontSize: 22, fontWeight: 700, cursor: 'pointer', backgroundColor: '#F0997B', color: '#FFF' }}>Ready to play a song? 🎵</button>
        <button onClick={() => { setShowIntro(false); pb.setShowLibrary(true); }} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 14, cursor: 'pointer', backgroundColor: 'transparent', color: '#666' }}>Browse all songs →</button>
      </div>
    );
  }

  // ============================================================
  // Library
  // ============================================================
  if (pb.showLibrary) {
    const maxDifficulty = rubyLevel >= 4 ? 5 : rubyLevel;
    const rubySongs = songs.filter(s => (!s.category || s.category === 'ruby') && s.difficulty <= maxDifficulty);
    const handleImportMidi = async () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.mid,.midi'; input.multiple = true;
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        const { parseMidiFile } = await import('../engine/MidiParser');
        for (const file of Array.from(files)) { try { onImportSong(await parseMidiFile(file)); } catch (err) { console.error(err); } }
      };
      input.click();
    };

    return (
      <div style={{ height: '100vh', backgroundColor: '#0A0A12', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 16px 80px', borderBottom: '1px solid #1A1A2E', WebkitAppRegion: 'drag' }}>
          <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 13, WebkitAppRegion: 'no-drag' }}>← Back</button>
          <ModeToggle />
          <div style={{ width: 120 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, padding: '16px 24px' }}>
          <button onClick={() => setLibraryTab('songs')} style={{ padding: '12px 32px', borderRadius: 16, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', backgroundColor: libraryTab === 'songs' ? '#5DCAA5' : '#1A1A2E', color: libraryTab === 'songs' ? '#FFF' : '#666' }}>🎵 Songs</button>
          <button onClick={() => setLibraryTab('exercises')} style={{ padding: '12px 32px', borderRadius: 16, border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', backgroundColor: libraryTab === 'exercises' ? '#F0997B' : '#1A1A2E', color: libraryTab === 'exercises' ? '#FFF' : '#666' }}>🏋️ Practice</button>
        </div>
        {libraryTab === 'songs' && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '0 24px 12px' }}>
            {RUBY_LEVELS.map(l => (
              <button key={l.level} onClick={() => setRubyLevel(l.level)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', backgroundColor: rubyLevel === l.level ? '#5DCAA5' : '#1A1A2E', color: rubyLevel === l.level ? '#FFF' : '#666' }}>Level {l.level}</button>
            ))}
          </div>
        )}
        <div style={{ flex: 1, padding: '0 24px 24px', overflow: 'auto' }}>
          {libraryTab === 'songs' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {rubySongs.map((song, idx) => (
                  <div key={song.id} onClick={() => { selectSong(song); setTimeout(() => pb.playbackRef.current.play(), 500); }}
                    style={{ backgroundColor: CARD_COLORS[idx % CARD_COLORS.length], borderRadius: 16, padding: 16, cursor: 'pointer', border: '2px solid transparent', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 140 }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.borderColor = '#5DCAA5'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.borderColor = 'transparent'; }}>
                    <div style={{ fontSize: 32 }}>{CARD_EMOJIS[idx % CARD_EMOJIS.length]}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#FFF' }}>{song.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{song.artist}</div>
                    <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{formatTime(song.durationMs)}</span>
                      <span style={{ fontSize: 13 }}>{'⭐'.repeat(song.difficulty)}{'☆'.repeat(5 - song.difficulty)}</span>
                    </div>
                    <div style={{ textAlign: 'center', padding: '6px 0', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFF', fontSize: 13, fontWeight: 600 }}>Play ▶</div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <button onClick={handleImportMidi} style={{ background: 'none', border: '1px dashed #333', borderRadius: 8, padding: '8px 20px', color: '#555', fontSize: 12, cursor: 'pointer' }}>+ Import your own .mid files</button>
              </div>
            </>
          ) : (
            <ExerciseBrowser mode="ruby" onSelectExercise={song => { selectSong(song); setTimeout(() => pb.playbackRef.current.play(), 500); }} />
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Playing
  // ============================================================
  return (
    <ErrorBoundary fallbackMessage="Oops — this song hit a wrong note" onReset={() => pb.setShowLibrary(true)}>
      <div ref={pb.containerRef} style={{ height: '100vh', backgroundColor: '#0A0A12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 8px 80px', borderBottom: '1px solid #1A1A2E', flexShrink: 0, WebkitAppRegion: 'drag' }}>
        <button onClick={() => { pb.playbackRef.current.stop(); pb.setShowLibrary(true); }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 12, WebkitAppRegion: 'no-drag' }}>← Songs</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' as any }}>
          <ModeToggle />
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1A1A2E' }}>
            <button onClick={() => switchRubyMode('listen')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: rubyPlayMode === 'listen' ? 700 : 400, border: 'none', cursor: 'pointer', backgroundColor: rubyPlayMode === 'listen' ? '#5DCAA5' : '#1A1A2E', color: rubyPlayMode === 'listen' ? '#FFF' : '#666' }}>Listen</button>
            <button onClick={() => switchRubyMode('practice')} style={{ padding: '4px 10px', fontSize: 11, fontWeight: rubyPlayMode === 'practice' ? 700 : 400, border: 'none', cursor: 'pointer', backgroundColor: rubyPlayMode === 'practice' ? '#F0997B' : '#1A1A2E', color: rubyPlayMode === 'practice' ? '#FFF' : '#666' }}>Play Along</button>
          </div>
          <div style={{ display: 'flex', gap: 2, borderRadius: 6, overflow: 'hidden', border: '1px solid #1A1A2E' }}>
            {(['both', 'left', 'right'] as const).map(h => (
              <button key={h} onClick={() => { pb.playbackRef.current.setHandFilter(h); pb.setPlaybackState(prev => ({ ...prev, handFilter: h })); }}
                style={{ padding: '4px 10px', border: 'none', fontSize: 11, cursor: 'pointer', fontWeight: pb.playbackState.handFilter === h ? 700 : 400, backgroundColor: pb.playbackState.handFilter === h ? (h === 'left' ? '#3366BB' : h === 'right' ? '#CC8833' : '#555') : '#1A1A2E', color: pb.playbackState.handFilter === h ? '#FFF' : '#666' }}>
                {h === 'both' ? '🤲 Both' : h === 'left' ? '🫲 Left' : '🫱 Right'}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#EEE' }}>🎵 {pb.currentSong?.title ?? 'Choose a song'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' as any }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pb.midiConnected ? '#5DCAA5' : '#CC4444' }} />
            <span style={{ fontSize: 11, color: '#666' }}>{pb.midiConnected ? pb.midiDeviceName : 'No keyboard'}</span>
          </div>
          <ScoreDisplay score={pb.scoreRef.current.getState()} mode="ruby" />
        </div>
      </div>

      {encouragement && <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 20, fontWeight: 700, color: '#5DCAA5' }}>{encouragement}</div>}

      {pb.currentSong && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '4px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#3366BB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#FFF' }}>L</div>
            <span style={{ fontSize: 12, color: '#3366BB', fontWeight: 600 }}>Left Hand</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#CC8833', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#FFF' }}>R</div>
            <span style={{ fontSize: 12, color: '#CC8833', fontWeight: 600 }}>Right Hand</span>
          </div>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <FallingNotes notes={pb.currentSong?.notes ?? []} currentTimeMs={pb.playbackState.currentTimeMs} speedMultiplier={pb.playbackState.speedMultiplier} mode="ruby" rubyLevel={rubyLevel} handFilter={pb.playbackState.handFilter} width={pb.dimensions.width} height={pb.dimensions.height} waitingNoteIndex={pb.waitingIndex} hitNotes={pb.hitNotes} />
      </div>

      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        <Piano startNote={36} endNote={96} activeNotes={pb.activeNotes} mode="ruby" rubyLevel={rubyLevel} onKeyPress={pb.handleKeyPress} onKeyRelease={pb.handleKeyRelease} width={pb.dimensions.width} height={100} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', gap: 8, borderTop: '1px solid #1A1A2E', flexShrink: 0, backgroundColor: '#0A0A12' }}>
        <button onClick={async () => { await audioEngine.init(); pb.togglePlay(); }} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: '#5DCAA5', color: '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{pb.playbackState.isPlaying ? '⏸' : '▶'}</button>
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>{formatTime(pb.playbackState.currentTimeMs)}</span>
        {pb.songDurationMs > 0 && <input type="range" min={0} max={pb.songDurationMs} value={pb.playbackState.currentTimeMs} onChange={pb.handleSeek} style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: '#5DCAA5', minWidth: 60 }} />}
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>{formatTime(pb.songDurationMs)}</span>
        <SpeedControl speed={pb.playbackState.speedMultiplier} onChange={s => { pb.playbackRef.current.setSpeed(s); pb.setPlaybackState(prev => ({ ...prev, speedMultiplier: s })); }} mode="ruby" />
      </div>
      </div>
    </ErrorBoundary>
  );
};

export default RubyMode;
