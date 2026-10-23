// Type declarations for the Electron preload API
interface ElectronAPI {
  openMidiFile: () => Promise<{ name: string; path: string; data: ArrayBuffer }[] | null>;
  getAppDataPath: () => Promise<string>;
  saveLibrary: (data: string) => Promise<boolean>;
  loadLibrary: () => Promise<string | null>;
  saveRubyProgress: (data: string) => Promise<boolean>;
  loadRubyProgress: () => Promise<string | null>;
  savePracticeData: (data: string) => Promise<boolean>;
  loadPracticeData: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  proxyFetch: (url: string) => Promise<string>;
  proxyFetchBuffer: (url: string) => Promise<ArrayBuffer>;
  platform: string;
  // MCP Bridge — renderer pushes state to main process
  mcpUpdateState?: (state: Record<string, unknown>) => void;
  mcpNoteEvent?: (event: { note: number; velocity: number; type: 'on' | 'off' }) => void;
  onMcpCommand?: (callback: (cmd: { action: string; params: Record<string, unknown> }) => void) => (() => void);
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
