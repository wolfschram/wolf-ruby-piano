# Wolf & Ruby Piano — CLAUDE.md

## Project Identity
A father-daughter piano learning desktop app. Two modes: **Wolf Mode** (adult, Synthesia-style falling notes for Morricone film scores) and **Ruby Mode** (5-year-old, animal emoji gamification). Built by Wolf Schram with Claude (Anthropic). Electron app for macOS.

## Who Is Wolf
Wolfgang "Wolf" Schram, 49. VP of Engineering with 25+ years in broadcast media and enterprise technology (SMPTE 2110, AV systems, large-scale integrations). Lives with ADHD and dyslexia. Learns visually — sees which keys to press, NOT by reading sheet music. Has a very good musical ear. Owns a full 88-key digital piano (USB MIDI). Wants to play Ennio Morricone film scores. Needs small-chunk repetition (step back one note, retry 5-6 times) for his brain to absorb passages.

## Who Is Ruby
Ruby, age 5½. Wolf's daughter. Curious, energetic, attention span under 2 minutes. The #1 product challenge: keeping her engaged past 90 seconds. Needs instant wins, generous scoring, animal characters, and songs she recognizes. Current song library (6 songs) is too small — she'll get bored in days.

## Communication Rules
- Wolf uses voice-to-text. Auto-correct errors silently ("Mindy" = MIDI, "get up" = GitHub).
- Keep responses short, scannable, bullet points preferred.
- Lead with the answer, not the reasoning.
- When building: ask clarifying questions BEFORE executing.
- When something is creative/visual: show a draft, iterate from there.

## Stack
- **Electron 41** + **React 19** + **TypeScript 5.9** + **Vite 8** + **Tailwind CSS 4**
- **Tone.js 15** — Sampler with Salamander Grand Piano samples (real Yamaha C5 recordings, 30 samples A0-C8, loaded from Tone.js CDN ~5MB)
- **@tonejs/midi 2** — MIDI file parsing (.mid → Song objects)
- **Web MIDI API** — physical keyboard input (auto-detect, hot-plug)
- **MCP Server** — Claude AI integration via HTTP bridge on port 9876

## File Structure
```
src/
  App.tsx                    # Mode selection + song persistence (loads/saves library.json)
  main.tsx                   # React 19 entry point
  types/index.ts             # NoteEvent, Song, PlaybackState, ScoreState, PianoKey
  engine/
    PlaybackEngine.ts        # 60fps rAF loop, 3 modes (listen/practice/perform), step-back
    AudioEngine.ts           # Tone.js Sampler (Salamander Piano, CDN-loaded)
    ScoreEngine.ts           # Hit timing (perfect ≤50ms, good ≤150ms, miss), stars
    MidiParser.ts            # .mid → Song with auto difficulty + hand detection
    MidiSearch.ts            # BitMidi search + download (113k+ files)
  midi/MidiInput.ts          # Web MIDI API keyboard connection
  hooks/useMcpBridge.ts      # State reporter → Electron IPC → MCP server
  components/
    Piano.tsx                # 3D CSS perspective keyboard (52 white + 36 black keys)
    FallingNotes.tsx         # Canvas 60fps falling blocks (3s lookahead)
    SongBrowser.tsx          # Library + online BitMidi search (My Songs / Search Online tabs)
    SpeedControl.tsx         # 25%–150% slider + quick presets
    LoopControl.tsx          # Bar-based practice loops
    ScoreDisplay.tsx         # Accuracy % (wolf) or star rating (ruby)
  modes/
    WolfMode.tsx             # Adult mode: hand separation, 3 modes, transport keys
    RubyMode.tsx             # Child mode: animals, levels 1-4, encouragement
  songs/
    library.ts               # 12 built-in songs (6 ruby + 6 wolf)
    built-in/*.mid           # 9 MIDI source files (not loaded — library.ts uses programmatic arrays)
  animals/animal-map.ts      # Note → animal emoji/color mapping, level definitions
electron/
  main.ts                    # Window, IPC handlers, HTTP bridge (:9876), file system
  preload.ts                 # Context isolation bridge (electronAPI)
mcp-server/
  src/index.ts               # 4 MCP tools for Claude (piano_get_state, etc.)
```

## Architectural Patterns
- **Singleton engines**: PlaybackEngine, AudioEngine, ScoreEngine — imported as singletons, not React state
- **Ref-based playback**: PlaybackEngine lives in useRef (60fps perf), synced to React state via onUpdate callback
- **3-mode playback**: listen (auto-play + computer speakers), practice (pause + wait for input), perform (timed scoring)
- **Audio routing**: listen → computer speakers; practice/perform → silent (piano's own speakers only)
- **MCP bridge**: renderer → IPC → HTTP server (:9876) → MCP server (stdio, Claude Desktop subprocess)
- **Song persistence**: imported songs saved to Electron userData/library.json, reloaded on launch

## MIDI Transport Key Map
| Key | MIDI | Position | Action |
|-----|------|----------|--------|
| A0  | 21   | Leftmost white key | Play / Pause toggle |
| B0  | 23   | 2nd white from left | Stop & Rewind (visual reset) |
| C8  | 108  | Rightmost white key | Step back one note |
| B7  | 107  | 2nd white from right | Play from current position |

These transport keys let Wolf practice without ever touching the mouse. Step-back + play-from-here creates a retry loop for memorizing passages.

## Song Import Pipeline
1. **File picker**: "Import MIDI" button → native file dialog for .mid/.midi
2. **Drag & drop**: onto SongBrowser component
3. **Online search**: "Search Online (113k+)" tab → BitMidi search → click "Add" → download + parse + import
4. **Persistence**: all imported songs auto-save to userData/library.json

## Ruby Mode Levels
- Level 1: C, D, E (3 keys = 🐱 cat, 🐶 dog, 🐘 elephant)
- Level 2: C, D, E, F, G (5 keys, + 🐸 frog, 🦒 giraffe)
- Level 3-4: C, D, E, F, G, A, B (full octave, + 🐊 alligator, 🐻 bear)

## CSP (Content Security Policy)
index.html allows:
- `connect-src`: tonejs.github.io (samples), bitmidi.com (search), freemidi.org, midiworld.com, kunstderfuge.com, piano-midi.de, classicalarchives.com, localhost (MCP)
- `media-src`: tonejs.github.io (audio MP3s)

## Design Rules
- Wolf Mode: dark theme (#0A0A12 bg), blue left hand (#3366BB), amber right hand (#CC8833)
- Ruby Mode: dark theme, animal colors on keys and falling blocks
- Full piano keyboard C2-C7 in both modes
- Ruby Mode only highlights level-appropriate keys
- No sheet music notation — purely visual learning
- Animations smooth and satisfying, not flashy

## NEVER Rules
- Never use synthesized tones — always real piano samples (Salamander Grand Piano)
- Never remove MIDI transport key support — Wolf controls everything from the piano
- Never auto-play sound in practice/perform mode — only listen mode uses computer speakers
- Never make wrong notes punishing in Ruby mode — no red X, no buzzer, just no reward
- Never require mouse interaction during practice — transport keys handle everything
- Never show sheet music notation
- Never use traditional music terminology in Ruby mode
- Never auto-play without user action
- Never add complexity without Wolf asking for it

## ALWAYS Rules
- Auto-detect MIDI keyboard on launch (Web MIDI API)
- Show keyboard connection status + "Loading piano samples..." during CDN download
- Default to 100% speed for listen mode, adjustable via slider
- Default to 40% speed for Ruby mode
- Start Ruby mode with only 3 keys visible (C, D, E)
- Parse MIDI files to separate left/right hand by track index or pitch threshold
- Save imported songs between sessions (library.json)

## Known Gaps
- Built-in .mid files in songs/built-in/ NOT loaded (library.ts uses programmatic arrays instead)
- BitMidi search returns first page only (15 results, no pagination)
- No sustain pedal support (CC64 MIDI messages ignored)
- MCP piano_transport tool not fully connected end-to-end
- Ruby song library too small (6 songs, needs 50-100+)
- No song deletion from library
- No progress tracking dashboard (time spent, accuracy trends)
- No note labels toggle on piano keys

## MCP Server Tools
1. `piano_get_state` — mode, song, playback, MIDI status, active notes
2. `piano_get_recent_notes` — last 200 note events with phrase grouping
3. `piano_get_songs` — all songs by category
4. `piano_transport` — play, pause, stop, seek, setSpeed (planned)
