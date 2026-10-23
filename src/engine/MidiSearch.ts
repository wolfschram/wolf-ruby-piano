/// <reference path="../types/electron.d.ts" />

/**
 * MidiSearch — search and download MIDI files from online libraries.
 *
 * Currently uses BitMidi (113,000+ files) as the primary source.
 * Downloads are direct .mid files parsed by our MidiParser.
 */

export interface MidiSearchResult {
  title: string;
  downloadUrl: string;
  views: number;
  plays: number;
  source: string;
}

const BITMIDI_BASE = 'https://bitmidi.com';

/**
 * Search BitMidi for MIDI files matching a query.
 * Parses the HTML response to extract results.
 */
export async function searchMidi(query: string, page: number = 0): Promise<{
  results: MidiSearchResult[];
  totalResults: number;
}> {
  if (!query.trim()) return { results: [], totalResults: 0 };

  const url = `${BITMIDI_BASE}/search?q=${encodeURIComponent(query.trim())}${page > 0 ? `&page=${page}` : ''}`;

  // Use Electron proxy to bypass CORS, fallback to direct fetch for dev
  let html: string;
  if (window.electronAPI?.proxyFetch) {
    html = await window.electronAPI.proxyFetch(url);
  } else {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Search failed: HTTP ${resp.status}`);
    html = await resp.text();
  }
  return parseBitmidiResults(html);
}

/**
 * Parse BitMidi search result HTML into structured results.
 * BitMidi embeds search data as JSON in a window.initStore script tag.
 */
function parseBitmidiResults(html: string): {
  results: MidiSearchResult[];
  totalResults: number;
} {
  const results: MidiSearchResult[] = [];

  // BitMidi uses a JS SPA — result data lives in window.initStore JSON
  const storeMatch = html.match(/window\.initStore\s*=\s*({[\s\S]+?})\s*<\/script>/);
  if (!storeMatch) {
    // Fallback: try legacy HTML patterns in case they revert
    return parseBitmidiLegacy(html);
  }

  try {
    const store = JSON.parse(storeMatch[1]);
    const midis = store?.data?.midis;
    if (!midis || typeof midis !== 'object') {
      return parseBitmidiLegacy(html);
    }

    const entries = Object.values(midis) as Array<Record<string, unknown>>;
    for (const entry of entries) {
      const name = (entry.name as string) || (entry.slug as string) || '';
      const downloadUrl = entry.downloadUrl as string;
      if (!downloadUrl) continue;

      results.push({
        title: cleanTitle(name),
        downloadUrl: downloadUrl.startsWith('http')
          ? downloadUrl
          : `${BITMIDI_BASE}${downloadUrl}`,
        views: (entry.views as number) ?? 0,
        plays: (entry.plays as number) ?? 0,
        source: 'BitMidi',
      });
    }

    // Total count from store metadata or fall back to result count
    let totalResults = results.length;
    try {
      const views = store?.data?.views;
      if (views) {
        const searchViews = Object.values(views)?.[0] as Record<string, unknown> | undefined;
        if (searchViews) {
          const firstKey = Object.keys(searchViews)[0];
          const meta = searchViews[firstKey] as Record<string, unknown> | undefined;
          if (meta?.total) totalResults = meta.total as number;
        }
      }
    } catch { /* use results.length */ }

    return { results, totalResults };
  } catch {
    return parseBitmidiLegacy(html);
  }
}

/**
 * Legacy fallback parser for older BitMidi HTML structure.
 */
function parseBitmidiLegacy(html: string): {
  results: MidiSearchResult[];
  totalResults: number;
} {
  const results: MidiSearchResult[] = [];
  let totalResults = 0;
  const totalMatch = html.match(/(\d[\d,]*)\s+results?/i);
  if (totalMatch) {
    totalResults = parseInt(totalMatch[1].replace(/,/g, ''), 10);
  }

  const uploadRegex = /href="\/uploads\/(\d+)\.mid"/g;
  const slugRegex = /href="\/([a-z0-9][a-z0-9\-]*-mid)"[^>]*>([^<]+)/gi;
  let match;

  // Try upload-style links first
  while ((match = uploadRegex.exec(html)) !== null) {
    results.push({
      title: `MIDI ${match[1]}`,
      downloadUrl: `${BITMIDI_BASE}/uploads/${match[1]}.mid`,
      views: 0, plays: 0, source: 'BitMidi',
    });
  }

  // Try slug-style links if nothing found
  if (results.length === 0) {
    while ((match = slugRegex.exec(html)) !== null) {
      const text = match[2].trim();
      if (text && text.length > 2) {
        results.push({
          title: cleanTitle(text),
          downloadUrl: `${BITMIDI_BASE}/${match[1]}`,
          views: 0, plays: 0, source: 'BitMidi',
        });
      }
    }
  }

  return { results, totalResults };
}

/**
 * Clean up a MIDI filename into a readable title.
 */
function cleanTitle(filename: string): string {
  return filename
    .replace(/\.midi?$/i, '')     // Remove .mid extension
    .replace(/[-_]/g, ' ')        // Dashes/underscores → spaces
    .replace(/\s+/g, ' ')         // Collapse whitespace
    .trim();
}

/**
 * Download a MIDI file from a URL and return the ArrayBuffer.
 */
export async function downloadMidi(url: string): Promise<ArrayBuffer> {
  if (window.electronAPI?.proxyFetchBuffer) {
    return window.electronAPI.proxyFetchBuffer(url);
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: HTTP ${resp.status}`);
  return resp.arrayBuffer();
}
