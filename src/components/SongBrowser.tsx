import React, { useState, useCallback, useRef } from 'react';
import { Song } from '../types';
import { parseMidiFile, parseMidiBuffer } from '../engine/MidiParser';
import { searchMidi, downloadMidi, MidiSearchResult } from '../engine/MidiSearch';

interface SongBrowserProps {
  songs: Song[];
  currentSongId?: string;
  onSelectSong: (song: Song) => void;
  onImportSong: (song: Song) => void;
  mode: 'wolf' | 'ruby';
}

const ACCENT = {
  wolf: '#CC8833',
  ruby: '#5DCAA5',
};

export const SongBrowser: React.FC<SongBrowserProps> = ({
  songs,
  currentSongId,
  onSelectSong,
  onImportSong,
  mode,
}) => {
  const [filter, setFilter] = useState<'all' | 'built-in' | 'imported'>('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'library' | 'find'>('library');
  const [dragOver, setDragOver] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Online search state
  const [onlineQuery, setOnlineQuery] = useState(mode === 'wolf' ? 'morricone' : 'kids piano easy');
  const [onlineResults, setOnlineResults] = useState<MidiSearchResult[]>([]);
  const [onlineTotal, setOnlineTotal] = useState(0);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState('');
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  const dropRef = useRef<HTMLDivElement>(null);
  const accent = ACCENT[mode];

  // Filter local songs
  const filtered = songs.filter(s => {
    if (filter !== 'all' && s.source !== filter) return false;
    if (search && !s.title.toLowerCase().includes(search.toLowerCase()) &&
        !s.artist.toLowerCase().includes(search.toLowerCase())) return false;
    if (mode === 'ruby' && s.category && s.category !== 'ruby') return false;
    if (mode === 'wolf' && s.category === 'ruby') return false;
    return true;
  });

  // File picker import
  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      let count = 0;
      for (const file of Array.from(files)) {
        try {
          const song = await parseMidiFile(file);
          onImportSong(song);
          count++;
        } catch (err) {
          console.error('Failed to parse MIDI:', file.name, err);
        }
      }
      if (count > 0) flash(`Imported ${count} song${count > 1 ? 's' : ''}!`);
    };
    input.click();
  }, [onImportSong]);

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.mid') || f.name.endsWith('.midi'));
    if (files.length === 0) { flash('No .mid files found in drop'); return; }
    let count = 0;
    for (const file of files) {
      try { const song = await parseMidiFile(file); onImportSong(song); count++; } catch (err) { console.error(err); }
    }
    if (count > 0) flash(`Imported ${count} song${count > 1 ? 's' : ''}!`);
  }, [onImportSong]);

  // Flash status message
  const flash = (msg: string) => { setImportStatus(msg); setTimeout(() => setImportStatus(''), 3500); };

  // ============================================
  // ONLINE SEARCH
  // ============================================
  const handleOnlineSearch = useCallback(async () => {
    if (!onlineQuery.trim()) return;
    setOnlineLoading(true);
    setOnlineError('');
    try {
      const { results, totalResults } = await searchMidi(onlineQuery);
      setOnlineResults(results);
      setOnlineTotal(totalResults);
      if (results.length === 0) setOnlineError('No results found. Try different keywords.');
    } catch (err: any) {
      console.error('Search failed:', err);
      setOnlineError(err.message || 'Search failed');
    } finally {
      setOnlineLoading(false);
    }
  }, [onlineQuery]);

  // Download a search result and import it
  const handleDownloadResult = useCallback(async (result: MidiSearchResult) => {
    if (downloading.has(result.downloadUrl)) return;

    setDownloading(prev => new Set(prev).add(result.downloadUrl));
    try {
      const buffer = await downloadMidi(result.downloadUrl);
      const song = parseMidiBuffer(buffer, {
        title: result.title,
        source: 'imported',
        filePath: result.downloadUrl,
      });

      if (song.notes.length === 0) {
        flash(`"${result.title}" — no playable notes found`);
        return;
      }

      if (song.notes.length > 2000) {
        flash(`Added "${song.title}" (${song.notes.length} notes - this is a large file, may be slow)`);
      } else {
        flash(`Added "${song.title}" (${song.notes.length} notes, ${formatDuration(song.durationMs)})`);
      }

      onImportSong(song);
    } catch (err: any) {
      console.error('Download failed:', err);
      flash(`Download failed: ${err.message}`);
    } finally {
      setDownloading(prev => { const next = new Set(prev); next.delete(result.downloadUrl); return next; });
    }
  }, [downloading, onImportSong]);

  const difficultyStars = (d: number) => '★'.repeat(d) + '☆'.repeat(5 - d);
  const formatDuration = (ms: number) => {
    const s = Math.round(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  };
  const formatNumber = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  // Check if a result is already in the library
  const isAlreadyImported = (url: string) => songs.some(s => s.filePath === url);

  return (
    <div
      ref={dropRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'column', gap: 12, padding: 16,
        backgroundColor: '#0D0D18', borderRadius: 12,
        maxHeight: '100%', overflow: 'hidden', position: 'relative',
        border: dragOver ? `2px dashed ${accent}` : '2px solid transparent',
        transition: 'border-color 0.2s ease',
      }}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          backgroundColor: `${accent}15`, display: 'flex',
          alignItems: 'center', justifyContent: 'center', borderRadius: 12,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: accent, padding: '20px 32px', borderRadius: 12, backgroundColor: '#0D0D18ee' }}>
            Drop .mid files here
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#EEE' }}>
          {mode === 'wolf' ? '🎹 Song Library' : '🎵 Songs'}
        </h2>
        <button
          onClick={handleImport}
          style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            backgroundColor: accent, color: '#FFF',
          }}
        >
          + Import MIDI
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 2, borderRadius: 8, overflow: 'hidden', backgroundColor: '#1A1A2E', padding: 2 }}>
        {(['library', 'find'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '10px 12px', border: 'none', borderRadius: 6,
              fontSize: 13, fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
              backgroundColor: tab === t ? accent : 'transparent',
              color: tab === t ? '#FFF' : '#777',
              transition: 'all 0.15s ease',
            }}
          >
            {t === 'library' ? 'My Songs' : 'Search Online (113k+)'}
          </button>
        ))}
      </div>

      {/* Status banner */}
      {importStatus && (
        <div style={{
          padding: '8px 12px', borderRadius: 6,
          backgroundColor: '#5DCAA520', color: '#5DCAA5',
          fontSize: 13, fontWeight: 600,
        }}>
          {importStatus}
        </div>
      )}

      {/* =================== MY SONGS TAB =================== */}
      {tab === 'library' && (
        <>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <input
            type="text" placeholder="Search your songs..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 12px', borderRadius: 6, border: '1px solid #333',
              backgroundColor: '#1A1A2E', color: '#EEE', fontSize: 13, outline: 'none',
            }}
          />

          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'built-in', 'imported'] as const).map(f => (
              <button
                key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '4px 10px', borderRadius: 4, border: 'none',
                  fontSize: 11, fontWeight: filter === f ? 700 : 400, cursor: 'pointer',
                  backgroundColor: filter === f ? accent : '#1A1A2E',
                  color: filter === f ? '#FFF' : '#888', textTransform: 'capitalize',
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(song => (
              <div
                key={song.id} onClick={() => onSelectSong(song)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  backgroundColor: song.id === currentSongId ? '#2A2244' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { if (song.id !== currentSongId) e.currentTarget.style.backgroundColor = '#1A1A2E'; }}
                onMouseLeave={(e) => { if (song.id !== currentSongId) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#EEE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2, display: 'flex', gap: 12 }}>
                    <span>{song.artist}</span>
                    {song.durationMs > 0 && <span>{formatDuration(song.durationMs)}</span>}
                    <span>{song.notes.length} notes</span>
                    {song.source === 'imported' && <span style={{ color: accent }}>imported</span>}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: accent, letterSpacing: 1, flexShrink: 0, marginLeft: 8 }}>
                  {difficultyStars(song.difficulty)}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 13 }}>
                No songs found. Search online to add more!
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px dashed #333', textAlign: 'center', color: '#555', fontSize: 12 }}>
            Drag & drop .mid files here to import
          </div>
        </>
      )}

      {/* =================== SEARCH ONLINE TAB =================== */}
      {tab === 'find' && (
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Search bar */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Search 113,000+ MIDI files... e.g. Morricone, Beethoven, River Flows"
              value={onlineQuery}
              onChange={(e) => setOnlineQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleOnlineSearch(); }}
              style={{
                flex: 1, padding: '10px 14px', borderRadius: 6,
                border: '1px solid #333', backgroundColor: '#1A1A2E',
                color: '#EEE', fontSize: 14, outline: 'none',
              }}
            />
            <button
              onClick={handleOnlineSearch}
              disabled={onlineLoading}
              style={{
                padding: '10px 20px', borderRadius: 6, border: 'none',
                fontSize: 14, fontWeight: 700, cursor: onlineLoading ? 'wait' : 'pointer',
                backgroundColor: onlineLoading ? '#555' : accent, color: '#FFF',
              }}
            >
              {onlineLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Loading spinner */}
          {onlineLoading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 12 }}>
              <div style={{
                width: 28, height: 28, border: `3px solid #333`,
                borderTop: `3px solid ${accent}`, borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: '#888', fontSize: 14 }}>Searching BitMidi...</span>
            </div>
          )}

          {/* Quick search suggestions */}
          {onlineResults.length === 0 && !onlineLoading && !onlineError && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#666', alignSelf: 'center' }}>Try:</span>
              {(mode === 'wolf'
                ? ['Morricone', 'Beethoven', 'Chopin', 'River Flows in You', 'Debussy', 'Bach', 'Moonlight Sonata', 'Cinema Paradiso', 'Hans Zimmer']
                : ['Twinkle Twinkle', 'Mary Had a Little Lamb', 'Jingle Bells', 'Happy Birthday', 'Do Re Mi', 'Old MacDonald']
              ).map(q => (
                <button
                  key={q}
                  onClick={() => { setOnlineQuery(q); }}
                  style={{
                    padding: '4px 10px', borderRadius: 12, border: '1px solid #333',
                    fontSize: 11, cursor: 'pointer',
                    backgroundColor: '#1A1A2E', color: '#AAA',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252540'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1A1A2E'; }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {onlineError && (
            <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#CC444420', color: '#CC4444', fontSize: 13 }}>
              {onlineError}
            </div>
          )}

          {/* Result count */}
          {onlineResults.length > 0 && (
            <div style={{ fontSize: 12, color: '#666' }}>
              Showing {onlineResults.length} of {formatNumber(onlineTotal)} results from BitMidi
            </div>
          )}

          {/* Search results */}
          {onlineResults.map((result, i) => {
            const alreadyAdded = isAlreadyImported(result.downloadUrl);
            const isDownloading = downloading.has(result.downloadUrl);

            return (
              <div
                key={`${result.downloadUrl}-${i}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', borderRadius: 8, backgroundColor: '#1A1A2E',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#252540'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#1A1A2E'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#EEE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {result.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 3, display: 'flex', gap: 12 }}>
                    <span>{formatNumber(result.views)} views</span>
                    <span>{formatNumber(result.plays)} plays</span>
                    <span style={{ color: '#555' }}>BitMidi</span>
                  </div>
                </div>
                <button
                  onClick={() => !alreadyAdded && !isDownloading && handleDownloadResult(result)}
                  disabled={alreadyAdded || isDownloading}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: 'none',
                    fontSize: 12, fontWeight: 600, cursor: alreadyAdded ? 'default' : isDownloading ? 'wait' : 'pointer',
                    backgroundColor: alreadyAdded ? '#333' : isDownloading ? '#555' : accent,
                    color: alreadyAdded ? '#888' : '#FFF',
                    flexShrink: 0, marginLeft: 10,
                  }}
                >
                  {alreadyAdded ? 'Added' : isDownloading ? 'Downloading...' : 'Add'}
                </button>
              </div>
            );
          })}

          {/* Powered by notice */}
          {onlineResults.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#444', padding: '8px 0' }}>
              Powered by BitMidi.com — 113,000+ free MIDI files
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SongBrowser;
