import { Song, NoteEvent } from '../types';
import { parseMidiBuffer } from '../engine/MidiParser';

/**
 * Built-in song library.
 * These songs are programmatically generated as NoteEvent arrays
 * so the app works without external MIDI files on first launch.
 *
 * MIDI files in src/songs/built-in/ can also be loaded and will
 * override these if present.
 */

// Helper: create a note event
function n(pitch: number, startTime: number, duration: number, hand: 'left' | 'right' = 'right'): NoteEvent {
  return { pitch, startTime, duration, hand, velocity: 90, noteName: '' };
}

// Timing helper: beat duration at given BPM
function beat(bpm: number): number {
  return 60000 / bpm;
}

// ============================================================
// RUBY MODE SONGS (Children's songs, simple melodies)
// ============================================================

function hotCrossBuns(): Song {
  const bpm = 100;
  const b = beat(bpm);
  // E D C (rest) E D C (rest) C C C C D D D D E D C
  // MIDI: E4=64, D4=62, C4=60
  const notes: NoteEvent[] = [
    n(64, 0, b),        n(62, b, b),        n(60, 2*b, 2*b),
    n(64, 4*b, b),      n(62, 5*b, b),      n(60, 6*b, 2*b),
    n(60, 8*b, b*0.5),  n(60, 8.5*b, b*0.5), n(60, 9*b, b*0.5), n(60, 9.5*b, b*0.5),
    n(62, 10*b, b*0.5), n(62, 10.5*b, b*0.5), n(62, 11*b, b*0.5), n(62, 11.5*b, b*0.5),
    n(64, 12*b, b),     n(62, 13*b, b),     n(60, 14*b, 2*b),
  ];
  return {
    id: 'hot-cross-buns',
    title: 'Hot Cross Buns',
    artist: 'Traditional',
    difficulty: 1,
    notes,
    durationMs: 16 * b,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

function maryHadALittleLamb(): Song {
  const bpm = 110;
  const b = beat(bpm);
  // E D C D E E E (rest) D D D (rest) E G G (rest) E D C D E E E E D D E D C
  const E = 64, D = 62, C = 60, G = 67;
  let t = 0;
  const notes: NoteEvent[] = [];
  const seq = [
    E, D, C, D, E, E, E, -1,
    D, D, D, -1,
    E, G, G, -1,
    E, D, C, D, E, E, E, E, D, D, E, D, C,
  ];
  for (const p of seq) {
    if (p === -1) { t += b; continue; }
    notes.push(n(p, t, b * 0.9));
    t += b;
  }
  return {
    id: 'mary-had-a-little-lamb',
    title: 'Mary Had a Little Lamb',
    artist: 'Traditional',
    difficulty: 2,
    notes,
    durationMs: t,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

function twinkleTwinkle(): Song {
  const bpm = 100;
  const b = beat(bpm);
  const C = 60, D = 62, E = 64, F = 65, G = 67, A = 69;
  let t = 0;
  const notes: NoteEvent[] = [];
  // C C G G A A G | F F E E D D C | G G F F E E D | G G F F E E D | C C G G A A G | F F E E D D C
  const melody = [
    C, C, G, G, A, A, [G, 2],
    F, F, E, E, D, D, [C, 2],
    G, G, F, F, E, E, [D, 2],
    G, G, F, F, E, E, [D, 2],
    C, C, G, G, A, A, [G, 2],
    F, F, E, E, D, D, [C, 2],
  ];
  for (const item of melody) {
    if (Array.isArray(item)) {
      notes.push(n(item[0], t, b * item[1] * 0.9));
      t += b * item[1];
    } else {
      notes.push(n(item, t, b * 0.9));
      t += b;
    }
  }
  return {
    id: 'twinkle-twinkle',
    title: 'Twinkle Twinkle Little Star',
    artist: 'Traditional',
    difficulty: 2,
    notes,
    durationMs: t,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

function odeToJoyEasy(): Song {
  const bpm = 108;
  const b = beat(bpm);
  const C = 60, D = 62, E = 64, F = 65, G = 67;
  let t = 0;
  const notes: NoteEvent[] = [];
  // Simplified: E E F G G F E D C C D E E D D
  const melody = [
    E, E, F, G, G, F, E, D,
    C, C, D, E, [E, 1.5], [D, 0.5], [D, 2],
    E, E, F, G, G, F, E, D,
    C, C, D, E, [D, 1.5], [C, 0.5], [C, 2],
  ];
  for (const item of melody) {
    if (Array.isArray(item)) {
      notes.push(n(item[0], t, b * item[1] * 0.9));
      t += b * item[1];
    } else {
      notes.push(n(item, t, b * 0.9));
      t += b;
    }
  }
  return {
    id: 'ode-to-joy-easy',
    title: 'Ode to Joy (Easy)',
    artist: 'Beethoven',
    difficulty: 2,
    notes,
    durationMs: t,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

function londonBridge(): Song {
  const bpm = 120;
  const b = beat(bpm);
  const C = 60, D = 62, E = 64, F = 65, G = 67, A = 69;
  let t = 0;
  const notes: NoteEvent[] = [];
  // G A G F E F G | D E F | E F G | G A G F E F G | D G E C
  const melody = [
    [G, 1.5], [A, 0.5], G, F, E, F, [G, 2],
    [D, 1], [E, 1], [F, 2],
    [E, 1], [F, 1], [G, 2],
    [G, 1.5], [A, 0.5], G, F, E, F, [G, 2],
    [D, 2], [G, 1], [E, 1], [C, 2],
  ];
  for (const item of melody) {
    if (Array.isArray(item)) {
      notes.push(n(item[0], t, b * item[1] * 0.9));
      t += b * item[1];
    } else {
      notes.push(n(item, t, b * 0.9));
      t += b;
    }
  }
  return {
    id: 'london-bridge',
    title: 'London Bridge',
    artist: 'Traditional',
    difficulty: 2,
    notes,
    durationMs: t,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

function jingleBellsEasy(): Song {
  const bpm = 120;
  const b = beat(bpm);
  const C = 60, D = 62, E = 64, F = 65, G = 67, A = 69;
  let t = 0;
  const notes: NoteEvent[] = [];
  // E E E | E E E | E G C D E | F F F F F E E E E D D E D G
  const melody = [
    E, E, [E, 2],
    E, E, [E, 2],
    E, G, C, [D, 0.5], [E, 2.5],
    F, F, F, [F, 0.5], F, E, E, [E, 0.5], E,
    D, D, E, [D, 2], [G, 2],
  ];
  for (const item of melody) {
    if (Array.isArray(item)) {
      notes.push(n(item[0], t, b * item[1] * 0.9));
      t += b * item[1];
    } else {
      notes.push(n(item, t, b * 0.9));
      t += b;
    }
  }
  return {
    id: 'jingle-bells-easy',
    title: 'Jingle Bells (Easy)',
    artist: 'Traditional',
    difficulty: 2,
    notes,
    durationMs: t,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'ruby',
  };
}

// ============================================================
// WOLF MODE SONGS (placeholder melodies — will be replaced
// with real MIDI files once downloaded)
// ============================================================

function onceUponATimeInTheWest(): Song {
  // Jill's Theme — D major, 3/4 time, ~56 BPM (slow, expressive)
  // The iconic main theme from C'era una volta il West (1968)
  // Based on published piano solo arrangements (key of D major)
  const bpm = 56;
  const b = beat(bpm);

  // Note constants
  const D3 = 50, E3 = 52, Fs3 = 54, G3 = 55, A3 = 57, B3 = 59;
  const Cs4 = 61, D4 = 62, E4 = 64, Fs4 = 66, G4 = 67, A4 = 69, B4 = 71;
  const Cs5 = 73, D5 = 74, E5 = 76, Fs5 = 78;
  const D2 = 38, A2 = 45, G2 = 43, Fs2 = 42;

  const notes: NoteEvent[] = [];

  // === INTRODUCTION — Harpsichord-like descending figure ===
  // Measures 1-4: Gentle two-note descending motif (D-C#, B-A pattern)
  // This is the signature opening played by harpsichord + vibraphone
  let rt = 0;

  // Intro phrase 1: D5-C#5, C#5-E5, B4-D5, A4-C#5 (paired notes, 3/4 time)
  const introRH: [number, number][] = [
    [D5, 1.5], [Fs5, 1.5],   // m1: harpsichord thirds
    [Cs5, 0.75], [E5, 0.75], [Cs5, 1.5], [E5, 1.5],  // m2
    [B4, 0.75], [D5, 0.75], [B4, 1.5], [D5, 1.5],    // m3
    [A4, 0.75], [Cs5, 0.75], [Cs5, 1.5], [E5, 1.5],  // m4
    [B4, 0.75], [D5, 0.75], [B4, 1.5], [D5, 1.5],    // m5
    [A4, 0.75], [Cs5, 0.75], [A4, 3],                 // m6
  ];

  for (const [pitch, dur] of introRH) {
    notes.push(n(pitch, rt, b * dur * 0.85, 'right'));
    rt += b * dur;
  }

  // Intro left hand: sustained D pedal
  let lt = 0;
  const introLH: [number, number][] = [
    [D3, 3], [A3, 3],   // m1-2
    [D3, 3], [A3, 3],   // m3-4
    [D3, 3], [A3, 3],   // m5-6
  ];
  for (const [pitch, dur] of introLH) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }

  // === MAIN THEME (Jill's Theme) — Sweeping melody ===
  // The soaring soprano melody that enters after the intro
  // ABAA structure. Key of D major.
  const themeStart = rt; // Start after intro

  // Section A: The main ascending melody
  // F#4 - A4 - B4 - D5 ... the yearning upward reach
  const melodyA: [number, number][] = [
    [Fs4, 1], [A4, 1], [B4, 1],         // pickup: F#-A-B
    [D5, 2], [Cs5, 1],                   // D (held) - C#
    [B4, 1], [A4, 0.5], [B4, 0.5], [Cs5, 1],  // B-A-B-C#
    [D5, 3],                             // D (held, resolving)
    [Cs5, 1], [B4, 1], [A4, 1],         // descending: C#-B-A
    [Fs4, 2], [E4, 1],                  // F#-E
    [D4, 3],                             // D (home)
  ];

  let mt = themeStart;
  for (const [pitch, dur] of melodyA) {
    notes.push(n(pitch, mt, b * dur * 0.9, 'right'));
    mt += b * dur;
  }

  // Section B: Contrasting phrase — reaches higher
  const melodyB: [number, number][] = [
    [E4, 1], [Fs4, 1], [A4, 1],         // pickup: E-F#-A
    [B4, 2], [A4, 1],                    // B-A
    [Fs4, 1.5], [G4, 1.5],              // F#-G
    [A4, 3],                             // A (held)
    [B4, 1], [Cs5, 1], [D5, 1],         // ascending: B-C#-D
    [E5, 2], [D5, 1],                   // E-D
    [Cs5, 1], [B4, 1], [A4, 1],         // descending
  ];

  for (const [pitch, dur] of melodyB) {
    notes.push(n(pitch, mt, b * dur * 0.9, 'right'));
    mt += b * dur;
  }

  // Section A return (abbreviated)
  const melodyA2: [number, number][] = [
    [Fs4, 1], [A4, 1], [B4, 1],
    [D5, 2], [Cs5, 1],
    [B4, 1], [A4, 0.5], [B4, 0.5], [Cs5, 1],
    [D5, 4],                             // Final D, held long
  ];

  for (const [pitch, dur] of melodyA2) {
    notes.push(n(pitch, mt, b * dur * 0.9, 'right'));
    mt += b * dur;
  }

  // === Main theme LEFT HAND — Chord accompaniment ===
  // D major, G major, A major bass movement
  let ct = themeStart;
  const chordsLH: [number, number][] = [
    // Section A chords
    [D3, 3], [D3, 3],                   // D pedal
    [G3, 3], [A3, 3],                   // G - A
    [D3, 3], [D3, 3],                   // D pedal
    [A3, 3], [D3, 3],                   // A - D
    // Section B chords
    [G3, 3], [G3, 3],                   // G pedal
    [D3, 3], [A3, 3],                   // D - A
    [G3, 3], [E3, 3],                   // G - Em
    [A3, 3],                            // A (dominant)
    // Section A2 chords
    [D3, 3], [D3, 3],
    [G3, 3], [A3, 3],
    [D3, 4],                            // Final D
  ];

  for (const [pitch, dur] of chordsLH) {
    notes.push(n(pitch, ct, b * dur * 0.9, 'left'));
    ct += b * dur;
  }

  notes.sort((a, b) => a.startTime - b.startTime);

  const endTime = Math.max(mt, ct);

  return {
    id: 'morricone-west',
    title: 'Once Upon a Time in the West',
    artist: 'Ennio Morricone',
    difficulty: 3,
    notes,
    durationMs: endTime,
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

function deborahsTheme(): Song {
  const bpm = 72;
  const b = beat(bpm);
  const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72;
  const A3 = 57, E3 = 52, C3 = 48;
  let t = 0;
  const notes: NoteEvent[] = [];

  // Opening melody (simplified piano arrangement)
  const rh: [number, number][] = [
    [E4, 2], [G4, 1], [A4, 3], [G4, 1], [E4, 1],
    [F4, 2], [E4, 1], [D4, 3], [C4, 1], [D4, 1],
    [E4, 2], [G4, 1], [A4, 3], [B4, 1], [C5, 1],
    [B4, 2], [A4, 1], [G4, 4],
  ];
  const lh: [number, number][] = [
    [A3, 4], [E3, 4], [A3, 4], [C3, 4],
    [A3, 4], [E3, 4], [A3, 4], [E3, 4],
  ];

  let rt = 0;
  for (const [pitch, dur] of rh) {
    notes.push(n(pitch, rt, b * dur * 0.9, 'right'));
    rt += b * dur;
  }
  let lt = 0;
  for (const [pitch, dur] of lh) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }

  notes.sort((a, b) => a.startTime - b.startTime);

  return {
    id: 'morricone-america',
    title: "Deborah's Theme (Once Upon a Time in America)",
    artist: 'Ennio Morricone',
    difficulty: 3,
    notes,
    durationMs: Math.max(rt, lt),
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

function cinemaParadiso(): Song {
  const bpm = 80;
  const b = beat(bpm);
  const C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, Bb4 = 70;
  const F3 = 53, C3 = 48, Bb2 = 46;
  let t = 0;
  const notes: NoteEvent[] = [];

  const rh: [number, number][] = [
    [F4, 1], [A4, 1], [G4, 2], [F4, 1], [E4, 1], [D4, 1], [C4, 1],
    [F4, 1], [A4, 1], [Bb4, 2], [A4, 1], [G4, 1], [F4, 2],
    [G4, 1], [A4, 1], [G4, 2], [F4, 1], [E4, 1], [D4, 1], [C4, 1],
    [D4, 2], [E4, 1], [F4, 4],
  ];
  const lh: [number, number][] = [
    [F3, 4], [C3, 4], [Bb2, 4], [F3, 4],
    [F3, 4], [C3, 4], [Bb2, 4], [F3, 4],
  ];

  let rt = 0;
  for (const [pitch, dur] of rh) {
    notes.push(n(pitch, rt, b * dur * 0.9, 'right'));
    rt += b * dur;
  }
  let lt = 0;
  for (const [pitch, dur] of lh) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }
  notes.sort((a, b) => a.startTime - b.startTime);

  return {
    id: 'morricone-cinema-paradiso',
    title: 'Cinema Paradiso (Love Theme)',
    artist: 'Ennio Morricone',
    difficulty: 3,
    notes,
    durationMs: Math.max(rt, lt),
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

function ecstasyOfGold(): Song {
  const bpm = 108;
  const b = beat(bpm);
  const E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71, C5 = 72, D5 = 74, E5 = 76;
  const E3 = 52, B2 = 47, A2 = 45;
  const notes: NoteEvent[] = [];

  const rh: [number, number][] = [
    [E4, 1], [G4, 1], [B4, 1], [E5, 2], [D5, 1], [B4, 1], [A4, 1],
    [G4, 2], [A4, 1], [B4, 2], [G4, 1], [E4, 2],
    [E4, 1], [G4, 1], [B4, 1], [E5, 2], [D5, 1], [C5, 1], [B4, 1],
    [A4, 4],
  ];
  const lh: [number, number][] = [
    [E3, 4], [B2, 4], [A2, 4], [E3, 4],
    [E3, 4], [B2, 4], [A2, 4], [E3, 4],
  ];

  let rt = 0;
  for (const [pitch, dur] of rh) {
    notes.push(n(pitch, rt, b * dur * 0.9, 'right'));
    rt += b * dur;
  }
  let lt = 0;
  for (const [pitch, dur] of lh) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }
  notes.sort((a, b) => a.startTime - b.startTime);

  return {
    id: 'morricone-ecstasy-of-gold',
    title: 'The Ecstasy of Gold',
    artist: 'Ennio Morricone',
    difficulty: 4,
    notes,
    durationMs: Math.max(rt, lt),
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

function riverFlowsInYou(): Song {
  const bpm = 68;
  const b = beat(bpm);
  const A3 = 57, B3 = 59, C4 = 60, D4 = 62, E4 = 64, F4 = 65, G4 = 67, A4 = 69, B4 = 71;
  const A2 = 45, E2 = 40, D2 = 38;
  const notes: NoteEvent[] = [];

  const rh: [number, number][] = [
    [A4, 0.5], [B4, 0.5], [A4, 0.5], [E4, 0.5], [A4, 0.5], [B4, 0.5], [A4, 0.5], [E4, 0.5],
    [G4, 0.5], [A4, 0.5], [G4, 0.5], [E4, 0.5], [G4, 0.5], [A4, 0.5], [G4, 0.5], [E4, 0.5],
    [F4, 0.5], [G4, 0.5], [F4, 0.5], [D4, 0.5], [E4, 2],
    [A4, 0.5], [B4, 0.5], [A4, 0.5], [E4, 0.5], [A4, 0.5], [B4, 0.5], [A4, 0.5], [E4, 0.5],
    [G4, 1], [A4, 1], [B4, 2],
  ];
  const lh: [number, number][] = [
    [A2, 4], [E2, 4], [D2, 4], [A2, 4], [E2, 4],
  ];

  let rt = 0;
  for (const [pitch, dur] of rh) {
    notes.push(n(pitch, rt, b * dur * 0.9, 'right'));
    rt += b * dur;
  }
  let lt = 0;
  for (const [pitch, dur] of lh) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }
  notes.sort((a, b) => a.startTime - b.startTime);

  return {
    id: 'river-flows-in-you',
    title: 'River Flows in You',
    artist: 'Yiruma',
    difficulty: 3,
    notes,
    durationMs: Math.max(rt, lt),
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

function moonlightSonataSimplified(): Song {
  const bpm = 54;
  const b = beat(bpm);
  // Simplified first movement — the famous triplet pattern
  const Gs3 = 56, Cs4 = 61, E4 = 64, Gs4 = 68, Cs5 = 73;
  const Cs3 = 49, Cs2 = 37;
  const notes: NoteEvent[] = [];

  // Arpeggiated triplets (right hand)
  const tripletDur = b / 3;
  let rt = 0;
  const patterns: number[][] = [
    [Gs3, Cs4, E4], [Gs3, Cs4, E4], [Gs3, Cs4, E4], [Gs3, Cs4, E4],
    [Gs3, Cs4, E4], [Gs3, Cs4, E4], [Gs3, Cs4, E4], [Gs3, Cs4, E4],
  ];
  for (const pattern of patterns) {
    for (const pitch of pattern) {
      notes.push(n(pitch, rt, tripletDur * 0.9, 'right'));
      rt += tripletDur;
    }
  }

  // Bass (left hand)
  let lt = 0;
  const bass: [number, number][] = [
    [Cs2, 4], [Cs3, 4], [Cs2, 4], [Cs3, 4],
  ];
  for (const [pitch, dur] of bass) {
    notes.push(n(pitch, lt, b * dur * 0.9, 'left'));
    lt += b * dur;
  }

  notes.sort((a, b) => a.startTime - b.startTime);

  return {
    id: 'moonlight-sonata-simplified',
    title: 'Moonlight Sonata (Simplified)',
    artist: 'Beethoven',
    difficulty: 4,
    notes,
    durationMs: Math.max(rt, lt),
    bpm,
    source: 'built-in',
    filePath: '',
    category: 'wolf',
  };
}

// ============================================================
// MIDI FILE MANIFEST — real .mid files in public/midi/
// ============================================================

interface MidiFileEntry {
  filename: string;
  title: string;
  artist: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: 'wolf' | 'ruby';
}

const MIDI_FILES: MidiFileEntry[] = [
  // Ruby (children's — real MIDI arrangements)
  { filename: 'hot-cross-buns.mid', title: 'Hot Cross Buns', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'twinkle-twinkle.mid', title: 'Twinkle Twinkle Little Star', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'mary-had-a-little-lamb.mid', title: 'Mary Had a Little Lamb', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'baa-baa-black-sheep-midi.mid', title: 'Baa Baa Black Sheep', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'row-row-row-your-boat-midi.mid', title: 'Row Row Row Your Boat', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'old-macdonald-had-a-farm-midi.mid', title: 'Old MacDonald Had a Farm', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'wheels-on-the-bus-midi.mid', title: 'The Wheels on the Bus', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'pop-goes-the-weasel-midi.mid', title: 'Pop Goes the Weasel', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'humpty-dumpty-midi.mid', title: 'Humpty Dumpty', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'happy-birthday-piano-easy.mid', title: 'Happy Birthday', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'ode-to-joy-easy.mid', title: 'Ode to Joy', artist: 'Beethoven', difficulty: 2, category: 'ruby' },
  { filename: 'jingle-bells.mid', title: 'Jingle Bells', artist: 'Traditional', difficulty: 2, category: 'ruby' },
  { filename: 'abc-alphabet-song-midi.mid', title: 'ABC Song', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'head-shoulders-knees-toes-midi.mid', title: 'Head Shoulders Knees & Toes', artist: 'Traditional', difficulty: 1, category: 'ruby' },
  { filename: 'brahms-lullaby-piano-midi.mid', title: "Brahms' Lullaby", artist: 'Johannes Brahms', difficulty: 2, category: 'ruby' },
  { filename: 'yankee-doodle-midi.mid', title: 'Yankee Doodle', artist: 'Traditional', difficulty: 2, category: 'ruby' },

  // Wolf (film scores + classical — real MIDI arrangements)
  { filename: 'morricone-west.mid', title: 'Once Upon a Time in the West', artist: 'Ennio Morricone', difficulty: 3, category: 'wolf' },
  { filename: 'cinema-paradiso-morricone-piano.mid', title: 'Cinema Paradiso', artist: 'Ennio Morricone', difficulty: 3, category: 'wolf' },
  { filename: 'ecstasy-of-gold.mid', title: 'The Ecstasy of Gold', artist: 'Ennio Morricone', difficulty: 4, category: 'wolf' },
  { filename: 'gabriels-oboe-morricone.mid', title: "Gabriel's Oboe", artist: 'Ennio Morricone', difficulty: 3, category: 'wolf' },
  { filename: 'schindlers-list-piano.mid', title: "Schindler's List Theme", artist: 'John Williams', difficulty: 3, category: 'wolf' },
  { filename: 'fur-elise-beethoven-piano.mid', title: 'Für Elise', artist: 'Beethoven', difficulty: 3, category: 'wolf' },
  { filename: 'moonlight-sonata.mid', title: 'Moonlight Sonata', artist: 'Beethoven', difficulty: 4, category: 'wolf' },
  { filename: 'river-flows-in-you.mid', title: 'River Flows in You', artist: 'Yiruma', difficulty: 3, category: 'wolf' },
  { filename: 'clair-de-lune-debussy.mid', title: 'Clair de Lune', artist: 'Claude Debussy', difficulty: 4, category: 'wolf' },
  { filename: 'gymnopedie-satie.mid', title: 'Gymnopédie No.1', artist: 'Erik Satie', difficulty: 2, category: 'wolf' },
  { filename: 'chopin-nocturne-op9.mid', title: 'Nocturne Op.9 No.2', artist: 'Frédéric Chopin', difficulty: 4, category: 'wolf' },
  { filename: 'gladiator-now-we-are-free.mid', title: 'Now We Are Free (Gladiator)', artist: 'Hans Zimmer', difficulty: 3, category: 'wolf' },
  { filename: 'godfather-waltz-piano-midi.mid', title: 'The Godfather Waltz', artist: 'Nino Rota', difficulty: 3, category: 'wolf' },
  { filename: 'morricone-westerns-medley.mid', title: 'Morricone Westerns Medley', artist: 'Ennio Morricone', difficulty: 4, category: 'wolf' },
];

// ============================================================
// EXPORT
// ============================================================

/**
 * Synchronous fallback — returns the 12 hand-coded starter songs.
 * These load instantly so the app always has content on first render.
 */
export function getBuiltInSongs(): Song[] {
  return [
    // Ruby songs (children's)
    hotCrossBuns(),
    maryHadALittleLamb(),
    twinkleTwinkle(),
    odeToJoyEasy(),
    londonBridge(),
    jingleBellsEasy(),
    // Wolf songs (film scores + classical)
    onceUponATimeInTheWest(),
    deborahsTheme(),
    cinemaParadiso(),
    ecstasyOfGold(),
    riverFlowsInYou(),
    moonlightSonataSimplified(),
  ];
}

/**
 * Async loader — fetches real MIDI files from public/midi/.
 * Returns full-length, musically accurate arrangements.
 * Errors on individual files are logged but don't break the load.
 */
export async function loadMidiLibrary(): Promise<Song[]> {
  const songs: Song[] = [];

  for (const entry of MIDI_FILES) {
    try {
      const resp = await fetch(`/midi/${entry.filename}`);
      if (!resp.ok) {
        console.warn(`[MidiLibrary] ${entry.filename}: HTTP ${resp.status}`);
        continue;
      }
      const buffer = await resp.arrayBuffer();
      if (buffer.byteLength < 14) {
        console.warn(`[MidiLibrary] ${entry.filename}: too small (${buffer.byteLength} bytes)`);
        continue;
      }

      // Validate MThd header — reject HTML 404 pages served by Vite
      const header = new Uint8Array(buffer, 0, 4);
      const headerStr = String.fromCharCode(header[0], header[1], header[2], header[3]);
      if (headerStr !== 'MThd') {
        console.warn(`[MidiLibrary] ${entry.filename}: not a MIDI file (header: ${headerStr})`);
        continue;
      }

      const song = parseMidiBuffer(buffer, {
        title: entry.title,
        artist: entry.artist,
        source: 'built-in',
        filePath: entry.filename,
      });

      song.id = `midi-${entry.filename.replace('.mid', '')}`;
      song.difficulty = entry.difficulty;
      song.category = entry.category;

      // Cap notes at 3000 to prevent renderer freeze on orchestral MIDI files
      if (song.notes.length > 3000) {
        console.warn(`[MidiLibrary] ${entry.filename}: ${song.notes.length} notes, capping at 3000`);
        song.notes = song.notes.slice(0, 3000);
        // Recalculate duration after capping
        let maxEnd = 0;
        for (const n of song.notes) {
          const end = n.startTime + n.duration;
          if (end > maxEnd) maxEnd = end;
        }
        song.durationMs = maxEnd;
      }

      if (song.notes.length === 0) {
        console.warn(`[MidiLibrary] ${entry.filename}: 0 playable notes, skipping`);
        continue;
      }

      // Skip orchestral reductions that have hand-coded piano arrangements.
      // The hand-coded versions are musically accurate; orchestral MIDI files
      // dumped through track selection are not proper piano arrangements.
      if (song.orchestralReduction) {
        const handCodedIds = ['morricone-west', 'morricone-america', 'morricone-cinema-paradiso', 'morricone-ecstasy-of-gold'];
        const matchesHandCoded = handCodedIds.some(id =>
          entry.filename.includes(id.replace('morricone-', ''))
        );
        if (matchesHandCoded) {
          console.log(`[MidiLibrary] ${entry.filename}: orchestral MIDI, keeping hand-coded piano arrangement instead`);
          continue;
        }
        console.warn(`[MidiLibrary] ${entry.filename}: orchestral reduction (${song.notes.length} notes from selected tracks)`);
      }

      songs.push(song);
    } catch (err) {
      console.warn(`[MidiLibrary] Error loading ${entry.filename}:`, err);
    }
  }

  console.log(`[MidiLibrary] Loaded ${songs.length}/${MIDI_FILES.length} MIDI songs`);
  return songs;
}

export default getBuiltInSongs;
