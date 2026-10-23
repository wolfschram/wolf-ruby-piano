import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — exposes safe IPC methods to the renderer.
 * The renderer cannot access Node.js or Electron APIs directly.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Open native file picker for MIDI files
  openMidiFile: () => ipcRenderer.invoke('open-midi-file'),

  // App data path
  getAppDataPath: () => ipcRenderer.invoke('get-app-data-path'),

  // Library persistence
  saveLibrary: (data: string) => ipcRenderer.invoke('save-library', data),
  loadLibrary: () => ipcRenderer.invoke('load-library'),

  // Open URL in system browser
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Ruby progress persistence
  saveRubyProgress: (data: string) => ipcRenderer.invoke('save-ruby-progress', data),
  loadRubyProgress: () => ipcRenderer.invoke('load-ruby-progress'),

  // Wolf practice data persistence (spaced repetition)
  savePracticeData: (data: string) => ipcRenderer.invoke('save-practice-data', data),
  loadPracticeData: () => ipcRenderer.invoke('load-practice-data'),

  // Platform info
  platform: process.platform,

  // MCP Bridge — renderer pushes state to main process
  mcpUpdateState: (state: Record<string, unknown>) => ipcRenderer.send('mcp-state-update', state),
  mcpNoteEvent: (event: { note: number; velocity: number; type: 'on' | 'off' }) => ipcRenderer.send('mcp-note-event', event),
  onMcpCommand: (callback: (cmd: { action: string; params: Record<string, unknown> }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, cmd: { action: string; params: Record<string, unknown> }) => callback(cmd);
    ipcRenderer.on('mcp-command', handler);
    // Return cleanup function to remove this specific listener
    return () => { ipcRenderer.removeListener('mcp-command', handler); };
  },

  // Proxy fetch (bypasses CORS for renderer)
  proxyFetch: (url: string) => ipcRenderer.invoke('proxy-fetch', url),
  proxyFetchBuffer: (url: string) => ipcRenderer.invoke('proxy-fetch-buffer', url),
});
