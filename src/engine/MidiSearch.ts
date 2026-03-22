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

  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Search failed: HTTP ${resp.status}`);
  }

  const html = await resp.text();
  return parseBitmidiResults(html);
}

/**
 * Parse BitMidi search result HTML into structured results.
 */
function parseBitmidiResults(html: string): {
  results: MidiSearchResult[];
  totalResults: number;
} {
  const results: MidiSearchResult[] = [];

  // Extract total result count — look for pattern like "444 results"
  let totalResults = 0;
  const totalMatch = html.match(/(\d[\d,]*)\s+results?/i);
  if (totalMatch) {
    totalResults = parseInt(totalMatch[1].replace(/,/g, ''), 10);
  }

  // Extract download links — pattern: /uploads/XXXXX.mid
  // Each result has a title (filename) and a download link
  // BitMidi HTML structure: links with href containing "/uploads/" and filenames as text

  // Strategy: find all /uploads/XXXXX.mid patterns and their associated titles
  // The page has patterns like: href="/some-slug-mid" with text being the filename
  // and href="/uploads/XXXXX.mid" as download links

  // Extract all upload links with their IDs
  const uploadRegex = /href="\/uploads\/(\d+)\.mid"/g;
  const uploadIds: string[] = [];
  let match;
  while ((match = uploadRegex.exec(html)) !== null) {
    uploadIds.push(match[1]);
  }

  // Extract titles — they appear as text in anchor tags near the results
  // BitMidi uses slugified filenames in URLs like /some-song-name-mid
  // The actual displayed text is the original filename
  // Pattern: class contains "Midi" or the text ends with .mid
  const titleRegex = /class="[^"]*"[^>]*>([^<]*\.mid)<\/a>/gi;
  const titles: string[] = [];
  while ((match = titleRegex.exec(html)) !== null) {
    titles.push(match[1]);
  }

  // If title extraction didn't work, try alternative patterns
  if (titles.length === 0) {
    // Try extracting from slug URLs: href="/some-file-name-mid"
    const slugRegex = /href="\/([a-z0-9][a-z0-9\-]*-mid)"[^>]*>([^<]+)</gi;
    while ((match = slugRegex.exec(html)) !== null) {
      const text = match[2].trim();
      if (text && !text.includes('<') && text.length > 2) {
        titles.push(text);
      }
    }
  }

  // Extract view/play counts — patterns like "24,374 views" and "6,249 plays"
  // These appear in spans near each result
  const statsRegex = /([\d,]+)\s+views?\s*[^]*?([\d,]+)\s+plays?/gi;
  const stats: Array<{ views: number; plays: number }> = [];
  while ((match = statsRegex.exec(html)) !== null) {
    stats.push({
      views: parseInt(match[1].replace(/,/g, ''), 10),
      plays: parseInt(match[2].replace(/,/g, ''), 10),
    });
  }

  // Build results by matching upload IDs with titles
  const count = Math.max(uploadIds.length, titles.length);
  for (let i = 0; i < count; i++) {
    const uploadId = uploadIds[i];
    if (!uploadId) continue;

    const title = titles[i]
      ? cleanTitle(titles[i])
      : `MIDI ${uploadId}`;

    results.push({
      title,
      downloadUrl: `${BITMIDI_BASE}/uploads/${uploadId}.mid`,
      views: stats[i]?.views ?? 0,
      plays: stats[i]?.plays ?? 0,
      source: 'BitMidi',
    });
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
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Download failed: HTTP ${resp.status}`);
  }
  return resp.arrayBuffer();
}
