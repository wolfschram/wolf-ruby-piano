# Wolf & Ruby Piano — Codebase Analysis

**Date:** 2026-03-23
**Analyst:** Claude (Opus 4.6)

---

## What This Project Is

A father-daughter piano learning desktop app (Electron + React + TypeScript). Two modes:

- **Wolf Mode**: Adult learner (Wolf, 49, ADHD, visual learner). Synthesia-style falling notes for Morricone film scores. Three playback modes (listen/practice/perform), backward chaining, spaced repetition, MIDI transport keys.
- **Ruby Mode**: 5-year-old beginner. Animal emoji gamification, generous scoring, level progression (3→7 keys), instant wins.

The app connects to a physical 88-key MIDI keyboard via Web MIDI API, plays real Salamander Grand Piano samples via Tone.js, and has an MCP server for Claude Desktop integration.

---

## Architecture Assessment

### What Works Well

- **Singleton engine pattern** — PlaybackEngine, AudioEngine, ScoreEngine as singletons, ref-based in React. Solid for 60fps performance.
- **Real piano samples** — Salamander Grand Piano from Tone.js CDN. Authentic sound, graceful loading.
- **Transport key mapping** — A0/B0/C8/B7 piano keys control playback without touching the mouse. Excellent UX for Wolf's ADHD workflow.
- **Backward chaining** — Fully implemented in PlaybackEngine. Practice from the END backward, expanding. ADHD-friendly dopamine loop.
- **MCP bridge with token auth** — Ephemeral token regenerated per launch, written to userData. Secure by design.
- **MIDI parser intelligence** — Multi-track orchestral MIDI → piano arrangement via scoring algorithm. Adjacent note merging for playability.
- **Error boundaries** — Root-level + per-mode error boundaries. App never shows black screen.
- **Song persistence** — Imported songs saved to Electron userData/library.json, reloaded on launch.
- **32 MIDI files in public/midi/** — Good built-in library (up from the 6 mentioned in CLAUDE.md).
- **PracticeTracker** — Spaced repetition, section mastery heatmap, review suggestions, practice streaks.

### File Structure (Clean)

```
src/engine/     — 5 engines (Playback, Audio, Score, MidiParser, MidiSearch, PracticeTracker)
src/modes/      — WolfMode.tsx (1053 lines), RubyMode.tsx (927 lines)
src/components/ — 9 components (Piano, FallingNotes, SongBrowser, etc.)
src/hooks/      — useMcpBridge.ts
electron/       — main.ts + preload.ts
mcp-server/     — MCP server (stdio transport)
```

---

## Bugs & Issues

### BUG-1: `getRubyKeyX` is defined but never used (FallingNotes.tsx:95)

The `getRubyKeyX` callback is defined to map notes to wider Ruby-mode key positions, but the render loop always uses `getKeyX` (line 170). Ruby mode falling notes use the full piano layout instead of the simplified 3-7 key layout. This means Ruby notes render as tiny blocks on a 60-key piano rather than big friendly blocks on 3-5 keys.

**Impact:** High — defeats Ruby mode's visual simplicity for a 5-year-old.
**Fix:** Use `getRubyKeyX` when `mode === 'ruby'`, skip notes that return `null`.

### BUG-2: `onReady` prop declared but never called (FallingNotes.tsx:19)

The `FallingNotes` component accepts an `onReady` callback prop but never invokes it. Dead code.

**Impact:** Low — no consumer depends on it.

### BUG-3: Sparkle particles use module-level mutable state (FallingNotes.tsx:316)

`sparkles` array is a module-level `let` variable mutated inside the render effect. If two FallingNotes instances exist (mode switch transition), they share and corrupt the same array. The `filter` in `drawSparkles` mutates array contents during iteration.

**Impact:** Low (only one instance at a time in practice), but architecturally fragile.

### BUG-4: PERFORM mode doesn't advance `currentNoteIndex` (PlaybackEngine.ts:466-471)

In the tick loop, `LISTEN` mode calls `this.currentNoteIndex++` after playing a note (line 471), but `PERFORM` mode falls through to the same `this.currentNoteIndex++` without first adding to `playedNotes`. This means in PERFORM mode, notes that the user doesn't play in time are silently skipped — no miss is recorded.

**Impact:** Medium — perform mode scoring is incomplete (misses aren't tracked by PlaybackEngine, only hits).

### BUG-5: `midiInput.dispose()` called in RubyMode cleanup but input is shared singleton

Both WolfMode (line 269) and RubyMode (line 246) call `midiInput.dispose()` on unmount. Since MidiInput is a singleton, disposing it in one mode kills MIDI for the other if mode-switching happens. WolfMode also calls `playbackRef.current.dispose()` but RubyMode creates `new PlaybackEngine()` in useRef — these are separate instances, not the singleton, so they don't conflict.

**Impact:** Medium — switching Wolf→Ruby→Wolf could leave MIDI disconnected until page refresh.

### BUG-6: MCP `onCommand` listener accumulates without cleanup (useMcpBridge.ts:84-89)

`api.onMcpCommand` registers a new `ipcRenderer.on` listener every time `opts.onCommand` changes, but never removes the old listener. This leaks event listeners over time.

**Impact:** Low (listener count grows slowly), but could cause duplicate command execution.

### BUG-7: CSP blocks `localhost` connections for MCP bridge

The Content-Security-Policy in `index.html` (line 6) has `connect-src` that does not include `http://127.0.0.1:9876` or `http://localhost:9876`. The MCP bridge server runs on `127.0.0.1:9876`. If the renderer tries to fetch the bridge directly, CSP will block it.

**Impact:** Low — the MCP bridge is accessed from the MCP server (Node.js process), not from the renderer. But `useMcpBridge` uses IPC, not HTTP, so this works. However, if anyone adds direct HTTP calls from the renderer to the bridge, CSP will block them.

### BUG-8: RubyMode level-up logic auto-promotes too aggressively (RubyMode.tsx:280-288)

Getting 2+ stars on ANY song immediately bumps `rubyLevel`. A 5-year-old who nails "Hot Cross Buns" once jumps to Level 2 (5 keys) permanently with no way back. There's no per-level gate — she doesn't need to complete all Level 1 songs.

**Impact:** Medium — Ruby could be overwhelmed by too many keys too soon.

---

## Incomplete / Unwired Features

### INC-1: LoopControl UI exists but bar-based looping is approximate

`PlaybackEngine.setLoop()` converts bar numbers to milliseconds using a hardcoded 2000ms/bar assumption. This ignores actual BPM and time signature. The loop boundaries won't align with real musical bars for any song not at exactly 120 BPM in 4/4 time.

**Fix needed:** Calculate bar boundaries from BPM and time signature data in the parsed MIDI.

### INC-2: StaffNotation component exists but not verified

`StaffNotation.tsx` is imported and rendered in both modes. Without reading the full component, it's unclear if it renders actual staff notation or is a placeholder. The CLAUDE.md says "Never show sheet music notation" — this may violate that rule, or it may be a simplified note-position display.

**Update:** CLAUDE.md rule says no staff notation, but the code shows it togglable. If Wolf asked for it, this is intentional. If not, it should be removed per CLAUDE.md's "NEVER" rules.

### INC-3: ExerciseBrowser component exists but exercise library is thin

`src/exercises/ExerciseLibrary.ts` exists but content was not fully analyzed. The exercise browser UI is wired in both modes.

### INC-4: No song deletion from library

Users can import songs but cannot remove them. The library grows forever. CLAUDE.md lists this as a known gap.

### INC-5: No note labels toggle on piano keys

CLAUDE.md lists this as a known gap. Helpful for Ruby mode especially.

### INC-6: PracticeTracker heatmap wired into WolfMode but not RubyMode

WolfMode shows the section mastery heatmap at the bottom of the falling notes area. RubyMode doesn't show any mastery visualization.

### INC-7: Ruby mode song filtering doesn't actually filter by level

`RubyMode.tsx:531`: `rubySongs = songs.filter(s => !s.category || s.category === 'ruby')` — this shows all Ruby songs regardless of the selected `rubyLevel`. The level pills are decorative; they don't filter the song list by difficulty appropriate for the level.

### INC-8: No "perform" mode in Ruby

RubyMode only supports "listen" and "practice" modes. There's no scored performance mode for Ruby. This is likely intentional (not punishing wrong notes for a 5-year-old), but means there's no way to earn stars through timed play.

---

## Code Quality Issues

### CQ-1: WolfMode.tsx is 1053 lines, RubyMode.tsx is 927 lines

Both mode files exceed the 500-line CLAUDE.md guideline. They mix UI rendering, MIDI handling, playback control, scoring, and state management. The library view and playing view should be separate components.

### CQ-2: Duplicated logic between WolfMode and RubyMode

MIDI input handling, transport key mapping, playback callbacks, MCP bridge setup, and toggle/seek/play handlers are near-identical in both modes. This should be extracted to a shared hook (e.g., `usePianoPlayback`).

### CQ-3: `new Set([...prev, item])` pattern on every note (multiple locations)

`setActiveNotes(prev => new Set([...prev, note]))` creates a new array then a new Set on every single MIDI note-on event. At 60fps with rapid playing, this generates significant GC pressure. Should use `Set.add()` with a copy:
```ts
setActiveNotes(prev => { const s = new Set(prev); s.add(note); return s; });
```

### CQ-4: `hitNotes` Set grows unbounded per session

`hitNotes` state accumulates note indices forever during a session. For a 500-note song, this creates a 500-element Set that's spread into a new Set on every hit. No reset on loop boundary either.

### CQ-5: Inline styles everywhere

All styling is inline React `style={{}}` objects. No Tailwind usage despite it being in the dependency list. This makes the JSX extremely verbose and hard to maintain.

### CQ-6: `formatTime` function duplicated

Identical `formatTime(ms)` function exists in WolfMode.tsx:1045, RubyMode.tsx:920, and mcp-server/src/index.ts:524.

---

## Security

- **Token auth on MCP bridge**: Good — ephemeral per-launch, Bearer token required.
- **Context isolation**: Good — `contextIsolation: true`, `nodeIntegration: false`.
- **URL validation on `open-external`**: Good — only allows `http://` and `https://`.
- **CSP**: Reasonable — allows CDN samples and MIDI search sites.
- **No secrets in code**: Clean — no hardcoded keys or credentials.
- **Proxy fetch has no URL validation**: `proxy-fetch` and `proxy-fetch-buffer` IPC handlers accept any URL string and fetch it from the main process. A compromised renderer could use this as an SSRF proxy.

---

## Build & Dependencies

- `electron-store` is in dependencies but not imported anywhere in the codebase. Dead dependency.
- `tailwindcss` + `@tailwindcss/postcss` + `autoprefixer` + `postcss` are in devDependencies but inline styles are used everywhere. Unused CSS toolchain.
- No `npm test` script — `package.json` has no test configuration.
- No ESLint or Prettier config files.

---

## Summary: Top 5 Priorities

| # | Issue | Type | Impact |
|---|-------|------|--------|
| 1 | **BUG-1**: Ruby falling notes use full piano layout instead of simplified 3-7 key view | Bug | High — core Ruby UX broken |
| 2 | **BUG-5**: Singleton `midiInput.dispose()` kills MIDI across modes | Bug | Medium — mode switching breaks MIDI |
| 3 | **INC-7**: Ruby level filter doesn't actually filter songs | Incomplete | Medium — levels are decorative |
| 4 | **BUG-4**: Perform mode doesn't track misses | Bug | Medium — scoring incomplete |
| 5 | **CQ-1/CQ-2**: Mode files too large, heavy duplication | Quality | Medium — maintainability debt |
