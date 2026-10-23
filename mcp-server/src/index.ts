#!/usr/bin/env node
/**
 * Wolf & Ruby Piano MCP Server
 *
 * Connects to the piano app's HTTP bridge (localhost:9876) and exposes
 * tools that let Claude see what's happening — MIDI input, playback state,
 * current song, and send transport commands.
 *
 * Transport: stdio (runs as a subprocess of the Claude desktop app)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import http from "http";
import fs from "fs";
import os from "os";
import nodePath from "path";

// ============================================================
// HTTP client to talk to the Electron bridge
// ============================================================
const BRIDGE_URL = "http://127.0.0.1:9876";

/**
 * Read the ephemeral auth token written by the Electron app.
 * Falls back gracefully if not found (allows unauthenticated dev mode).
 */
function loadBridgeToken(): string {
  const candidates = [
    // macOS
    nodePath.join(os.homedir(), "Library", "Application Support", "wolf-ruby-piano", ".bridge-token"),
    // Linux
    nodePath.join(os.homedir(), ".config", "wolf-ruby-piano", ".bridge-token"),
    // Windows
    nodePath.join(os.homedir(), "AppData", "Roaming", "wolf-ruby-piano", ".bridge-token"),
  ];
  for (const p of candidates) {
    try {
      return fs.readFileSync(p, "utf-8").trim();
    } catch { /* try next */ }
  }
  console.warn("[MCP] No bridge token found — requests may fail auth");
  return "";
}

let bridgeToken = loadBridgeToken();

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (bridgeToken) headers["Authorization"] = `Bearer ${bridgeToken}`;
  return headers;
}

async function bridgeGet(path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BRIDGE_URL}${path}`, { timeout: 3000, headers: getAuthHeaders() }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from bridge: ${body}`));
        }
      });
    });
    req.on("error", (err) => reject(new Error(`Bridge connection failed: ${err.message}. Is the piano app running?`)));
    req.on("timeout", () => { req.destroy(); reject(new Error("Bridge timeout — is the piano app running?")); });
  });
}

async function bridgePost(path: string, data: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request(`${BRIDGE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(payload)), ...getAuthHeaders() },
      timeout: 3000,
    }, (res) => {
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Invalid JSON from bridge: ${body}`));
        }
      });
    });
    req.on("error", (err) => reject(new Error(`Bridge connection failed: ${err.message}. Is the piano app running?`)));
    req.on("timeout", () => { req.destroy(); reject(new Error("Bridge timeout")); });
    req.write(payload);
    req.end();
  });
}

// ============================================================
// Note name helpers
// ============================================================
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function midiToName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const note = NOTE_NAMES[midi % 12];
  return `${note}${octave}`;
}

// ============================================================
// MCP Server
// ============================================================
const server = new McpServer({
  name: "wolf-ruby-piano-mcp-server",
  version: "1.0.0",
});

// ── Tool: piano_get_state ──────────────────────────────────
server.registerTool(
  "piano_get_state",
  {
    title: "Get Piano App State",
    description: `Get the current state of the Wolf & Ruby Piano app — which mode is active (wolf/ruby), current song, playback status (playing/paused, position, speed, mode), MIDI connection status, and currently held notes.

Returns:
  {
    "mode": "wolf" | "ruby" | null,
    "currentSong": { "id", "title", "artist", "difficulty" } | null,
    "playback": { "isPlaying", "currentTimeMs", "speedMultiplier", "mode", "handFilter" },
    "midi": { "connected", "deviceName" },
    "activeNotes": [60, 64, 67]  // MIDI note numbers currently held down
  }

Use this to understand what the user is doing right now in the app.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const state = await bridgeGet("/state") as Record<string, unknown>;

      // Enrich active notes with names
      const activeNotes = (state.activeNotes as number[]) || [];
      const namedNotes = activeNotes.map((n) => `${midiToName(n)} (${n})`);

      const lines: string[] = [];
      lines.push("# Piano App State\n");

      // Mode
      lines.push(`**Mode:** ${state.mode ?? "Home screen (no mode selected)"}`);

      // Song
      const song = state.currentSong as Record<string, unknown> | null;
      if (song) {
        lines.push(`**Song:** ${song.title} — ${song.artist} (difficulty ${song.difficulty})`);
      } else {
        lines.push("**Song:** None loaded");
      }

      // Playback
      const pb = state.playback as Record<string, unknown>;
      const timeStr = formatMs(pb.currentTimeMs as number);
      lines.push(`**Playback:** ${pb.isPlaying ? "▶ Playing" : "⏸ Paused"} at ${timeStr}, speed ${pb.speedMultiplier}x, mode: ${pb.mode}, hand: ${pb.handFilter}`);

      // MIDI
      const midi = state.midi as Record<string, unknown>;
      lines.push(`**MIDI:** ${midi.connected ? `✅ Connected — ${midi.deviceName}` : "❌ Not connected"}`);

      // Active notes
      if (namedNotes.length > 0) {
        lines.push(`**Notes held:** ${namedNotes.join(", ")}`);
      } else {
        lines.push("**Notes held:** None");
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// ── Tool: piano_get_recent_notes ───────────────────────────
server.registerTool(
  "piano_get_recent_notes",
  {
    title: "Get Recent Notes Played",
    description: `Get the last N notes played on the MIDI keyboard. Shows note name, MIDI number, velocity, timestamp, and whether it was a note-on or note-off event.

Use this to see what the user just played, analyze their timing, check if they're hitting the right notes, or understand their playing patterns.

Args:
  - limit (number): Max notes to return, 1-200 (default: 50)

Returns a chronological list of note events with human-readable names.`,
    inputSchema: {
      limit: z.number().int().min(1).max(200).default(50).describe("Max note events to return"),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ limit }) => {
    try {
      const notes = (await bridgeGet("/recent-notes")) as Array<{
        note: number;
        velocity: number;
        timestamp: number;
        type: "on" | "off";
      }>;

      const recent = notes.slice(-limit);

      if (recent.length === 0) {
        return {
          content: [{ type: "text", text: "No notes played yet. Try pressing some keys on the MIDI keyboard." }],
        };
      }

      const lines: string[] = [];
      lines.push(`# Recent Notes (last ${recent.length})\n`);

      // Group into musical phrases (gap > 500ms = new phrase)
      let phraseNum = 1;
      let lastTime = 0;
      const noteOns = recent.filter((n) => n.type === "on");

      for (const evt of noteOns) {
        if (lastTime > 0 && evt.timestamp - lastTime > 1000) {
          lines.push(`\n--- Phrase ${++phraseNum} ---\n`);
        }
        const name = midiToName(evt.note);
        const deltaMs = lastTime > 0 ? evt.timestamp - lastTime : 0;
        lines.push(`${name} (${evt.note}) vel=${evt.velocity} ${deltaMs > 0 ? `+${deltaMs}ms` : ""}`);
        lastTime = evt.timestamp;
      }

      lines.push(`\n**Total note-on events:** ${noteOns.length}`);
      if (noteOns.length >= 2) {
        const span = noteOns[noteOns.length - 1].timestamp - noteOns[0].timestamp;
        lines.push(`**Time span:** ${formatMs(span)}`);
        const avgGap = span / (noteOns.length - 1);
        lines.push(`**Avg gap between notes:** ${Math.round(avgGap)}ms`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// ── Tool: piano_get_songs ──────────────────────────────────
server.registerTool(
  "piano_get_songs",
  {
    title: "List Available Songs",
    description: `List all songs available in the piano app, with their title, artist, difficulty, and category (ruby = children's songs, wolf = film scores/classical).

Use this to suggest songs to the user or understand what's available.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const songs = (await bridgeGet("/songs")) as Array<{
        id: string;
        title: string;
        artist: string;
        difficulty: number;
        category: string;
      }>;

      if (songs.length === 0) {
        return {
          content: [{ type: "text", text: "No songs in the library yet." }],
        };
      }

      const lines: string[] = [];
      lines.push("# Song Library\n");

      const rubySongs = songs.filter((s) => s.category === "ruby");
      const wolfSongs = songs.filter((s) => s.category === "wolf");

      if (rubySongs.length > 0) {
        lines.push("## Ruby Songs (Children's)");
        for (const s of rubySongs) {
          lines.push(`- **${s.title}** — ${s.artist} (difficulty ${s.difficulty}) [${s.id}]`);
        }
        lines.push("");
      }

      if (wolfSongs.length > 0) {
        lines.push("## Wolf Songs (Film Scores / Classical)");
        for (const s of wolfSongs) {
          lines.push(`- **${s.title}** — ${s.artist} (difficulty ${s.difficulty}) [${s.id}]`);
        }
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// ── Tool: piano_transport ──────────────────────────────────
server.registerTool(
  "piano_transport",
  {
    title: "Control Playback",
    description: `Send transport commands to the piano app — play, pause, stop, seek, or change speed.

Args:
  - action: "play" | "pause" | "stop" | "seek" | "setSpeed"
  - timeMs (number, optional): For seek — position in milliseconds
  - speed (number, optional): For setSpeed — multiplier (0.25 to 1.5)

Use this to help the user navigate a song, slow it down, or restart.`,
    inputSchema: {
      action: z.enum(["play", "pause", "stop", "seek", "setSpeed"]).describe("Transport action"),
      timeMs: z.number().min(0).optional().describe("Seek position in ms (only for 'seek' action)"),
      speed: z.number().min(0.25).max(1.5).optional().describe("Speed multiplier (only for 'setSpeed' action)"),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ action, timeMs, speed }) => {
    try {
      const params: Record<string, unknown> = {};
      if (action === "seek" && timeMs !== undefined) params.timeMs = timeMs;
      if (action === "setSpeed" && speed !== undefined) params.speed = speed;

      await bridgePost("/command", { action, params });

      const messages: Record<string, string> = {
        play: "▶ Playing",
        pause: "⏸ Paused",
        stop: "⏹ Stopped and rewound to start",
        seek: `⏩ Seeked to ${formatMs(timeMs ?? 0)}`,
        setSpeed: `🔄 Speed set to ${speed}x`,
      };

      return {
        content: [{ type: "text", text: messages[action] ?? `Done: ${action}` }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// ── Tool: piano_check_connection ───────────────────────────
server.registerTool(
  "piano_check_connection",
  {
    title: "Check App Connection",
    description: `Check if the Wolf & Ruby Piano app is running and the MCP bridge is reachable. Returns app info and connection status.

Use this first to verify the app is running before using other tools.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const ping = (await bridgeGet("/ping")) as Record<string, unknown>;
      return {
        content: [{
          type: "text",
          text: `✅ Connected to ${ping.app} v${ping.version}\nBridge is running on ${BRIDGE_URL}`,
        }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `❌ Cannot connect to piano app.\n${(err as Error).message}\n\nMake sure the app is running (npm run dev in the wolf-ruby-piano directory).`,
        }],
      };
    }
  }
);

// ── Tool: piano_analyze_playing ────────────────────────────
server.registerTool(
  "piano_analyze_playing",
  {
    title: "Analyze Recent Playing",
    description: `Analyze the user's recent playing — note range, most common notes, tempo consistency, and basic patterns. Good for giving feedback on their practice session.

This fetches the recent note history and runs basic analysis.`,
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async () => {
    try {
      const notes = (await bridgeGet("/recent-notes")) as Array<{
        note: number;
        velocity: number;
        timestamp: number;
        type: "on" | "off";
      }>;

      const noteOns = notes.filter((n) => n.type === "on");

      if (noteOns.length < 3) {
        return {
          content: [{ type: "text", text: "Not enough notes to analyze — play at least a few notes first!" }],
        };
      }

      const lines: string[] = [];
      lines.push("# Playing Analysis\n");

      // Note range
      const pitches = noteOns.map((n) => n.note);
      const minNote = Math.min(...pitches);
      const maxNote = Math.max(...pitches);
      lines.push(`**Range:** ${midiToName(minNote)} to ${midiToName(maxNote)} (${maxNote - minNote} semitones)`);

      // Note frequency
      const freq: Record<string, number> = {};
      for (const p of pitches) {
        const name = midiToName(p);
        freq[name] = (freq[name] ?? 0) + 1;
      }
      const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
      lines.push(`**Most played:** ${sorted.slice(0, 5).map(([n, c]) => `${n} (${c}x)`).join(", ")}`);

      // Unique notes
      const uniqueNotes = new Set(pitches);
      lines.push(`**Unique notes:** ${uniqueNotes.size}`);

      // Velocity analysis
      const velocities = noteOns.map((n) => n.velocity);
      const avgVel = Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length);
      const minVel = Math.min(...velocities);
      const maxVel = Math.max(...velocities);
      lines.push(`**Velocity:** avg ${avgVel}, range ${minVel}–${maxVel} (${maxVel - minVel > 40 ? "good dynamics!" : "quite even"})`);

      // Timing analysis
      const gaps: number[] = [];
      for (let i = 1; i < noteOns.length; i++) {
        gaps.push(noteOns[i].timestamp - noteOns[i - 1].timestamp);
      }
      if (gaps.length > 0) {
        const avgGap = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        const stdDev = Math.round(Math.sqrt(gaps.reduce((sum, g) => sum + (g - avgGap) ** 2, 0) / gaps.length));
        lines.push(`**Avg gap between notes:** ${avgGap}ms`);
        lines.push(`**Timing consistency:** stddev ${stdDev}ms (${stdDev < 50 ? "very consistent!" : stdDev < 100 ? "good" : "some variation"})`);

        // Estimate BPM (assume eighth notes)
        if (avgGap > 100 && avgGap < 2000) {
          const estimatedBPM = Math.round(60000 / avgGap);
          lines.push(`**Estimated tempo:** ~${estimatedBPM} BPM (if eighth notes)`);
        }
      }

      lines.push(`\n**Total notes:** ${noteOns.length}`);
      const totalTime = noteOns[noteOns.length - 1].timestamp - noteOns[0].timestamp;
      lines.push(`**Session length:** ${formatMs(totalTime)}`);

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
      };
    }
  }
);

// ============================================================
// Helpers
// ============================================================
function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ============================================================
// Start
// ============================================================
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Wolf & Ruby Piano MCP server running via stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
