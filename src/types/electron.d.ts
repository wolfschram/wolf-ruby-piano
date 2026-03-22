// Type declarations for the Electron preload API
interface ElectronAPI {
  openMidiFile: () => Promise<{ name: string; path: string; data: ArrayBuffer }[] | null>;
  getAppDataPath: () => Promise<string>;
  saveLibrary: (data: string) => Promise<boolean>;
  loadLibrary: () => Promise<string | null>;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
