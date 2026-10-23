/**
 * useMcpBridge — pushes app state to the Electron main process
 * so the MCP server can read it via the HTTP bridge on port 9876.
 *
 * Call this hook in both WolfMode and RubyMode to keep state synced.
 */

import { useEffect, useCallback, useRef } from 'react';
import { PlaybackState, Song } from '../types';

interface McpBridgeOptions {
  mode: 'wolf' | 'ruby';
  currentSong: Song | null;
  playbackState: PlaybackState;
  midiConnected: boolean;
  midiDeviceName: string;
  songList: Song[];
  onCommand?: (action: string, params: Record<string, unknown>) => void;
}

export function useMcpBridge(opts: McpBridgeOptions): {
  reportNoteOn: (note: number, velocity: number) => void;
  reportNoteOff: (note: number) => void;
} {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  const lastStateJson = useRef('');

  // Push state updates (throttled to avoid spam)
  useEffect(() => {
    if (!api?.mcpUpdateState) return;

    const state = {
      mode: opts.mode,
      currentSong: opts.currentSong
        ? {
            id: opts.currentSong.id,
            title: opts.currentSong.title,
            artist: opts.currentSong.artist,
            difficulty: opts.currentSong.difficulty,
          }
        : null,
      playback: {
        isPlaying: opts.playbackState.isPlaying,
        currentTimeMs: Math.round(opts.playbackState.currentTimeMs),
        speedMultiplier: opts.playbackState.speedMultiplier,
        mode: opts.playbackState.mode,
        handFilter: opts.playbackState.handFilter,
      },
      midi: {
        connected: opts.midiConnected,
        deviceName: opts.midiDeviceName,
      },
      songList: opts.songList.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        difficulty: s.difficulty,
        category: s.category ?? 'unknown',
      })),
    };

    // Only send if changed (skip currentTimeMs jitter)
    const stateKey = JSON.stringify({
      ...state,
      playback: { ...state.playback, currentTimeMs: Math.round(state.playback.currentTimeMs / 500) * 500 },
    });

    if (stateKey !== lastStateJson.current) {
      lastStateJson.current = stateKey;
      api.mcpUpdateState(state);
    }
  }, [
    opts.mode,
    opts.currentSong?.id,
    opts.playbackState.isPlaying,
    opts.playbackState.mode,
    opts.playbackState.speedMultiplier,
    opts.playbackState.handFilter,
    opts.midiConnected,
    Math.round(opts.playbackState.currentTimeMs / 500),
  ]);

  // Listen for commands from MCP
  useEffect(() => {
    if (!api?.onMcpCommand || !opts.onCommand) return;
    const cleanup = api.onMcpCommand((cmd) => {
      opts.onCommand?.(cmd.action, cmd.params);
    });
    return cleanup; // Remove listener on re-render or unmount
  }, [opts.onCommand]);

  // Note event reporters
  const reportNoteOn = useCallback((note: number, velocity: number) => {
    api?.mcpNoteEvent?.({ note, velocity, type: 'on' });
  }, [api]);

  const reportNoteOff = useCallback((note: number) => {
    api?.mcpNoteEvent?.({ note, velocity: 0, type: 'off' });
  }, [api]);

  return { reportNoteOn, reportNoteOff };
}

export default useMcpBridge;
