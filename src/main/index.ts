import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Notification, session, shell, type BrowserWindowConstructorOptions } from 'electron';
import { shutdownAgents } from './agents';
import { stopWatchingConversations } from './conversations';
import { hydratePath } from './env';
import { getState, refreshOnStart, registerIpc, setNotifyHandler, startWatching } from './ipc';
import { stopWatchingLimits } from './limits';
import { stopWatching } from './projects';
import { registerVoiceScheme, serveVoiceModels } from './voice';

const here = fileURLToPath(new URL('.', import.meta.url));

let mainWindow: BrowserWindow | null = null;

function platformWindowOptions(): BrowserWindowConstructorOptions {
  if (process.platform === 'darwin') {
    return { titleBarStyle: 'hiddenInset', vibrancy: 'under-window', visualEffectState: 'active' };
  }
  if (process.platform === 'win32') {
    return { frame: false, backgroundMaterial: 'acrylic' };
  }
  return { frame: false };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#f2cfba',
    title: 'Maison des Agents',
    ...platformWindowOptions(),
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });

  const devUrl = process.env.ELECTRON_RENDERER_URL;
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(join(here, '../renderer/index.html'));
  return window;
}

function focusWindow(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
  registerVoiceScheme();

  void app.whenReady().then(async () => {
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      const audioOnly = permission === 'media' && 'mediaTypes' in details && details.mediaTypes?.every((type) => type === 'audio') === true;
      callback(contents === mainWindow?.webContents && audioOnly);
    });
    session.defaultSession.setPermissionCheckHandler((_contents, permission, _origin, details) => permission !== 'media' || details.mediaType === 'audio');
    serveVoiceModels();
    await hydratePath();

    mainWindow = createWindow();
    registerIpc(mainWindow);
    setNotifyHandler((title, body, projectId, taskId) => {
      if (!mainWindow || mainWindow.isFocused() || !Notification.isSupported()) return;
      const notification = new Notification({ title, body });
      notification.on('click', () => {
        focusWindow();
        mainWindow?.webContents.send('task:open', { projectId, taskId });
      });
      notification.show();
    });
    mainWindow.webContents.once('did-finish-load', () => {
      void refreshOnStart().then(() => mainWindow?.webContents.send('state:changed', getState()));
    });
    await startWatching();
  });

  app.on('before-quit', () => {
    shutdownAgents();
    stopWatchingConversations();
    stopWatchingLimits();
    void stopWatching();
  });
  app.on('window-all-closed', () => app.quit());
}
