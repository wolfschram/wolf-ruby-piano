import { Song, NoteEvent } from '../types';

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
  const bpm = 66;
  const b = beat(bpm);
  // Simplified opening theme — the harmonica melody
  const E4 = 64, D4 = 62, C4 = 60, B3 = 59, A3 = 57, G3 = 55;
  const E3 = 52, C3 = 48, G2 = 43;
  let t = 0;
  const notes: NoteEvent[] = [];
  // Right hand melody
  const rh: [number, number][] = [
    [E4, 3], [D4, 1], [C4, 2], [D4, 1], [E4, 3],
    [D4, 1], [C4, 2], [B3, 1], [A3, 4],
    [E4, 3], [D4, 1], [C4, 2], [D4, 1], [E4, 3],
    [D4, 1], [C4, 2], [B3, 1], [C4, 4],
  ];
  // Left hand chords (simple)
  const lh: [number, number][] = [
    [C3, 4], [G2, 4], [C3, 4], [G2, 4],
    [C3, 4], [G2, 4], [C3, 4], [G2, 4],
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
    id: 'morricone-west',
    title: 'Once Upon a Time in the West',
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
// EXPORT
// ============================================================

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

export default getBuiltInSongs;
