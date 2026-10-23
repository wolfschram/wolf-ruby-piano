import React, { useState, useCallback, useEffect, Component, ReactNode } from 'react';
import { Song, AppMode } from './types';
import WolfMode from './modes/WolfMode';
import RubyMode from './modes/RubyMode';
import { getBuiltInSongs, loadMidiLibrary } from './songs/library';

// Root error boundary — NEVER show black screen
class AppErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(err: Error) { return { hasError: true, error: err.message }; }
  componentDidCatch(err: Error, info: React.ErrorInfo) { console.error('[AppErrorBoundary]', err, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A12', color: '#EEE', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎹</div>
          <h2 style={{ color: '#CC8833', fontSize: 20, margin: 0 }}>Something crashed</h2>
          <p style={{ color: '#888', fontSize: 14, maxWidth: 500, textAlign: 'center', margin: '12px 0' }}>{this.state.error}</p>
          <button onClick={() => { this.setState({ hasError: false, error: '' }); this.props.onReset(); }}
            style={{ padding: '12px 28px', borderRadius: 8, border: 'none', backgroundColor: '#CC8833', color: '#FFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 12 }}>
            ← Back to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const electronAPI = (window as any).electronAPI;

// Global safety net — catch ALL uncaught errors so the app never goes black
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[GLOBAL] Uncaught error:', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[GLOBAL] Unhandled rejection:', e.reason);
  });
}

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);

  // Phase 1: Load hand-coded fallback songs instantly (sync)
  // Phase 2: Load real MIDI files from public/midi/ (async, replaces fallbacks)
  useEffect(() => {
    const load = async () => {
      // Instant: hand-coded starter songs so UI is never empty
      const fallback = getBuiltInSongs();
      let imported: Song[] = [];

      try {
        if (electronAPI?.loadLibrary) {
          const raw = await electronAPI.loadLibrary();
          if (raw) {
            imported = JSON.parse(raw);
            console.log(`[App] Loaded ${imported.length} imported songs from library`);
          }
        }
      } catch (err) {
        console.error('[App] Failed to load library:', err);
      }

      // Show fallback songs immediately
      setSongs([...fallback, ...imported]);

      // Then async-load real MIDI files and merge with fallbacks
      // Wrapped in setTimeout to let the UI render first — never block boot
      setTimeout(async () => {
        try {
          console.log('[App] Starting MIDI library load...');
          const midiSongs = await loadMidiLibrary();
          if (midiSongs.length > 0) {
            setSongs(prev => {
              const userImported = prev.filter(s => s.source !== 'built-in');

              // Build a set of titles covered by MIDI files
              const midiTitles = new Set(midiSongs.map(s => s.title.toLowerCase()));

              // Keep hand-coded built-in songs that DON'T have a matching MIDI version.
              // This preserves hand-coded piano arrangements for orchestral MIDI files
              // (e.g. Once Upon a Time in the West hand-coded in D major vs. 29-track orchestral MIDI)
              const handCodedKeepers = prev.filter(
                s => s.source === 'built-in' && !midiTitles.has(s.title.toLowerCase())
              );

              if (handCodedKeepers.length > 0) {
                console.log(`[App] Keeping ${handCodedKeepers.length} hand-coded songs without MIDI equivalents:`,
                  handCodedKeepers.map(s => s.title));
              }

              return [...midiSongs, ...handCodedKeepers, ...userImported];
            });
            console.log(`[App] Loaded ${midiSongs.length} MIDI songs`);
          }
        } catch (err) {
          console.error('[App] MIDI library load failed, keeping fallbacks:', err);
        }
      }, 2000); // Delay 2s so UI is fully responsive first
    };
    load();
  }, []);

  // Persist imported songs whenever the list changes
  const saveImportedSongs = useCallback((allSongs: Song[]) => {
    try {
      const imported = allSongs.filter(s => s.source !== 'built-in');
      if (electronAPI?.saveLibrary) {
        electronAPI.saveLibrary(JSON.stringify(imported));
      }
    } catch (err) {
      console.error('[App] Failed to save library:', err);
    }
  }, []);

  const handleImportSong = useCallback((song: Song) => {
    setSongs(prev => {
      const next = [...prev, song];
      saveImportedSongs(next);
      return next;
    });
  }, [saveImportedSongs]);

  if (!mode) {
    return <HomeScreen onSelectMode={setMode} />;
  }

  // Pass onSwitchMode so the top toggle works inside each mode
  return (
    <AppErrorBoundary onReset={() => setMode(null)}>
      {mode === 'wolf' ? (
        <WolfMode
          songs={songs}
          onImportSong={handleImportSong}
          onBack={() => setMode(null)}
          onSwitchMode={() => setMode('ruby')}
        />
      ) : (
        <RubyMode
          songs={songs}
          onImportSong={handleImportSong}
          onBack={() => setMode(null)}
          onSwitchMode={() => setMode('wolf')}
        />
      )}
    </AppErrorBoundary>
  );
};

// ============================================================
// Home Screen
// ============================================================
const HomeScreen: React.FC<{ onSelectMode: (mode: AppMode) => void }> = ({ onSelectMode }) => {
  const [hover, setHover] = useState<AppMode | null>(null);

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 48,
      background: 'linear-gradient(135deg, #0A0A12 0%, #0D0D18 50%, #111122 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: 56, fontWeight: 800, margin: 0,
          background: 'linear-gradient(135deg, #CC8833, #5DCAA5)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          letterSpacing: -1,
        }}>
          Wolf & Ruby Piano
        </h1>
        <p style={{ fontSize: 18, color: '#666', margin: '12px 0 0 0' }}>
          Choose your mode
        </p>
      </div>

      <div style={{ display: 'flex', gap: 32 }}>
        {/* Wolf */}
        <div
          onClick={() => onSelectMode('wolf')}
          onMouseEnter={() => setHover('wolf')}
          onMouseLeave={() => setHover(null)}
          style={{
            width: 280, padding: 32, borderRadius: 20, cursor: 'pointer',
            backgroundColor: '#0A0A12',
            border: hover === 'wolf' ? '2px solid #CC8833' : '2px solid #1A1A2E',
            transition: 'all 0.2s ease',
            transform: hover === 'wolf' ? 'scale(1.03)' : 'scale(1)',
            boxShadow: hover === 'wolf' ? '0 8px 32px rgba(204,136,51,0.3)' : '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎹</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#EEE', margin: '0 0 8px 0' }}>Wolf Mode</h2>
          <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>
            Falling blocks, film scores, your pace. Learn Morricone note by note.
          </p>
          <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
            <span style={{ padding: '3px 8px', borderRadius: 4, backgroundColor: '#3366BB30', color: '#3366BB', fontSize: 11, fontWeight: 600 }}>Left Hand</span>
            <span style={{ padding: '3px 8px', borderRadius: 4, backgroundColor: '#CC883330', color: '#CC8833', fontSize: 11, fontWeight: 600 }}>Right Hand</span>
          </div>
        </div>

        {/* Ruby */}
        <div
          onClick={() => onSelectMode('ruby')}
          onMouseEnter={() => setHover('ruby')}
          onMouseLeave={() => setHover(null)}
          style={{
            width: 280, padding: 32, borderRadius: 20, cursor: 'pointer',
            backgroundColor: '#12121E',
            border: hover === 'ruby' ? '2px solid #5DCAA5' : '2px solid #1A1A2E',
            transition: 'all 0.2s ease',
            transform: hover === 'ruby' ? 'scale(1.03)' : 'scale(1)',
            boxShadow: hover === 'ruby' ? '0 8px 32px rgba(93,202,165,0.3)' : '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐱🐶🐘</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: '#EEE', margin: '0 0 8px 0' }}>Ruby Mode</h2>
          <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>
            Animals fall, you catch them! Play a real song in under 2 minutes.
          </p>
          <div style={{ marginTop: 20, display: 'flex', gap: 4 }}>
            {['🐱', '🐶', '🐘', '🐸', '🦒'].map(e => (
              <span key={e} style={{ fontSize: 20 }}>{e}</span>
            ))}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: '#444', margin: 0 }}>
        Connect a MIDI keyboard via USB for the best experience
      </p>
    </div>
  );
};

export default App;
