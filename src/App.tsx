import React, { useState, useCallback, useEffect } from 'react';
import { Song, AppMode } from './types';
import WolfMode from './modes/WolfMode';
import RubyMode from './modes/RubyMode';
import { getBuiltInSongs } from './songs/library';

const electronAPI = (window as any).electronAPI;

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);

  // Load built-in songs + any previously imported songs from disk
  useEffect(() => {
    const load = async () => {
      const builtIn = getBuiltInSongs();
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

      setSongs([...builtIn, ...imported]);
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
  if (mode === 'wolf') {
    return (
      <WolfMode
        songs={songs}
        onImportSong={handleImportSong}
        onBack={() => setMode(null)}
        onSwitchMode={() => setMode('ruby')}
      />
    );
  }

  return (
    <RubyMode
      songs={songs}
      onImportSong={handleImportSong}
      onBack={() => setMode(null)}
      onSwitchMode={() => setMode('wolf')}
    />
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
