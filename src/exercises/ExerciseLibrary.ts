import { NoteEvent, Song } from '../types';

export interface Exercise {
  id: string;
  title: string;
  category: ExerciseCategory;
  subcategory: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  mode: 'wolf' | 'ruby' | 'both';
  description: string;        // What this exercise trains
  technique: string;           // Proper technique tips
  commonMistakes: string;      // What to avoid
  fingerInfo?: string;         // Which fingers to use and starting position
  bpm: number;
  notes: NoteEvent[];
  durationMs: number;
}

/**
 * Detect which hand(s) an exercise uses from its note data.
 */
export function getExerciseHand(exercise: Exercise): 'left' | 'right' | 'both' {
  const hands = new Set(exercise.notes.map(n => n.hand));
  if (hands.has('left') && hands.has('right')) return 'both';
  if (hands.has('left')) return 'left';
  return 'right';
}

export type ExerciseCategory =
  | 'finger-independence'
  | 'two-hand-coordination'
  | 'rhythm'
  | 'scales'
  | 'finger-strength'
  | 'five-finger-patterns';

/**
 * Helper to create a note event
 */
function createNote(
  pitch: number,
  startTime: number,
  duration: number,
  hand: 'left' | 'right',
  velocity: number = 80
): NoteEvent {
  return { pitch, startTime, duration, hand, velocity };
}

/**
 * WOLF exercises — adult learner, ADHD/dyslexia friendly, short focused drills
 */
const WOLF_EXERCISES: Exercise[] = [
  // ============================================================
  // Finger Independence (Hanon-style)
  // ============================================================
  {
    id: 'wolf-hanon-01',
    title: 'Hanon #1 — The Classic',
    category: 'finger-independence',
    subcategory: 'ascending-patterns',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Classic Hanon exercise 1: C-E-F-G-A ascending pattern. Builds independent finger control and agility. This is the foundational finger independence drill.',
    technique:
      'Keep wrist flat and relaxed. Let each finger strike independently without moving others. Start slowly and focus on even tone and timing. Fingers should move from the knuckles, not the wrist.',
    commonMistakes:
      'Moving the wrist along with fingers, varying velocity between notes, holding down previous notes while playing new ones.',
    fingerInfo: 'RH: Thumb(1) on C, fingers 1-3-4-5 pattern ascending. LH: Pinky(5) on C, fingers 5-3-2-1 pattern ascending. Start with curved fingers, knuckles high.',
    bpm: 72,
    durationMs: 10000,
    notes: [
      // Right hand: C-E-F-G-A ascending, 4 octaves, quarter notes
      createNote(60, 0, 250, 'right'),      // C4
      createNote(64, 250, 250, 'right'),    // E4
      createNote(65, 500, 250, 'right'),    // F4
      createNote(67, 750, 250, 'right'),    // G4
      createNote(69, 1000, 250, 'right'),   // A4
      createNote(65, 1250, 250, 'right'),   // F4 (step back down)
      createNote(64, 1500, 250, 'right'),   // E4
      createNote(62, 1750, 250, 'right'),   // D4
      createNote(60, 2000, 250, 'right'),   // C4
      // Left hand: same pattern, offset by 2.5 seconds
      createNote(48, 2500, 250, 'left'),    // C3
      createNote(52, 2750, 250, 'left'),    // E3
      createNote(53, 3000, 250, 'left'),    // F3
      createNote(55, 3250, 250, 'left'),    // G3
      createNote(57, 3500, 250, 'left'),    // A3
      createNote(53, 3750, 250, 'left'),    // F3
      createNote(52, 4000, 250, 'left'),    // E3
      createNote(50, 4250, 250, 'left'),    // D3
      createNote(48, 4500, 250, 'left'),    // C3
      // Both hands together
      createNote(60, 5000, 250, 'right'),   // C4
      createNote(48, 5000, 250, 'left'),    // C3
      createNote(64, 5250, 250, 'right'),   // E4
      createNote(52, 5250, 250, 'left'),    // E3
      createNote(65, 5500, 250, 'right'),   // F4
      createNote(53, 5500, 250, 'left'),    // F3
      createNote(67, 5750, 250, 'right'),   // G4
      createNote(55, 5750, 250, 'left'),    // G3
      createNote(69, 6000, 250, 'right'),   // A4
      createNote(57, 6000, 250, 'left'),    // A3
      createNote(65, 6250, 250, 'right'),   // F4
      createNote(53, 6250, 250, 'left'),    // F3
      createNote(64, 6500, 250, 'right'),   // E4
      createNote(52, 6500, 250, 'left'),    // E3
      createNote(62, 6750, 250, 'right'),   // D4
      createNote(50, 6750, 250, 'left'),    // D3
      createNote(60, 7000, 250, 'right'),   // C4
      createNote(48, 7000, 250, 'left'),    // C3
    ],
  },
  {
    id: 'wolf-hanon-02',
    title: 'Hanon #2 — Stretch Builder',
    category: 'finger-independence',
    subcategory: 'ascending-patterns',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Hanon variation with longer pattern: C-E-D-F-E-G. Stretches finger reach while building independence. Great for overcoming finger stiffness.',
    technique:
      'Maintain relaxed shoulders. Let fingers stretch naturally without tension. Keep hand in neutral position. Move only the fingers needed for each note.',
    commonMistakes:
      'Tensing shoulders, reaching with the wrist, uneven spacing, rushing the pattern.',
    fingerInfo: 'RH: Thumb(1) on C, ascending pattern 1-2-3-4-5. LH: Pinky(5) on C, ascending 5-4-3-2-1. Focus on ring finger (4) independence.',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // Right hand: C-E-D-F-E-G pattern, 3 repetitions
      createNote(60, 0, 250, 'right'),      // C4
      createNote(64, 250, 250, 'right'),    // E4
      createNote(62, 500, 250, 'right'),    // D4
      createNote(65, 750, 250, 'right'),    // F4
      createNote(64, 1000, 250, 'right'),   // E4
      createNote(67, 1250, 250, 'right'),   // G4
      createNote(62, 1500, 250, 'right'),   // D4 (descending)
      createNote(60, 1750, 250, 'right'),   // C4
      // Repeat for left hand
      createNote(48, 2500, 250, 'left'),    // C3
      createNote(52, 2750, 250, 'left'),    // E3
      createNote(50, 3000, 250, 'left'),    // D3
      createNote(53, 3250, 250, 'left'),    // F3
      createNote(52, 3500, 250, 'left'),    // E3
      createNote(55, 3750, 250, 'left'),    // G3
      createNote(50, 4000, 250, 'left'),    // D3
      createNote(48, 4250, 250, 'left'),    // C3
      // Both hands together
      createNote(60, 5000, 250, 'right'),   // C4
      createNote(48, 5000, 250, 'left'),    // C3
      createNote(64, 5250, 250, 'right'),   // E4
      createNote(52, 5250, 250, 'left'),    // E3
      createNote(62, 5500, 250, 'right'),   // D4
      createNote(50, 5500, 250, 'left'),    // D3
      createNote(65, 5750, 250, 'right'),   // F4
      createNote(53, 5750, 250, 'left'),    // F3
      createNote(64, 6000, 250, 'right'),   // E4
      createNote(52, 6000, 250, 'left'),    // E3
      createNote(67, 6250, 250, 'right'),   // G4
      createNote(55, 6250, 250, 'left'),    // G3
    ],
  },
  {
    id: 'wolf-finger-isolation',
    title: 'Finger Isolation: 3-4-5',
    category: 'finger-independence',
    subcategory: 'weak-fingers',
    difficulty: 3,
    mode: 'wolf',
    description:
      'Focuses on ring (3) and pinky (5) fingers, the weakest fingers. Play each individually on a single key repeatedly, building isolated strength and control.',
    technique:
      'Anchor the hand with fingers 1 and 2. Lift and strike only the target finger (3, 4, or 5). Keep motion controlled and isolated to prevent neighboring fingers from moving.',
    commonMistakes:
      'Lifting adjacent fingers, inconsistent pressure, moving the wrist, going too fast.',
    fingerInfo: 'RH only. Thumb(1) on C4, one finger at a time: hold all 5 fingers on C-D-E-F-G, lift and play only the target finger. Tests true isolation.',
    bpm: 60,
    durationMs: 9000,
    notes: [
      // Right hand: Finger 3 (middle) on E4, 8 times
      createNote(64, 0, 300, 'right'),      // E4 — Finger 3
      createNote(64, 300, 300, 'right'),
      createNote(64, 600, 300, 'right'),
      createNote(64, 900, 300, 'right'),
      createNote(64, 1200, 300, 'right'),
      createNote(64, 1500, 300, 'right'),
      createNote(64, 1800, 300, 'right'),
      createNote(64, 2100, 300, 'right'),
      // Finger 4 (ring) on F4, 8 times
      createNote(65, 2500, 300, 'right'),   // F4 — Finger 4
      createNote(65, 2800, 300, 'right'),
      createNote(65, 3100, 300, 'right'),
      createNote(65, 3400, 300, 'right'),
      createNote(65, 3700, 300, 'right'),
      createNote(65, 4000, 300, 'right'),
      createNote(65, 4300, 300, 'right'),
      createNote(65, 4600, 300, 'right'),
      // Finger 5 (pinky) on G4, 8 times
      createNote(67, 5000, 300, 'right'),   // G4 — Finger 5
      createNote(67, 5300, 300, 'right'),
      createNote(67, 5600, 300, 'right'),
      createNote(67, 5900, 300, 'right'),
      createNote(67, 6200, 300, 'right'),
      createNote(67, 6500, 300, 'right'),
      createNote(67, 6800, 300, 'right'),
      createNote(67, 7100, 300, 'right'),
    ],
  },

  // ============================================================
  // Two-Hand Coordination
  // ============================================================
  {
    id: 'wolf-contrary-motion',
    title: 'Contrary Motion — C Major',
    category: 'two-hand-coordination',
    subcategory: 'opposite-directions',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Both hands play C major scale moving in opposite directions simultaneously. Trains independent hand control and brain hemispheric balance.',
    technique:
      'Start at C. Right hand goes up, left goes down. Maintain same tempo in both hands. Keep hands at mirror distance apart.',
    commonMistakes:
      'One hand faster than the other, losing the mirror symmetry, tensing arms.',
    fingerInfo: 'Both hands start on middle C. RH: Thumb(1) on C ascending. LH: Thumb(1) on C descending. Hands mirror outward from center.',
    bpm: 60,
    durationMs: 8000,
    notes: [
      // Ascending (RH): C D E F G, Descending (LH): C B A G
      createNote(60, 0, 400, 'right'),      // C4 (RH up)
      createNote(48, 0, 400, 'left'),       // C3 (LH down)
      createNote(62, 400, 400, 'right'),    // D4
      createNote(47, 400, 400, 'left'),     // B2
      createNote(64, 800, 400, 'right'),    // E4
      createNote(45, 800, 400, 'left'),     // A2
      createNote(65, 1200, 400, 'right'),   // F4
      createNote(43, 1200, 400, 'left'),    // G2
      createNote(67, 1600, 400, 'right'),   // G4
      createNote(43, 1600, 400, 'left'),    // G2
      // Descend to start
      createNote(65, 2000, 400, 'right'),   // F4
      createNote(45, 2000, 400, 'left'),    // A2
      createNote(64, 2400, 400, 'right'),   // E4
      createNote(47, 2400, 400, 'left'),    // B2
      createNote(62, 2800, 400, 'right'),   // D4
      createNote(48, 2800, 400, 'left'),    // C3
      createNote(60, 3200, 400, 'right'),   // C4
      createNote(48, 3200, 400, 'left'),    // C3
    ],
  },
  {
    id: 'wolf-melody-chords',
    title: 'Right Melody, Left Chords',
    category: 'two-hand-coordination',
    subcategory: 'harmonic-support',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Right hand plays simple melody while left hand holds whole-note chords beneath. Develops rhythm independence and chord awareness.',
    technique:
      'LH chords sustained for full measure. RH melody moves independently above. Focus on smooth LH chord changes without lifting between them.',
    commonMistakes:
      'RH rushing ahead, LH chords stopping too early, accidental RH disruption of chord continuity.',
    fingerInfo: 'RH melody: Thumb(1) on C4, fingers 1-2-3-4-5. LH chords: Pinky(5)-Middle(3)-Thumb(1) on C-E-G chord.',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // Left hand: C major chord (C-E-G), whole note (4000ms each)
      createNote(48, 0, 4000, 'left'),      // C3
      createNote(52, 0, 4000, 'left'),      // E3
      createNote(55, 0, 4000, 'left'),      // G3
      // Right hand melody: C-D-E-F-G (quarter notes)
      createNote(60, 0, 250, 'right'),      // C4
      createNote(62, 250, 250, 'right'),    // D4
      createNote(64, 500, 250, 'right'),    // E4
      createNote(65, 750, 250, 'right'),    // F4
      createNote(67, 1000, 250, 'right'),   // G4
      createNote(65, 1250, 250, 'right'),   // F4
      createNote(64, 1500, 250, 'right'),   // E4
      createNote(62, 1750, 250, 'right'),   // D4
      // Left hand: G major chord (G-B-D)
      createNote(43, 4000, 4000, 'left'),   // G2
      createNote(47, 4000, 4000, 'left'),   // B2
      createNote(50, 4000, 4000, 'left'),   // D3
      // Right hand continues
      createNote(60, 4000, 250, 'right'),   // C4
      createNote(62, 4250, 250, 'right'),   // D4
      createNote(64, 4500, 250, 'right'),   // E4
      createNote(65, 4750, 250, 'right'),   // F4
    ],
  },
  {
    id: 'wolf-different-rhythms',
    title: 'Different Rhythms',
    category: 'two-hand-coordination',
    subcategory: 'polyrhythm',
    difficulty: 3,
    mode: 'wolf',
    description:
      'Right hand plays quarter notes while left hand plays half notes simultaneously on the same pitch. Develops rhythmic independence.',
    technique:
      'Count carefully. RH moves at 2x the speed of LH. Stay focused on the beat. Use a metronome.',
    commonMistakes:
      'Hands synchronizing accidentally, rushing one hand, losing count.',
    fingerInfo: 'Both hands on C position. RH plays melody (1-2-3-4-5). LH plays slower sustained notes (5-3-1). Focus on rhythm independence.',
    bpm: 60,
    durationMs: 8000,
    notes: [
      // Left hand: half notes (500ms each in our 250ms per beat system)
      createNote(60, 0, 500, 'left'),       // C4 — half note
      createNote(62, 500, 500, 'left'),     // D4 — half note
      createNote(64, 1000, 500, 'left'),    // E4 — half note
      createNote(65, 1500, 500, 'left'),    // F4 — half note
      // Right hand: quarter notes (250ms)
      createNote(60, 0, 250, 'right'),      // C4
      createNote(60, 250, 250, 'right'),    // C4
      createNote(62, 500, 250, 'right'),    // D4
      createNote(62, 750, 250, 'right'),    // D4
      createNote(64, 1000, 250, 'right'),   // E4
      createNote(64, 1250, 250, 'right'),   // E4
      createNote(65, 1500, 250, 'right'),   // F4
      createNote(65, 1750, 250, 'right'),   // F4
      createNote(67, 2000, 250, 'right'),   // G4
      createNote(67, 2250, 250, 'right'),   // G4
      createNote(69, 2500, 250, 'right'),   // A4
      createNote(69, 2750, 250, 'right'),   // A4
    ],
  },
  {
    id: 'wolf-call-and-response',
    title: 'Call and Response',
    category: 'two-hand-coordination',
    subcategory: 'dialogue',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Right hand plays a phrase, left hand echoes it. Develops memory and independent hand control through musical dialogue.',
    technique:
      'Play RH phrase first. Wait a beat. Play identical pattern with LH. Stay precise with timing.',
    commonMistakes:
      'Rushing the response, changing pitch/rhythm in the echo, not waiting between calls.',
    fingerInfo: 'RH: Thumb(1) on C4, plays the "call" phrase. LH: Pinky(5) on C3, echoes the response. Hands alternate, never play together.',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // RH Call: C-E-G-E (eighth notes)
      createNote(60, 0, 250, 'right'),      // C4
      createNote(64, 250, 250, 'right'),    // E4
      createNote(67, 500, 250, 'right'),    // G4
      createNote(64, 750, 250, 'right'),    // E4
      // Rest (500ms)
      // LH Response: same pattern
      createNote(48, 1250, 250, 'left'),    // C3
      createNote(52, 1500, 250, 'left'),    // E3
      createNote(55, 1750, 250, 'left'),    // G3
      createNote(52, 2000, 250, 'left'),    // E3
      // Rest
      // RH Call 2: D-F-A-F
      createNote(62, 2500, 250, 'right'),   // D4
      createNote(65, 2750, 250, 'right'),   // F4
      createNote(69, 3000, 250, 'right'),   // A4
      createNote(65, 3250, 250, 'right'),   // F4
      // Rest
      // LH Response 2: same
      createNote(50, 3750, 250, 'left'),    // D3
      createNote(53, 4000, 250, 'left'),    // F3
      createNote(57, 4250, 250, 'left'),    // A3
      createNote(53, 4500, 250, 'left'),    // F3
    ],
  },

  // ============================================================
  // Rhythm
  // ============================================================
  {
    id: 'wolf-quarter-pulse',
    title: 'Quarter Note Pulse',
    category: 'rhythm',
    subcategory: 'steady-beat',
    difficulty: 1,
    mode: 'wolf',
    description:
      'Steady quarter note pulse on C, both hands in unison. Foundational rhythm exercise. Develops metronome consistency.',
    technique:
      'Keep wrist loose. Strike each note at exactly the same velocity. Think "ta-ta-ta-ta" in a steady tempo.',
    commonMistakes:
      'Speeding up or slowing down, varying velocity, tensing wrist.',
    fingerInfo: 'RH: Thumb(1) on C4. Single finger, focus on timing not fingering. Tap the pulse evenly like a metronome.',
    bpm: 80,
    durationMs: 6000,
    notes: [
      // 24 quarter notes on C4 and C3 in unison
      createNote(60, 0, 250, 'right'),      // C4
      createNote(48, 0, 250, 'left'),       // C3
      createNote(60, 250, 250, 'right'),
      createNote(48, 250, 250, 'left'),
      createNote(60, 500, 250, 'right'),
      createNote(48, 500, 250, 'left'),
      createNote(60, 750, 250, 'right'),
      createNote(48, 750, 250, 'left'),
      createNote(60, 1000, 250, 'right'),
      createNote(48, 1000, 250, 'left'),
      createNote(60, 1250, 250, 'right'),
      createNote(48, 1250, 250, 'left'),
      createNote(60, 1500, 250, 'right'),
      createNote(48, 1500, 250, 'left'),
      createNote(60, 1750, 250, 'right'),
      createNote(48, 1750, 250, 'left'),
      createNote(60, 2000, 250, 'right'),
      createNote(48, 2000, 250, 'left'),
      createNote(60, 2250, 250, 'right'),
      createNote(48, 2250, 250, 'left'),
      createNote(60, 2500, 250, 'right'),
      createNote(48, 2500, 250, 'left'),
      createNote(60, 2750, 250, 'right'),
      createNote(48, 2750, 250, 'left'),
    ],
  },
  {
    id: 'wolf-dotted-rhythm',
    title: 'Dotted Rhythm Builder',
    category: 'rhythm',
    subcategory: 'syncopation',
    difficulty: 3,
    mode: 'wolf',
    description:
      'Dotted quarter + eighth note patterns (long-short). Common in classical and folk music. Builds syncopation comfort.',
    technique:
      'Dotted note is 1.5x the beat, eighth is 0.5x. Count carefully. Practice slowly first.',
    commonMistakes:
      'Making dotted note too short or too long, rushing the eighth note, uneven tempo.',
    fingerInfo: 'RH: Thumb(1) on C4, fingers 1-2-3. Dotted pattern = long-short-long-short. Focus on timing, not finger technique.',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // Dotted quarter (375ms) + eighth (125ms) pattern
      createNote(60, 0, 375, 'right'),      // C — dotted quarter
      createNote(62, 375, 125, 'right'),    // D — eighth
      createNote(64, 500, 375, 'right'),    // E — dotted quarter
      createNote(65, 875, 125, 'right'),    // F — eighth
      createNote(67, 1000, 375, 'right'),   // G — dotted quarter
      createNote(69, 1375, 125, 'right'),   // A — eighth
      createNote(67, 1500, 375, 'right'),   // G — dotted quarter
      createNote(65, 1875, 125, 'right'),   // F — eighth
      // Left hand same pattern
      createNote(48, 2000, 375, 'left'),    // C — dotted quarter
      createNote(50, 2375, 125, 'left'),    // D — eighth
      createNote(52, 2500, 375, 'left'),    // E — dotted quarter
      createNote(53, 2875, 125, 'left'),    // F — eighth
      createNote(55, 3000, 375, 'left'),    // G — dotted quarter
      createNote(57, 3375, 125, 'left'),    // A — eighth
      createNote(55, 3500, 375, 'left'),    // G — dotted quarter
      createNote(53, 3875, 125, 'left'),    // F — eighth
    ],
  },
  {
    id: 'wolf-syncopation',
    title: 'Syncopation Intro',
    category: 'rhythm',
    subcategory: 'off-beat',
    difficulty: 3,
    mode: 'wolf',
    description:
      'Off-beat accents and syncopated rhythms. Common in jazz and contemporary music. Develops rhythmic flexibility.',
    technique:
      'Count the beat silently. Accent notes on the off-beat (between the main beats). Stay relaxed.',
    commonMistakes:
      'Accenting the wrong beats, rushing on off-beat, losing the underlying pulse.',
    fingerInfo: 'Both hands, C position. RH accents off-beats (1-2-3). LH keeps steady pulse (5-3-1). Brain will resist — that is the exercise.',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // On-beat and off-beat pattern
      createNote(60, 0, 200, 'right'),      // On-beat (weak)
      createNote(62, 200, 250, 'right'),    // Off-beat (strong accent)
      createNote(60, 450, 200, 'right'),    // On-beat
      createNote(64, 650, 250, 'right'),    // Off-beat
      createNote(60, 900, 200, 'right'),    // On-beat
      createNote(65, 1100, 250, 'right'),   // Off-beat
      createNote(60, 1350, 200, 'right'),   // On-beat
      createNote(67, 1550, 250, 'right'),   // Off-beat
      // Repeat with left hand
      createNote(48, 2000, 200, 'left'),
      createNote(50, 2200, 250, 'left'),
      createNote(48, 2450, 200, 'left'),
      createNote(52, 2650, 250, 'left'),
      createNote(48, 2900, 200, 'left'),
      createNote(53, 3100, 250, 'left'),
      createNote(48, 3350, 200, 'left'),
      createNote(55, 3550, 250, 'left'),
    ],
  },

  // ============================================================
  // Scales
  // ============================================================
  {
    id: 'wolf-c-major-rh',
    title: 'C Major Scale — Right Hand',
    category: 'scales',
    subcategory: 'single-hand',
    difficulty: 1,
    mode: 'wolf',
    description:
      'One octave C major scale (C-D-E-F-G-A-B-C) right hand only. Foundation for all scalar movement. First scale to learn.',
    technique:
      'Use proper fingering: 1-2-3-1-2-3-4-5 ascending, 5-4-3-2-1-3-2-1 descending. Smooth hand position shifts. Wrist follows hand motion naturally.',
    commonMistakes:
      'Poor fingering, jerky thumb passes, uneven tempo, stiff wrist.',
    fingerInfo: 'RH: Thumb(1) on C4. Ascending C-D-E-F-G-A-B-C. Thumb tucks under after finger 3 (E). Finger 3 crosses over after thumb (F).',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // Ascending C major scale (quarter notes)
      createNote(60, 0, 250, 'right'),      // C4 — Finger 1
      createNote(62, 250, 250, 'right'),    // D4 — Finger 2
      createNote(64, 500, 250, 'right'),    // E4 — Finger 3
      createNote(65, 750, 250, 'right'),    // F4 — Finger 1 (thumb pass)
      createNote(67, 1000, 250, 'right'),   // G4 — Finger 2
      createNote(69, 1250, 250, 'right'),   // A4 — Finger 3
      createNote(71, 1500, 250, 'right'),   // B4 — Finger 4
      createNote(72, 1750, 250, 'right'),   // C5 — Finger 5
      // Descending
      createNote(71, 2000, 250, 'right'),   // B4
      createNote(69, 2250, 250, 'right'),   // A4
      createNote(67, 2500, 250, 'right'),   // G4
      createNote(65, 2750, 250, 'right'),   // F4
      createNote(64, 3000, 250, 'right'),   // E4
      createNote(62, 3250, 250, 'right'),   // D4
      createNote(60, 3500, 250, 'right'),   // C4
    ],
  },
  {
    id: 'wolf-c-major-lh',
    title: 'C Major Scale — Left Hand',
    category: 'scales',
    subcategory: 'single-hand',
    difficulty: 1,
    mode: 'wolf',
    description:
      'One octave C major scale left hand only. Same as RH but mirrored fingering and lower register.',
    technique:
      'Use proper LH fingering: 5-4-3-2-1-3-2-1 ascending (reverse of RH), 1-2-3-1-2-3-4-5 descending. Smooth thumb passes.',
    commonMistakes:
      'Same as RH scale — poor fingering, jerky motion, uneven tempo.',
    fingerInfo: 'LH: Pinky(5) on C3. Ascending C-D-E-F-G-A-B-C. Finger 3 crosses over after thumb (A). Thumb tucks under after finger 3 (E).',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // Ascending C major scale LH (quarter notes) — starts at C3
      createNote(48, 0, 250, 'left'),       // C3 — Finger 5
      createNote(50, 250, 250, 'left'),     // D3 — Finger 4
      createNote(52, 500, 250, 'left'),     // E3 — Finger 3
      createNote(53, 750, 250, 'left'),     // F3 — Finger 2
      createNote(55, 1000, 250, 'left'),    // G3 — Finger 1
      createNote(57, 1250, 250, 'left'),    // A3 — Finger 3
      createNote(59, 1500, 250, 'left'),    // B3 — Finger 4
      createNote(60, 1750, 250, 'left'),    // C4 — Finger 5
      // Descending
      createNote(59, 2000, 250, 'left'),    // B3
      createNote(57, 2250, 250, 'left'),    // A3
      createNote(55, 2500, 250, 'left'),    // G3
      createNote(53, 2750, 250, 'left'),    // F3
      createNote(52, 3000, 250, 'left'),    // E3
      createNote(50, 3250, 250, 'left'),    // D3
      createNote(48, 3500, 250, 'left'),    // C3
    ],
  },
  {
    id: 'wolf-c-major-parallel',
    title: 'C Major Scale — Both Hands Parallel',
    category: 'scales',
    subcategory: 'two-hands',
    difficulty: 2,
    mode: 'wolf',
    description:
      'Both hands play same C major scale in same direction simultaneously. Builds two-hand coordination with scalar motion.',
    technique:
      'Hands move together at same tempo. Right hand 1 octave higher than left. Keep hand positions mirrored.',
    commonMistakes:
      'Hands out of sync, uneven tempos between hands, hand position collapse.',
    fingerInfo: 'Both hands play C major scale in parallel. RH: Thumb(1) on C4. LH: Pinky(5) on C3. Same fingering rules, both hands move together.',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // Ascending, both hands (quarter notes)
      createNote(60, 0, 250, 'right'),      // C4
      createNote(48, 0, 250, 'left'),       // C3
      createNote(62, 250, 250, 'right'),    // D4
      createNote(50, 250, 250, 'left'),     // D3
      createNote(64, 500, 250, 'right'),    // E4
      createNote(52, 500, 250, 'left'),     // E3
      createNote(65, 750, 250, 'right'),    // F4
      createNote(53, 750, 250, 'left'),     // F3
      createNote(67, 1000, 250, 'right'),   // G4
      createNote(55, 1000, 250, 'left'),    // G3
      createNote(69, 1250, 250, 'right'),   // A4
      createNote(57, 1250, 250, 'left'),    // A3
      createNote(71, 1500, 250, 'right'),   // B4
      createNote(59, 1500, 250, 'left'),    // B3
      createNote(72, 1750, 250, 'right'),   // C5
      createNote(60, 1750, 250, 'left'),    // C4
      // Descending
      createNote(71, 2000, 250, 'right'),
      createNote(59, 2000, 250, 'left'),
      createNote(69, 2250, 250, 'right'),
      createNote(57, 2250, 250, 'left'),
      createNote(67, 2500, 250, 'right'),
      createNote(55, 2500, 250, 'left'),
      createNote(65, 2750, 250, 'right'),
      createNote(53, 2750, 250, 'left'),
      createNote(64, 3000, 250, 'right'),
      createNote(52, 3000, 250, 'left'),
      createNote(62, 3250, 250, 'right'),
      createNote(50, 3250, 250, 'left'),
      createNote(60, 3500, 250, 'right'),
      createNote(48, 3500, 250, 'left'),
    ],
  },
  {
    id: 'wolf-g-major',
    title: 'G Major Scale — Both Hands',
    category: 'scales',
    subcategory: 'sharps',
    difficulty: 2,
    mode: 'wolf',
    description:
      'One sharp (F#). Introduces accidental handling. Single octave ascending and descending.',
    technique:
      'Remember the F# throughout. Keep consistent hand position. Same fingering as C major.',
    commonMistakes:
      'Forgetting the F#, varying velocity, rushing.',
    fingerInfo: 'RH: Thumb(1) on G. G-A-B-C-D-E-F#-G. Watch for F# — same fingering as C major but with one black key.',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // G major ascending (G-A-B-C-D-E-F#-G)
      createNote(67, 0, 250, 'right'),      // G4
      createNote(55, 0, 250, 'left'),       // G3
      createNote(69, 250, 250, 'right'),    // A4
      createNote(57, 250, 250, 'left'),     // A3
      createNote(71, 500, 250, 'right'),    // B4
      createNote(59, 500, 250, 'left'),     // B3
      createNote(60, 750, 250, 'right'),    // C4 (next octave)
      createNote(48, 750, 250, 'left'),     // C3
      createNote(62, 1000, 250, 'right'),   // D4
      createNote(50, 1000, 250, 'left'),    // D3
      createNote(64, 1250, 250, 'right'),   // E4
      createNote(52, 1250, 250, 'left'),    // E3
      createNote(66, 1500, 250, 'right'),   // F#4
      createNote(54, 1500, 250, 'left'),    // F#3
      createNote(67, 1750, 250, 'right'),   // G4
      createNote(55, 1750, 250, 'left'),    // G3
      // Descending
      createNote(66, 2000, 250, 'right'),
      createNote(54, 2000, 250, 'left'),
      createNote(64, 2250, 250, 'right'),
      createNote(52, 2250, 250, 'left'),
      createNote(62, 2500, 250, 'right'),
      createNote(50, 2500, 250, 'left'),
      createNote(60, 2750, 250, 'right'),
      createNote(48, 2750, 250, 'left'),
      createNote(71, 3000, 250, 'right'),
      createNote(59, 3000, 250, 'left'),
      createNote(69, 3250, 250, 'right'),
      createNote(57, 3250, 250, 'left'),
      createNote(67, 3500, 250, 'right'),
      createNote(55, 3500, 250, 'left'),
    ],
  },
  {
    id: 'wolf-a-minor',
    title: 'A Minor Natural Scale',
    category: 'scales',
    subcategory: 'relative-minor',
    difficulty: 2,
    mode: 'wolf',
    description:
      'No sharps or flats (same key signature as C major). Natural minor (Aeolian mode). Introduces minor sound.',
    technique:
      'A minor scale: A-B-C-D-E-F-G-A. Same fingering pattern, different starting note.',
    commonMistakes:
      'Confusing with major scale shape, uneven tempo.',
    fingerInfo: 'RH: Thumb(1) on A. A-B-C-D-E-F-G-A. Natural minor — all white keys. Same fingering as C major starting from A.',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // A natural minor ascending (A-B-C-D-E-F-G-A)
      createNote(57, 0, 250, 'right'),      // A3
      createNote(45, 0, 250, 'left'),       // A2
      createNote(59, 250, 250, 'right'),    // B3
      createNote(47, 250, 250, 'left'),     // B2
      createNote(60, 500, 250, 'right'),    // C4
      createNote(48, 500, 250, 'left'),     // C3
      createNote(62, 750, 250, 'right'),    // D4
      createNote(50, 750, 250, 'left'),     // D3
      createNote(64, 1000, 250, 'right'),   // E4
      createNote(52, 1000, 250, 'left'),    // E3
      createNote(65, 1250, 250, 'right'),   // F4
      createNote(53, 1250, 250, 'left'),    // F3
      createNote(67, 1500, 250, 'right'),   // G4
      createNote(55, 1500, 250, 'left'),    // G3
      createNote(69, 1750, 250, 'right'),   // A4
      createNote(57, 1750, 250, 'left'),    // A3
      // Descending
      createNote(67, 2000, 250, 'right'),
      createNote(55, 2000, 250, 'left'),
      createNote(65, 2250, 250, 'right'),
      createNote(53, 2250, 250, 'left'),
      createNote(64, 2500, 250, 'right'),
      createNote(52, 2500, 250, 'left'),
      createNote(62, 2750, 250, 'right'),
      createNote(50, 2750, 250, 'left'),
      createNote(60, 3000, 250, 'right'),
      createNote(48, 3000, 250, 'left'),
      createNote(59, 3250, 250, 'right'),
      createNote(47, 3250, 250, 'left'),
      createNote(57, 3500, 250, 'right'),
      createNote(45, 3500, 250, 'left'),
    ],
  },
];

/**
 * RUBY exercises — 5½ year old, gamified, small hand span (C position focus)
 */
const RUBY_EXERCISES: Exercise[] = [
  // ============================================================
  // Five-Finger Patterns (C position, no stretching)
  // ============================================================
  {
    id: 'ruby-finger-friends',
    title: 'Finger Friends Walk',
    category: 'five-finger-patterns',
    subcategory: 'single-hand',
    difficulty: 1,
    mode: 'ruby',
    description:
      'One finger per note: C-D-E-F-G ascending and descending. Right hand only. Teaches one-finger-per-key coordination.',
    technique:
      'Keep hand in C position. Fingers walk up like friends holding hands. Each finger lifts as the next one comes down.',
    commonMistakes:
      'Playing multiple notes at once, skipping notes, moving the wrist.',
    fingerInfo: 'RH only. Thumb(1) on C — each finger gets its own white key: 1=C, 2=D, 3=E, 4=F, 5=G. Fingers walk up like friends!',
    bpm: 72,
    durationMs: 6000,
    notes: [
      // Ascending: C-D-E-F-G (quarter notes)
      createNote(60, 0, 300, 'right'),      // C4 — Finger 1
      createNote(62, 300, 300, 'right'),    // D4 — Finger 2
      createNote(64, 600, 300, 'right'),    // E4 — Finger 3
      createNote(65, 900, 300, 'right'),    // F4 — Finger 4
      createNote(67, 1200, 300, 'right'),   // G4 — Finger 5
      // Descending: G-F-E-D-C
      createNote(67, 1500, 300, 'right'),   // G4
      createNote(65, 1800, 300, 'right'),   // F4
      createNote(64, 2100, 300, 'right'),   // E4
      createNote(62, 2400, 300, 'right'),   // D4
      createNote(60, 2700, 300, 'right'),   // C4
      // Repeat
      createNote(60, 3000, 300, 'right'),
      createNote(62, 3300, 300, 'right'),
      createNote(64, 3600, 300, 'right'),
      createNote(65, 3900, 300, 'right'),
      createNote(67, 4200, 300, 'right'),
      createNote(67, 4500, 300, 'right'),
      createNote(65, 4800, 300, 'right'),
      createNote(64, 5100, 300, 'right'),
      createNote(62, 5400, 300, 'right'),
      createNote(60, 5700, 300, 'right'),
    ],
  },
  {
    id: 'ruby-left-hand-turn',
    title: "Left Hand's Turn",
    category: 'five-finger-patterns',
    subcategory: 'single-hand',
    difficulty: 1,
    mode: 'ruby',
    description:
      'Same as Finger Friends Walk but left hand only. Introduces left hand independence.',
    technique:
      'Same finger position, lower on the keyboard. Keep hand relaxed.',
    commonMistakes:
      'Same as RH version — multiple notes, uneven spacing.',
    fingerInfo: 'LH only. Pinky(5) on C — each finger gets its own key: 5=C, 4=D, 3=E, 2=F, 1=G. Same keys, other hand!',
    bpm: 72,
    durationMs: 6000,
    notes: [
      // Left hand: C3-D3-E3-F3-G3
      createNote(48, 0, 300, 'left'),       // C3 — Finger 5
      createNote(50, 300, 300, 'left'),     // D3 — Finger 4
      createNote(52, 600, 300, 'left'),     // E3 — Finger 3
      createNote(53, 900, 300, 'left'),     // F3 — Finger 2
      createNote(55, 1200, 300, 'left'),    // G3 — Finger 1
      // Descending
      createNote(55, 1500, 300, 'left'),
      createNote(53, 1800, 300, 'left'),
      createNote(52, 2100, 300, 'left'),
      createNote(50, 2400, 300, 'left'),
      createNote(48, 2700, 300, 'left'),
      // Repeat
      createNote(48, 3000, 300, 'left'),
      createNote(50, 3300, 300, 'left'),
      createNote(52, 3600, 300, 'left'),
      createNote(53, 3900, 300, 'left'),
      createNote(55, 4200, 300, 'left'),
      createNote(55, 4500, 300, 'left'),
      createNote(53, 4800, 300, 'left'),
      createNote(52, 5100, 300, 'left'),
      createNote(50, 5400, 300, 'left'),
      createNote(48, 5700, 300, 'left'),
    ],
  },
  {
    id: 'ruby-mirror-friends',
    title: 'Mirror Friends',
    category: 'five-finger-patterns',
    subcategory: 'two-hands',
    difficulty: 2,
    mode: 'ruby',
    description:
      'Both hands play C-D-E-F-G simultaneously, moving outward (contrary motion). Hand symmetry game.',
    technique:
      'Hands move together like mirror images. RH goes up, LH goes down. Stay synchronized.',
    commonMistakes:
      'Hands going different speeds, losing synchronization, changing finger order.',
    fingerInfo: 'Both hands together! RH Thumb(1) on C4, LH Pinky(5) on C3. Both hands play C-D-E-F-G at the same time — like a mirror!',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // RH ascending (C-D-E-F-G) + LH descending (G-F-E-D-C) in mirror
      createNote(60, 0, 300, 'right'),      // C4
      createNote(55, 0, 300, 'left'),       // G3
      createNote(62, 300, 300, 'right'),    // D4
      createNote(53, 300, 300, 'left'),     // F3
      createNote(64, 600, 300, 'right'),    // E4
      createNote(52, 600, 300, 'left'),     // E3
      createNote(65, 900, 300, 'right'),    // F4
      createNote(50, 900, 300, 'left'),     // D3
      createNote(67, 1200, 300, 'right'),   // G4
      createNote(48, 1200, 300, 'left'),    // C3
      // Reverse
      createNote(65, 1500, 300, 'right'),
      createNote(50, 1500, 300, 'left'),
      createNote(64, 1800, 300, 'right'),
      createNote(52, 1800, 300, 'left'),
      createNote(62, 2100, 300, 'right'),
      createNote(53, 2100, 300, 'left'),
      createNote(60, 2400, 300, 'right'),
      createNote(55, 2400, 300, 'left'),
    ],
  },

  // ============================================================
  // Rhythm for Kids
  // ============================================================
  {
    id: 'ruby-march-soldier',
    title: 'March Like a Soldier',
    category: 'rhythm',
    subcategory: 'steady-beat',
    difficulty: 1,
    mode: 'ruby',
    description:
      'Steady quarter notes with alternating C and G (both hands). Fun military march rhythm. Great for beat awareness.',
    technique:
      'March feeling. Count "1-2-3-4" with steady tempo. Play loud and proud!',
    commonMistakes:
      'Speeding up on G, losing the steady pulse.',
    fingerInfo: 'RH: Thumb(1) on C4. March along: 1-1-2-2-3-3. Like soldiers marching — steady and even.',
    bpm: 80,
    durationMs: 7000,
    notes: [
      // Alternating C-G on quarter notes (16 notes total)
      createNote(60, 0, 250, 'right'),      // C4
      createNote(55, 0, 250, 'left'),       // G3
      createNote(67, 250, 250, 'right'),    // G4
      createNote(48, 250, 250, 'left'),     // C3
      createNote(60, 500, 250, 'right'),    // C4
      createNote(55, 500, 250, 'left'),     // G3
      createNote(67, 750, 250, 'right'),    // G4
      createNote(48, 750, 250, 'left'),     // C3
      createNote(60, 1000, 250, 'right'),
      createNote(55, 1000, 250, 'left'),
      createNote(67, 1250, 250, 'right'),
      createNote(48, 1250, 250, 'left'),
      createNote(60, 1500, 250, 'right'),
      createNote(55, 1500, 250, 'left'),
      createNote(67, 1750, 250, 'right'),
      createNote(48, 1750, 250, 'left'),
      createNote(60, 2000, 250, 'right'),
      createNote(55, 2000, 250, 'left'),
      createNote(67, 2250, 250, 'right'),
      createNote(48, 2250, 250, 'left'),
      createNote(60, 2500, 250, 'right'),
      createNote(55, 2500, 250, 'left'),
      createNote(67, 2750, 250, 'right'),
      createNote(48, 2750, 250, 'left'),
      createNote(60, 3000, 250, 'right'),
      createNote(55, 3000, 250, 'left'),
      createNote(67, 3250, 250, 'right'),
      createNote(48, 3250, 250, 'left'),
      createNote(60, 3500, 250, 'right'),
      createNote(55, 3500, 250, 'left'),
      createNote(67, 3750, 250, 'right'),
      createNote(48, 3750, 250, 'left'),
    ],
  },
  {
    id: 'ruby-skip-and-jump',
    title: 'Skip and Jump',
    category: 'rhythm',
    subcategory: 'syncopation',
    difficulty: 1,
    mode: 'ruby',
    description:
      'Quarter-quarter-half pattern: short-short-long. Fun bouncy feeling. Introduces rhythm variation.',
    technique:
      'Two quick notes, then hold a long note. "Skip-skip-JUMP!" Imagine bouncing.',
    commonMistakes:
      'Long note too short, rushing the quick notes.',
    fingerInfo: 'RH: Thumb(1) on C4. Skip a key each time: C(1)-E(3)-G(5). Then back down: G(5)-E(3)-C(1).',
    bpm: 72,
    durationMs: 8000,
    notes: [
      // Quarter-quarter-half pattern (skip-skip-jump)
      createNote(60, 0, 250, 'right'),      // C (short)
      createNote(62, 250, 250, 'right'),    // D (short)
      createNote(67, 500, 500, 'right'),    // G (long/JUMP)
      createNote(60, 1000, 250, 'right'),
      createNote(64, 1250, 250, 'right'),
      createNote(67, 1500, 500, 'right'),
      createNote(60, 2000, 250, 'right'),
      createNote(65, 2250, 250, 'right'),
      createNote(67, 2500, 500, 'right'),
      // Left hand same pattern
      createNote(48, 3500, 250, 'left'),    // C3
      createNote(50, 3750, 250, 'left'),    // D3
      createNote(55, 4000, 500, 'left'),    // G3
      createNote(48, 4500, 250, 'left'),
      createNote(52, 4750, 250, 'left'),
      createNote(55, 5000, 500, 'left'),
      createNote(48, 5500, 250, 'left'),
      createNote(53, 5750, 250, 'left'),
      createNote(55, 6000, 500, 'left'),
    ],
  },

  // ============================================================
  // Two-Hand Intro
  // ============================================================
  {
    id: 'ruby-hands-together-c-g',
    title: 'Hands Together: C and G',
    category: 'two-hand-coordination',
    subcategory: 'simple-holding',
    difficulty: 1,
    mode: 'ruby',
    description:
      'Right hand holds C, left holds G, then swap. Simple holding exercise to build two-hand awareness.',
    technique:
      'Hold each hand steady for 1 second. Don\' relax between the swap. Keep fingers curved.',
    commonMistakes:
      'Relaxing hands, letting notes drift out of tune pitch.',
    fingerInfo: 'RH: Thumb(1) on C4. LH: Pinky(5) on C3. Both play C then G together. Simple two-note exercise for coordination.',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // RH C, LH G (hold for 1000ms)
      createNote(60, 0, 1000, 'right'),     // C4
      createNote(55, 0, 1000, 'left'),      // G3
      // RH G, LH C (swap)
      createNote(67, 1000, 1000, 'right'),  // G4
      createNote(48, 1000, 1000, 'left'),   // C3
      // Repeat
      createNote(60, 2000, 1000, 'right'),
      createNote(55, 2000, 1000, 'left'),
      createNote(67, 3000, 1000, 'right'),
      createNote(48, 3000, 1000, 'left'),
      createNote(60, 4000, 1000, 'right'),
      createNote(55, 4000, 1000, 'left'),
    ],
  },
  {
    id: 'ruby-follow-leader',
    title: 'Follow the Leader',
    category: 'two-hand-coordination',
    subcategory: 'melody-echo',
    difficulty: 1,
    mode: 'ruby',
    description:
      'Right hand plays C-D-E, then left hand copies it. Simple call-and-response for memory and coordination.',
    technique:
      'RH plays slowly. Pause. LH copies exactly. Keep same tempo and loudness.',
    commonMistakes:
      'LH rushing the response, changing notes in the copy.',
    fingerInfo: 'RH plays first (the leader): C-D-E. Then LH copies (the follower): C-D-E. Hands take turns — never play together.',
    bpm: 60,
    durationMs: 6000,
    notes: [
      // RH Call: C-D-E (quarter notes)
      createNote(60, 0, 300, 'right'),      // C
      createNote(62, 300, 300, 'right'),    // D
      createNote(64, 600, 300, 'right'),    // E
      // Rest (600ms)
      // LH Response: same
      createNote(48, 1200, 300, 'left'),    // C
      createNote(50, 1500, 300, 'left'),    // D
      createNote(52, 1800, 300, 'left'),    // E
      // Rest
      // RH Call 2: E-F-G
      createNote(64, 2400, 300, 'right'),   // E
      createNote(65, 2700, 300, 'right'),   // F
      createNote(67, 3000, 300, 'right'),   // G
      // Rest
      // LH Response 2: same
      createNote(52, 3600, 300, 'left'),    // E
      createNote(53, 3900, 300, 'left'),    // F
      createNote(55, 4200, 300, 'left'),    // G
    ],
  },
];

// Combined all exercises
const ALL_EXERCISES: Exercise[] = [...WOLF_EXERCISES, ...RUBY_EXERCISES];

/**
 * Get all exercises
 */
export function getAllExercises(): Exercise[] {
  return ALL_EXERCISES;
}

/**
 * Get exercises filtered by mode
 */
export function getExercisesForMode(mode: 'wolf' | 'ruby'): Exercise[] {
  if (mode === 'wolf') {
    return WOLF_EXERCISES;
  } else if (mode === 'ruby') {
    return RUBY_EXERCISES;
  }
  return [];
}

/**
 * Convert an Exercise to a Song for playback
 */
export function exerciseToSong(exercise: Exercise): Song {
  return {
    id: exercise.id,
    title: exercise.title,
    artist: 'Exercise',
    difficulty: exercise.difficulty,
    notes: exercise.notes,
    durationMs: exercise.durationMs,
    bpm: exercise.bpm,
    source: 'built-in',
    filePath: `exercises/${exercise.id}`,
    category: exercise.mode === 'both' ? undefined : exercise.mode,
  };
}
