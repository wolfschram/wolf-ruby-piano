import { app, BrowserWindow, ipcMain, dialog, shell, net } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as crypto from 'crypto';

let mainWindow: BrowserWindow | null = null;

// Ephemeral session token for MCP bridge auth — regenerated on every launch
const bridgeToken = crypto.randomBytes(32).toString('hex');

// ============================================================
// MCP Bridge — HTTP server for Claude to read app state
// ============================================================
interface AppState {
  mode: 'wolf' | 'ruby' | null;
  currentSong: { id: string; title: string; artist: string; difficulty: number } | null;
  playback: {
    isPlaying: boolean;
    currentTimeMs: number;
    speedMultiplier: number;
    mode: string; // listen, practice, perform
    handFilter: string;
  };
  midi: {
    connected: boolean;
    deviceName: string;
  };
  activeNotes: number[];
  recentNotes: Array<{ note: number; velocity: number; timestamp: number; type: 'on' | 'off' }>;
  songList: Array<{ id: string; title: string; artist: string; difficulty: number; category: string }>;
}

let appState: AppState = {
  mode: null,
  currentSong: null,
  playback: { isPlaying: false, currentTimeMs: 0, speedMultiplier: 0.5, mode: 'listen', handFilter: 'both' },
  midi: { connected: false, deviceName: '' },
  activeNotes: [],
  recentNotes: [],
  songList: [],
};

// Pending commands from MCP → renderer
let pendingCommands: Array<{ action: string; params: Record<string, unknown> }> = [];

function startBridgeServer(): void {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Allow CORS preflight + ping without auth
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token auth — require Bearer token on all endpoints except /ping
    if (req.url !== '/ping') {
      const authHeader = req.headers['authorization'] ?? '';
      if (authHeader !== `Bearer ${bridgeToken}`) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized — invalid or missing token' }));
        return;
      }
    }

    if (req.method === 'GET' && req.url === '/state') {
      res.writeHead(200);
      res.end(JSON.stringify(appState));
    } else if (req.method === 'GET' && req.url === '/recent-notes') {
      res.writeHead(200);
      res.end(JSON.stringify(appState.recentNotes));
    } else if (req.method === 'GET' && req.url === '/songs') {
      res.writeHead(200);
      res.end(JSON.stringify(appState.songList));
    } else if (req.method === 'POST' && req.url === '/command') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const cmd = JSON.parse(body);
          pendingCommands.push(cmd);
          // Forward to renderer
          if (mainWindow) {
            mainWindow.webContents.send('mcp-command', cmd);
          }
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, app: 'wolf-ruby-piano', version: '1.0.0' }));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(9876, '127.0.0.1', () => {
    console.log('MCP Bridge server running on http://127.0.0.1:9876');
    // Write token to userData so MCP server can authenticate
    const tokenPath = path.join(app.getPath('userData'), '.bridge-token');
    fs.writeFileSync(tokenPath, bridgeToken, 'utf-8');
    console.log(`MCP Bridge token written to ${tokenPath}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn('MCP Bridge port 9876 already in use — bridge disabled');
    } else {
      console.error('MCP Bridge error:', err);
    }
  });
}

// IPC: renderer pushes state updates to main process
ipcMain.on('mcp-state-update', (_event, state: Partial<AppState>) => {
  appState = { ...appState, ...state };
});

// IPC: renderer pushes note events
ipcMain.on('mcp-note-event', (_event, noteEvent: { note: number; velocity: number; type: 'on' | 'off' }) => {
  const entry = { ...noteEvent, timestamp: Date.now() };
  appState.recentNotes.push(entry);
  // Keep last 200 notes
  if (appState.recentNotes.length > 200) {
    appState.recentNotes = appState.recentNotes.slice(-200);
  }
  // Update active notes
  if (noteEvent.type === 'on') {
    if (!appState.activeNotes.includes(noteEvent.note)) {
      appState.activeNotes.push(noteEvent.note);
    }
  } else {
    appState.activeNotes = appState.activeNotes.filter(n => n !== noteEvent.note);
  }
});

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Wolf & Ruby Piano',
    backgroundColor: '#0A0A12',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools available via Cmd+Option+I — no longer auto-opens
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  startBridgeServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============================================================
// IPC Handlers — file system access for MIDI import/export
// ============================================================

// Open file dialog for MIDI import
ipcMain.handle('open-midi-file', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import MIDI File',
    filters: [
      { name: 'MIDI Files', extensions: ['mid', 'midi'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  // Read files and return as buffers
  const files = result.filePaths.map(fp => ({
    name: path.basename(fp),
    path: fp,
    data: fs.readFileSync(fp).buffer,
  }));

  return files;
});

// Get app data path for storing user preferences and imported songs
ipcMain.handle('get-app-data-path', () => {
  return app.getPath('userData');
});

// Save user song library metadata
ipcMain.handle('save-library', async (_event, data: string) => {
  const libPath = path.join(app.getPath('userData'), 'library.json');
  fs.writeFileSync(libPath, data, 'utf-8');
  return true;
});

// Load user song library metadata
ipcMain.handle('load-library', async () => {
  const libPath = path.join(app.getPath('userData'), 'library.json');
  if (fs.existsSync(libPath)) {
    return fs.readFileSync(libPath, 'utf-8');
  }
  return null;
});

// Save Ruby progress (level, stars, etc.)
ipcMain.handle('save-ruby-progress', async (_event, data: string) => {
  const progressPath = path.join(app.getPath('userData'), 'ruby-progress.json');
  fs.writeFileSync(progressPath, data, 'utf-8');
  return true;
});

// Load Ruby progress
ipcMain.handle('load-ruby-progress', async () => {
  const progressPath = path.join(app.getPath('userData'), 'ruby-progress.json');
  if (fs.existsSync(progressPath)) {
    return fs.readFileSync(progressPath, 'utf-8');
  }
  return null;
});

// Save practice tracker data (Wolf spaced repetition)
ipcMain.handle('save-practice-data', async (_event, data: string) => {
  const dataPath = path.join(app.getPath('userData'), 'practice-data.json');
  fs.writeFileSync(dataPath, data, 'utf-8');
  return true;
});

// Load practice tracker data
ipcMain.handle('load-practice-data', async () => {
  const dataPath = path.join(app.getPath('userData'), 'practice-data.json');
  if (fs.existsSync(dataPath)) {
    return fs.readFileSync(dataPath, 'utf-8');
  }
  return null;
});

// Open URL in system browser
ipcMain.handle('open-external', async (_event, url: string) => {
  if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});

// Proxy fetch for renderer (bypass CORS)
ipcMain.handle('proxy-fetch', async (_event, url: string) => {
  return new Promise<string>((resolve, reject) => {
    const request = net.request(url);
    let body = '';
    request.on('response', (response) => {
      // Follow redirects automatically (net module does this)
      response.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
    });
    request.on('error', (err: Error) => reject(err));
    request.end();
  });
});

ipcMain.handle('proxy-fetch-buffer', async (_event, url: string) => {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const request = net.request(url);
    const chunks: Buffer[] = [];
    request.on('response', (response) => {
      response.on('data', (chunk: Buffer) => { chunks.push(chunk); });
      response.on('end', () => {
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) {
          const combined = Buffer.concat(chunks);
          resolve(combined.buffer.slice(combined.byteOffset, combined.byteOffset + combined.byteLength));
        } else {
          reject(new Error(`HTTP ${response.statusCode}`));
        }
      });
    });
    request.on('error', (err: Error) => reject(err));
    request.end();
  });
});
