# Wolf & Ruby Piano — Claude Code Build Instructions

## STATUS: Cowork Built the Full App Structure
**Date:** 2026-03-20
**What exists:** Complete Electron + React + TypeScript + Vite + Tailwind app with all components, engine modules, two modes, 12 built-in songs (programmatic), and 9 downloaded MIDI files.
**What needs:** Run on Mac, test with real MIDI keyboard, polish, integrate downloaded MIDI files as enhanced replacements.

---

## FIRST: Read CLAUDE.md
It's in the project root. Read it before touching anything.

---

## Quick Start (on Wolf's Mac)

```bash
cd ~/Documents/ACTIVE/wolf-ruby-piano
npm install
npm run dev
```

This runs Vite dev server + Electron concurrently. You should see the home screen with Wolf Mode and Ruby Mode cards.

If `npm run dev` fails on the concurrently step, run them separately:
```bash
# Terminal 1
npm run dev:renderer

# Terminal 2 (after Vite is running)
npm run dev:electron
```

---

## What's Built (21 source files)

### Engine Layer (src/engine/)
- **MidiParser.ts** — Parses .mid files via @tonejs/midi into NoteEvent arrays. Auto-detects hand (left/right) by track index. Auto-detects difficulty 1-5.
- **AudioEngine.ts** — Tone.js PolySynth (triangle8, 16-voice polyphony). Singleton. Must call `init()` after user gesture.
- **PlaybackEngine.ts** — Core timing loop via requestAnimationFrame. Three modes: LISTEN (auto-play), PRACTICE (waits for correct input), PERFORM (scores timing). Speed control 25%-150%. Hand filter. Loop support.
- **ScoreEngine.ts** — Tracks hits/misses/streak/accuracy/stars. Ruby mode uses generous star thresholds (30% = 2 stars).

### MIDI Layer (src/midi/)
- **MidiInput.ts** — Web MIDI API wrapper. Auto-detects keyboard on launch. Emits noteOn/noteOff callbacks. Shows connection status.

### Components (src/components/)
- **Piano.tsx** — Virtual piano keyboard. Wolf mode: full 5-octave, C label on each octave, glow on active notes (blue=left, amber=right). Ruby mode: big colorful animal keys, only shows keys for current level, emoji + letter labels.
- **FallingNotes.tsx** — Canvas-based 60fps renderer. Notes fall from top toward hit line. Wolf mode: colored rounded rects proportional to duration. Ruby mode: animal emoji blocks. Sparkle particles on hit. Glow/pulse on waiting notes.
- **SpeedControl.tsx** — Slider + quick preset buttons (25/50/75/100%).
- **LoopControl.tsx** — Start/end bar inputs with clear button.
- **ScoreDisplay.tsx** — Wolf: accuracy%, streak, note count. Ruby: 5 stars + streak encouragement.
- **SongBrowser.tsx** — Song list with search, filter tabs (all/built-in/imported), difficulty stars, MIDI file import via file picker.

### Modes (src/modes/)
- **WolfMode.tsx** — Full play view: top HUD (song info, mode selector, MIDI status), falling notes canvas, piano keyboard, bottom controls (play/pause, speed, hand filter, loop, score). Song library view with back navigation.
- **RubyMode.tsx** — Intro screen ("Ruby's Piano!" with 3 tappable animal keys + "Ready to play?"), falling notes, big animal piano, encouragement messages, simplified controls. The "5-minute magic trick" flow is implemented.

### App Shell
- **App.tsx** — Home screen with mode selector cards (gradient background, hover effects). Routes to WolfMode or RubyMode.
- **main.tsx** — React entry point.

### Electron
- **electron/main.ts** — Window creation, IPC handlers for file picker and library persistence.
- **electron/preload.ts** — Secure bridge exposing openMidiFile, saveLibrary, loadLibrary.

### Songs
- **src/songs/library.ts** — 12 built-in songs as programmatic NoteEvent arrays (6 Ruby, 6 Wolf). These work without any MIDI files.
- **src/songs/built-in/** — 9 downloaded .mid files from BitMidi (real arrangements).

---

## What Needs Work (Priority Order)

### 1. INTEGRATE DOWNLOADED MIDI FILES
The built-in songs in library.ts are simplified programmatic melodies. The real MIDI files in src/songs/built-in/ are much better. Add a loader that:

```typescript
// In library.ts or a new MidiLoader.ts
// On app startup, check if .mid files exist in built-in/
// Parse them with MidiParser and merge/replace the programmatic versions
// The programmatic versions are fallbacks if MIDI files aren't found
```

Downloaded files:
- `hot-cross-buns.mid` (749 bytes — very simple, perfect for Ruby Level 1)
- `mary-had-a-little-lamb.mid` (34KB — full arrangement, may need simplification for Ruby)
- `twinkle-twinkle.mid` (912 bytes — simple, good for Ruby Level 2)
- `ode-to-joy-easy.mid` (2.4KB — piano solo)
- `jingle-bells.mid` (30KB — full arrangement with multiple instruments)
- `moonlight-sonata.mid` (9.5KB — first movement)
- `morricone-west.mid` (17KB — Once Upon a Time in the West)
- `morricone-westerns-medley.mid` (48KB — Morricone westerns medley)
- `river-flows-in-you.mid` (6.7KB — Yiruma piano)

**NOTE:** Some of these MIDI files have multiple instrument tracks (not just piano). The MidiParser should filter to piano tracks only (MIDI program 0-7) or let the user choose which tracks to use as left/right hand.

### 2. TEST WITH REAL MIDI KEYBOARD
- Plug in Wolf's USB-B keyboard
- Verify Web MIDI API detects it in Electron
- Test note-on/note-off latency
- Test practice mode: does it wait correctly? Does it advance on correct note?
- Test perform mode: does scoring work?

### 3. MIDI LATENCY OPTIMIZATION
If there's perceivable delay between key press and sound:
- Reduce Tone.js attack time (currently 0.005s)
- Try Web Audio API directly instead of Tone.js for lower latency
- Consider pre-loading piano samples instead of synthesis

### 4. SONG IMPORT FROM ELECTRON FILE PICKER
The SongBrowser has a file import button that uses `document.createElement('input')` — this works but the Electron main process has a proper native file picker via IPC (`open-midi-file` handler). Wire SongBrowser to use `window.electronAPI?.openMidiFile()` when running in Electron.

### 5. PERSIST USER LIBRARY
- On import: save song metadata to electron-store
- On launch: reload imported songs from electron-store
- The IPC handlers for saveLibrary/loadLibrary exist but aren't connected to the UI

### 6. RUBY MODE LEVEL PROGRESSION
Currently the level is set manually. Add:
- Auto-advance when a song is completed with 3+ stars
- Level indicator in the UI
- Lock icon on songs above current level
- "Level Up!" celebration animation

### 7. GHOST MODE (Wolf Mode)
The handover spec describes Ghost Mode: "app plays the song once (audio + visual) so Wolf can hear/see it, then switches to practice mode." This is essentially:
1. Play in LISTEN mode once
2. When song ends, auto-switch to PRACTICE mode
3. Reset to beginning
4. Show "Your turn!" message

### 8. SECTION JUMP (Wolf Mode)
Tap a bar number to jump there instantly. Requires:
- Bar number overlay on the falling notes canvas
- Click handler that calls `playbackEngine.seekTo(barStartTimeMs)`
- Calculate bar positions from BPM and time signature

### 9. ANIMATIONS POLISH
- Ruby mode: more sparkle particles, bounce animation on correct note
- Wolf mode: smoother glow transitions on active keys
- Song completion: celebration screen with stats
- Mode transition: fade/slide animations

### 10. APP PACKAGING
```bash
npm run dist
```
This runs electron-builder to create a .dmg. Test that it launches independently.

---

## Architecture Notes

### State Flow
```
MidiInput (physical keyboard) → noteOn callback → AudioEngine.playNote() + PlaybackEngine.onUserInput()
                                                                              ↓
PlaybackEngine → onUpdate callback → React setState → FallingNotes re-render + Piano re-render
                                                              ↓
                                               ScoreEngine.recordHit() → ScoreDisplay re-render
```

### Timing Model
- PlaybackEngine uses `performance.now()` for high-resolution timing
- `currentTimeMs` = elapsed time * speedMultiplier
- Notes are rendered relative to currentTimeMs: future notes above hit line, past notes below
- LOOKAHEAD_MS = 3000ms of future notes visible in the canvas
- Hit line is 20px from bottom of canvas

### Canvas Rendering
- FallingNotes re-renders every frame via useEffect on currentTimeMs
- Notes are sorted by startTime — the render loop breaks early when notes are too far in the future
- Device pixel ratio is handled for Retina displays
- Ruby mode emoji rendering uses canvas fillText

---

## File Locations
- Project: `~/Documents/ACTIVE/wolf-ruby-piano/`
- MIDI files: `src/songs/built-in/`
- Built-in songs (programmatic): `src/songs/library.ts`
- Engine: `src/engine/`
- Types: `src/types/index.ts`
- Animal mapping: `src/animals/animal-map.ts`

## Commands
- `npm run dev` — Start dev mode (Vite + Electron)
- `npm run build` — Build for production
- `npm run dist` — Package as .dmg
- `npm run typecheck` — TypeScript check without build

## NEVER
- Add sheet music notation
- Add cloud/backend dependencies
- Make Ruby mode punishing (no red X, no buzzer)
- Add manual steps Wolf has to remember
- Assume the MIDI files are in the same state as last session — always re-scan

## Color Reference
Wolf: bg=#0A0A12, left=#3366BB, right=#CC8833, whiteKey=#E8E8EE, blackKey=#1A1A22
Ruby: bg=#FEF8F0, Cat/C=#5DCAA5, Dog/D=#F0997B, Elephant/E=#AFA9EC, Frog/F=#97C459, Giraffe/G=#FAC775, Alligator/A=#85B7EB, Bear/B=#ED93B1
