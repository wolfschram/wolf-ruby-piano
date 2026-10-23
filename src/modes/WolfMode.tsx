import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Song, PlaybackMode } from '../types';
import { Piano } from '../components/Piano';
import { FallingNotes } from '../components/FallingNotes';
import { SpeedControl } from '../components/SpeedControl';
import { LoopControl } from '../components/LoopControl';
import { ScoreDisplay } from '../components/ScoreDisplay';
import { SongBrowser } from '../components/SongBrowser';
import { ExerciseBrowser } from '../components/ExerciseBrowser';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { usePianoPlayback } from '../hooks/usePianoPlayback';
import { formatTime } from '../utils/formatTime';
import practiceTracker, { ReviewSuggestion } from '../engine/PracticeTracker';

interface WolfModeProps {
  songs: Song[];
  onImportSong: (song: Song) => void;
  onBack: () => void;
  onSwitchMode?: () => void;
}

export const WolfMode: React.FC<WolfModeProps> = ({ songs, onImportSong, onBack, onSwitchMode }) => {
  const [libraryTab, setLibraryTab] = useState<'songs' | 'exercises'>('songs');
  const [backwardChainActive, setBackwardChainActive] = useState(false);
  const [reviewSuggestions, setReviewSuggestions] = useState<ReviewSuggestion[]>([]);
  const sessionStartedRef = useRef(false);

  const savePracticeData = useCallback(() => {
    const json = practiceTracker.toJSON();
    window.electronAPI?.savePracticeData?.(json).catch((err: any) => {
      console.warn('[WolfMode] Failed to save practice data:', err);
    });
  }, []);

  // Callbacks use the pb return value via closure — but hooks are called
  // in order, so we define stable callbacks that reference pb indirectly
  // via the refs that usePianoPlayback returns.
  const pb = usePianoPlayback({
    mode: 'wolf',
    songs,
    initialSpeed: 1.0,
    initialMode: 'listen',
    enableBackwardChain: true,
    enableSustainPedal: true,
    onBackwardChainChange: setBackwardChainActive,
  });

  // Wire Wolf-specific scoring via effect (avoids circular ref)
  useEffect(() => {
    pb.playbackRef.current.setCallbacks({
      onUpdate: (state, notes) => {
        pb.setPlaybackState({ ...state });
        pb.setActiveNotes(new Set(notes.map(n => n.pitch)));
      },
      onNoteHit: (_note, idx) => {
        pb.setHitNotes(prev => { const s = new Set(prev); s.add(idx); return s; });
      },
      onNoteMiss: (note, idx) => {
        pb.scoreRef.current.recordHit(idx, note.startTime, note.startTime + 999);
      },
      onWaitForInput: (_note, idx) => {
        pb.setWaitingIndex(idx);
      },
      onSongEnd: () => {
        pb.setPlaybackState(prev => ({ ...prev, isPlaying: false }));
        if (pb.currentSong && sessionStartedRef.current) {
          const scoreState = pb.scoreRef.current.getState();
          practiceTracker.endSession(
            pb.currentSong.id, scoreState.accuracy, scoreState.hitNotes,
            scoreState.totalNotes, pb.playbackRef.current.getState().mode,
          );
          sessionStartedRef.current = false;
          savePracticeData();
        }
      },
    });
  }, [pb.currentSong, savePracticeData]);

  // Load practice data on mount
  useEffect(() => {
    (async () => {
      if (window.electronAPI?.loadPracticeData) {
        try {
          const json = await window.electronAPI.loadPracticeData();
          if (json) practiceTracker.loadFromJSON(json);
        } catch (_err) { /* ignore */ }
      }
    })();
    return () => { savePracticeData(); };
  }, [savePracticeData]);

  // Wolf-specific song select: start practice session
  const selectSong = useCallback((song: Song) => {
    pb.selectSong(song);
    practiceTracker.startSession(song.id);
    sessionStartedRef.current = true;
  }, [pb.selectSong]);

  const togglePlay = useCallback(async () => {
    if (pb.currentSong && !sessionStartedRef.current) {
      practiceTracker.startSession(pb.currentSong.id);
      sessionStartedRef.current = true;
    }
    await pb.togglePlay();
  }, [pb.togglePlay, pb.currentSong]);

  const songTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    songs.forEach(s => map.set(s.id, s.title));
    return map;
  }, [songs]);

  useEffect(() => {
    if (pb.showLibrary) setReviewSuggestions(practiceTracker.getReviewSuggestions(songTitleMap));
  }, [pb.showLibrary, songTitleMap]);

  const goBackToLibrary = useCallback(() => {
    pb.playbackRef.current.stop();
    if (pb.currentSong && sessionStartedRef.current) {
      const scoreState = pb.scoreRef.current.getState();
      practiceTracker.endSession(pb.currentSong.id, scoreState.accuracy, scoreState.hitNotes, scoreState.totalNotes, pb.playbackRef.current.getState().mode);
      sessionStartedRef.current = false;
      savePracticeData();
    }
    pb.setShowLibrary(true);
  }, [pb.currentSong, savePracticeData]);

  // ============================================================
  // Library view
  // ============================================================
  if (pb.showLibrary) {
    const totalMinutes = practiceTracker.getTotalPracticeMinutes();
    const streak = practiceTracker.getPracticeStreak();

    return (
      <ErrorBoundary fallbackMessage="The song library encountered an error" onReset={() => window.location.reload()}>
      <div style={{ height: '100vh', backgroundColor: '#0A0A12', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 16px 80px', background: 'linear-gradient(180deg, rgba(204, 136, 51, 0.08) 0%, rgba(10, 10, 18, 0) 100%)', borderBottom: '1px solid rgba(204, 136, 51, 0.15)', WebkitAppRegion: 'drag' }}>
          <button onClick={onBack} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(204, 136, 51, 0.3)', backgroundColor: 'rgba(26, 26, 46, 0.5)', color: '#CC8833', cursor: 'pointer', fontSize: 13, fontWeight: 500, WebkitAppRegion: 'no-drag' }}>← Back</button>
          {onSwitchMode && (
            <div style={{ display: 'flex', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(204, 136, 51, 0.2)', backgroundColor: 'rgba(26, 26, 46, 0.4)', WebkitAppRegion: 'no-drag' }}>
              <div style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, backgroundColor: '#CC8833', color: '#FFF' }}>Wolf</div>
              <button onClick={onSwitchMode} style={{ padding: '8px 16px', fontSize: 12, fontWeight: 500, border: 'none', backgroundColor: 'transparent', color: '#888', cursor: 'pointer' }}>Ruby</button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: pb.midiConnected ? '#5DCAA5' : '#CC4444' }} />
            <span style={{ fontSize: 12, color: '#888' }}>{pb.midiConnected ? pb.midiDeviceName : 'No keyboard'}</span>
            {!pb.samplesReady && <span style={{ fontSize: 12, color: '#FFAA33', marginLeft: 12 }}>Loading piano samples...</span>}
          </div>
        </div>

        {(totalMinutes > 0 || streak > 0) && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(204, 136, 51, 0.1)', display: 'flex', gap: 16 }}>
            {totalMinutes > 0 && (
              <div style={{ flex: 1, padding: '16px 20px', borderRadius: 12, backgroundColor: 'rgba(204, 136, 51, 0.08)', border: '1px solid rgba(204, 136, 51, 0.2)' }}>
                <div style={{ fontSize: 11, color: '#CC8833', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Practice</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#FFF', marginTop: 8 }}>{totalMinutes}<span style={{ fontSize: 14, color: '#888', marginLeft: 4 }}>min</span></div>
              </div>
            )}
            {streak > 0 && (
              <div style={{ flex: 1, padding: '16px 20px', borderRadius: 12, backgroundColor: 'rgba(93, 202, 165, 0.08)', border: '1px solid rgba(93, 202, 165, 0.2)' }}>
                <div style={{ fontSize: 11, color: '#5DCAA5', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Streak</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#FFF', marginTop: 8 }}>{streak}<span style={{ fontSize: 14, color: '#888', marginLeft: 4 }}>{streak !== 1 ? 'days' : 'day'}</span></div>
              </div>
            )}
          </div>
        )}

        {reviewSuggestions.length > 0 && (
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(204, 136, 51, 0.1)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#CC8833', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>★ Review Today</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {reviewSuggestions.map(s => (
                <button key={s.songId} onClick={() => { const song = songs.find(x => x.id === s.songId); if (song) selectSong(song); }}
                  style={{ textAlign: 'left', padding: '12px 16px', borderRadius: 10, border: '1px solid rgba(204, 136, 51, 0.15)', backgroundColor: 'rgba(26, 26, 46, 0.4)', color: '#EEE', cursor: 'pointer', fontSize: 13 }}>
                  <div style={{ fontWeight: 600, color: '#FFF' }}>{s.songTitle}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{s.reason}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, padding: '16px 24px', borderBottom: '1px solid rgba(204, 136, 51, 0.1)' }}>
          <button onClick={() => setLibraryTab('songs')} style={{ padding: '10px 20px', border: libraryTab === 'songs' ? '1.5px solid #CC8833' : '1.5px solid rgba(204, 136, 51, 0.2)', backgroundColor: libraryTab === 'songs' ? 'rgba(204, 136, 51, 0.15)' : 'rgba(26, 26, 46, 0.4)', color: libraryTab === 'songs' ? '#CC8833' : '#888', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: libraryTab === 'songs' ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>🎵 Songs</button>
          <button onClick={() => setLibraryTab('exercises')} style={{ padding: '10px 20px', border: libraryTab === 'exercises' ? '1.5px solid #5DCAA5' : '1.5px solid rgba(93, 202, 165, 0.2)', backgroundColor: libraryTab === 'exercises' ? 'rgba(93, 202, 165, 0.15)' : 'rgba(26, 26, 46, 0.4)', color: libraryTab === 'exercises' ? '#5DCAA5' : '#888', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: libraryTab === 'exercises' ? 700 : 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>✋ Exercises</button>
        </div>

        <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
          {libraryTab === 'songs'
            ? <SongBrowser songs={songs} onSelectSong={selectSong} onImportSong={onImportSong} mode="wolf" />
            : <ExerciseBrowser mode="wolf" onSelectExercise={selectSong} />}
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  // ============================================================
  // Playing view
  // ============================================================
  return (
    <ErrorBoundary fallbackMessage="Oops — this song hit a wrong note" onReset={() => pb.setShowLibrary(true)}>
      <div ref={pb.containerRef} style={{ height: '100vh', backgroundColor: '#0A0A12', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top HUD */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 8px 80px', borderBottom: '1px solid #1A1A2E', flexShrink: 0, WebkitAppRegion: 'drag' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, WebkitAppRegion: 'no-drag' as any }}>
          <button onClick={goBackToLibrary} style={{ padding: '4px 10px', borderRadius: 4, border: 'none', backgroundColor: '#1A1A2E', color: '#888', cursor: 'pointer', fontSize: 12 }}>← Songs</button>
          <div>
            <span style={{ color: '#EEE', fontWeight: 600, fontSize: 14 }}>{pb.currentSong?.title}</span>
            <span style={{ color: '#555', fontSize: 12, marginLeft: 8 }}>{pb.currentSong?.artist}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, WebkitAppRegion: 'no-drag' as any }}>
          {onSwitchMode && (
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #1A1A2E' }}>
              <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 700, backgroundColor: '#CC8833', color: '#FFF' }}>Wolf</div>
              <button onClick={onSwitchMode} style={{ padding: '4px 12px', fontSize: 11, border: 'none', backgroundColor: '#1A1A2E', color: '#666', cursor: 'pointer' }}>Ruby</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: 4 }}>
            {(['listen', 'practice', 'perform'] as PlaybackMode[]).map(m => (
              <button key={m} onClick={() => pb.setMode(m)} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', fontSize: 12, cursor: 'pointer', textTransform: 'capitalize', fontWeight: pb.playbackState.mode === m ? 700 : 400, backgroundColor: pb.playbackState.mode === m ? '#CC8833' : '#1A1A2E', color: pb.playbackState.mode === m ? '#FFF' : '#888' }}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: pb.midiConnected ? '#5DCAA5' : '#CC4444' }} />
          <span style={{ fontSize: 11, color: '#555' }}>{pb.midiConnected ? pb.midiDeviceName : 'No keyboard'}</span>
          {pb.sustainActive && <span style={{ fontSize: 10, color: '#FFAA33', fontWeight: 700, marginLeft: 8, padding: '1px 6px', borderRadius: 3, backgroundColor: '#CC883330' }}>SUS</span>}
        </div>
      </div>

      {/* Falling Notes */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <FallingNotes notes={pb.currentSong?.notes ?? []} currentTimeMs={pb.playbackState.currentTimeMs} speedMultiplier={pb.playbackState.speedMultiplier} mode="wolf" handFilter={pb.playbackState.handFilter} width={pb.dimensions.width} height={pb.dimensions.height - 24} waitingNoteIndex={pb.waitingIndex} hitNotes={pb.hitNotes} userNoteVelocities={pb.userNoteVelocities} />
        {pb.currentSong && (
          <div style={{ height: 24, display: 'flex', gap: 1, padding: '2px 12px', alignItems: 'center', backgroundColor: '#0A0A12', borderTop: '1px solid #1A1A2E', overflow: 'auto' }}>
            {practiceTracker.getSectionHeatmap(pb.currentSong.id).map((section, idx) => {
              const colors: Record<string, string> = { untouched: '#333', learning: '#CC4444', familiar: '#CC8833', mastered: '#5DCAA5' };
              return <div key={idx} title={`Section ${idx + 1}: ${section.level} (${section.accuracy}%)`} style={{ flex: '0 0 6px', height: 8, borderRadius: 1, backgroundColor: colors[section.level] || '#333' }} />;
            })}
          </div>
        )}
        {pb.playbackRef.current.isWaiting() && (
          <div style={{ position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)', padding: '8px 20px', borderRadius: 8, backgroundColor: '#CC883380', color: '#FFF', fontSize: 14, fontWeight: 600 }}>Your turn — play the note!</div>
        )}
        {backwardChainActive && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', padding: '6px 16px', borderRadius: 6, backgroundColor: '#6633CC90', color: '#FFF', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>&#8592;</span> Backward Chain
            <span style={{ opacity: 0.7, fontSize: 11 }}>Pass {pb.playbackRef.current.getBackwardChainState().passesAtCurrent + 1}/{pb.playbackRef.current.getBackwardChainState().requiredPasses}</span>
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, overflow: 'hidden' }}>
        <Piano startNote={36} endNote={96} activeNotes={pb.activeNotes} activeHand={pb.activeHand} mode="wolf" onKeyPress={pb.handleKeyPress} onKeyRelease={pb.handleKeyRelease} width={pb.dimensions.width} height={100} />
      </div>

      {/* Bottom Bar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '5px 12px', borderTop: '1px solid #1A1A2E', flexShrink: 0, backgroundColor: '#0A0A12', gap: 8 }}>
        <button onClick={togglePlay} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', backgroundColor: '#CC8833', color: '#FFF', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{pb.playbackState.isPlaying ? '⏸' : '▶'}</button>
        <button onClick={() => { pb.playbackRef.current.stop(); pb.setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTimeMs: 0 })); pb.setActiveNotes(new Set()); pb.setHitNotes(new Set()); pb.setWaitingIndex(undefined); }}
          style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', backgroundColor: '#1A1A2E', color: '#888', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⏹</button>
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>{formatTime(pb.playbackState.currentTimeMs)}</span>
        {pb.songDurationMs > 0 && <input type="range" min={0} max={pb.songDurationMs} value={pb.playbackState.currentTimeMs} onChange={pb.handleSeek} style={{ flex: 1, height: 3, cursor: 'pointer', accentColor: '#CC8833', minWidth: 60 }} />}
        <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace', flexShrink: 0 }}>{formatTime(pb.songDurationMs)}</span>
        <SpeedControl speed={pb.playbackState.speedMultiplier} onChange={(s) => { pb.playbackRef.current.setSpeed(s); pb.setPlaybackState(prev => ({ ...prev, speedMultiplier: s })); }} mode="wolf" />
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {(['both', 'left', 'right'] as const).map(h => (
            <button key={h} onClick={() => { pb.playbackRef.current.setHandFilter(h); pb.setPlaybackState(prev => ({ ...prev, handFilter: h })); }}
              style={{ padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: 10, cursor: 'pointer', textTransform: 'capitalize', fontWeight: pb.playbackState.handFilter === h ? 700 : 400, backgroundColor: pb.playbackState.handFilter === h ? (h === 'left' ? '#3366BB' : h === 'right' ? '#CC8833' : '#555') : '#1A1A2E', color: pb.playbackState.handFilter === h ? '#FFF' : '#666' }}>
              {h === 'both' ? 'Both' : h === 'left' ? 'L' : 'R'}
            </button>
          ))}
        </div>
        <LoopControl totalBars={Math.ceil((pb.currentSong?.durationMs ?? 0) / ((60000 / (pb.currentSong?.bpm ?? 120)) * 4))} loopStart={pb.playbackState.loopStart} loopEnd={pb.playbackState.loopEnd} onLoopChange={(s, e) => pb.playbackRef.current.setLoop(s, e)} mode="wolf" />
        {pb.playbackState.mode === 'perform' && <ScoreDisplay score={pb.scoreRef.current.getState()} mode="wolf" />}
      </div>
      </div>
    </ErrorBoundary>
  );
};

export default WolfMode;
