# 🎹 Wolf & Ruby Piano

A father-daughter piano learning app. Built with love, ADHD, and a 5-year-old's attention span in mind.

## What Is This?

**Wolf & Ruby Piano** is a desktop app that teaches piano through visual falling notes (like Synthesia) with two modes designed for very different learners:

- **Wolf Mode** — For adults who learn visually. Falling blocks in blue (left hand) and amber (right hand). Three playback modes: Listen (hear the song), Practice (pause at each note, take your time), Perform (play at speed, get scored). Film scores, classical, anything you want to learn.

- **Ruby Mode** — For young children (ages 4-7). Animals fall from the sky and you catch them by pressing the right piano key. Cat = C, Dog = D, Elephant = E. Generous scoring, encouraging messages, and progressive difficulty levels starting with just 3 keys.

## Features

- **Real piano sound** — Salamander Grand Piano samples (Yamaha C5 concert grand)
- **MIDI keyboard support** — Plug in any USB MIDI keyboard, auto-detected
- **Transport keys on the piano** — Play/pause, stop, step-back-one-note, play-from-here. Never touch the mouse while practicing
- **113,000+ songs** — Search and import MIDI files from BitMidi directly in the app
- **Drag & drop import** — Drop .mid files onto the app to add them
- **Song persistence** — Imported songs survive restarts
- **Speed control** — 25% to 150% playback speed
- **Hand separation** — Practice left hand, right hand, or both
- **AI teaching assistant** — MCP server lets Claude see what you're playing and help you learn (optional)

## Quick Start

```bash
git clone https://github.com/YOUR_USERNAME/wolf-ruby-piano.git
cd wolf-ruby-piano
npm install
npm run dev
```

This starts Vite (renderer) + Electron (desktop shell) together. The app opens automatically.

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Electron 41 |
| UI | React 19 + TypeScript 5.9 |
| Bundler | Vite 8 |
| Audio | Tone.js 15 (Sampler + Salamander Grand Piano) |
| MIDI Input | Web MIDI API |
| MIDI Parsing | @tonejs/midi 2 |
| AI Integration | MCP Server (Claude) |

## MIDI Transport Keys

If you have a full 88-key piano, these extreme keys become transport controls:

| Key | Position | Action |
|-----|----------|--------|
| A0 | Leftmost white key | Play / Pause |
| B0 | 2nd white from left | Stop & Rewind |
| C8 | Rightmost white key | Step back one note |
| B7 | 2nd white from right | Play from here |

The step-back + play-from-here combo is the core practice workflow: go back one note, try again, repeat until it sticks.

## Adding Songs

Three ways to add songs:

1. **Search Online** — Go to the "Search Online (113k+)" tab in the song browser. Search anything ("Morricone", "Beethoven", "Frozen"). Click "Add" to import.
2. **Import Files** — Click "Import MIDI" or drag .mid files onto the song browser.
3. **Contribute** — Submit MIDI files via pull request to the `songs/` directory.

## Architecture

See [CLAUDE.md](CLAUDE.md) for full technical context, or the [Architecture Document](docs/architecture.docx) for a comprehensive review-ready document.

```
src/engine/       — PlaybackEngine, AudioEngine, ScoreEngine, MidiParser, MidiSearch
src/modes/        — WolfMode.tsx, RubyMode.tsx
src/components/   — Piano, FallingNotes, SongBrowser, SpeedControl, etc.
electron/         — Main process, IPC handlers, HTTP bridge
mcp-server/       — Claude AI integration (4 tools)
```

## The Story

Wolf (49, VP of Engineering, ADHD/dyslexia) wants to learn Morricone on the piano. His daughter Ruby (5½) wants to catch animals. Nothing on the market combined visual falling-note learning with real piano sound, hand separation, MIDI transport controls, and AI teaching assistance in one app. So we built it.

The biggest challenge right now: keeping Ruby engaged past 90 seconds. If you have ideas about children's UX, gamification, or know where to find hundreds of children's MIDI files — we'd love your help.

## Contributing

Contributions welcome! Especially:
- **Children's MIDI files** — Simple arrangements of songs kids know
- **UX ideas for young learners** — Engagement mechanics, reward systems
- **Bug fixes and features** — See the issues tab

## License

MIT

## Credits

- **Piano Samples**: [Salamander Grand Piano](https://github.com/sfztools/SalamanderGrandPiano) (CC-BY 3.0)
- **MIDI Library**: [BitMidi](https://bitmidi.com) (113,000+ community MIDI files)
- **Audio Engine**: [Tone.js](https://tonejs.github.io)
- **MIDI Parsing**: [@tonejs/midi](https://github.com/Tonejs/Midi)
- **Built with**: [Claude](https://claude.ai) by Anthropic
