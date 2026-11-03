import { resolve, sep } from 'node:path';
import { BrowserWindow, clipboard, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron';
import {
  DEFAULT_SETTINGS,
  EFFORT_LEVELS,
  PROJECT_ROOM_TYPES,
  type AppState,
  type DetectedProject,
  type Note,
  type Project,
  type ProjectPatch,
  type ProjectRoomType,
  type Settings,
} from '@shared/types';
import { distributeColors } from '@shared/colors';
import * as agents from './agents';
import { listConversations, watchConversations } from './conversations';
import { listHistory, readHistory } from './history';
import * as ide from './ide';
import * as limits from './limits';
import * as logistics from './logistics';
import * as projects from './projects';
import { getSettings, store } from './store';
import { prepareVoice } from './voice';

let window: BrowserWindow | null = null;

const detected = new Set<string>();

function send(channel: string, payload: unknown): void {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}

export function getState(): AppState {
  return {
    rootPath: store.get('rootPath'),
    projects: store.get('projects'),
    settings: getSettings(),
    platform: process.platform,
  };
}

function saveProjects(list: Project[]): void {
  store.set('projects', distributeColors(list));
}

const LEGACY_COLORS = ['#ff8a5c', '#6cc6ff', '#b48cff', '#7fe0a0', '#ffd166', '#ff6fa8', '#5ee6d6', '#c9a27e', '#f2777a', '#8fb8ff', '#a3d977', '#e6a4ff'];

function migrateColors(): void {
  if (store.get('colorScheme') >= 2) return;
  store.set('colorScheme', 2);
  saveProjects(store.get('projects').map((p) => (LEGACY_COLORS.includes(p.color) ? { ...p, color: '' } : { ...p, colorCustom: true })));
}

export function findProject(id: unknown): Project | undefined {
  return store.get('projects').find((p) => p.id === id);
}

function requireProject(id: unknown): Project {
  const project = findProject(id);
  if (!project) throw new Error('Projet inconnu.');
  return project;
}

function onDetected(path: string): void {
  if (store.get('projects').some((p) => p.path === path)) return;
  if (store.get('ignoredPaths').includes(path)) return;
  detected.add(path);
  const payload: DetectedProject = { path, name: path.split(sep).pop() ?? path };
  send('project:detected', payload);
}

export async function refreshOnStart(): Promise<void> {
  const root = store.get('rootPath');
  const kept = await Promise.all(store.get('projects').map((p) => projects.inspectProject(p.path, p)));
  saveProjects(kept);
  if (!root) return;
  const folders = await projects.listSubfolders(root).catch(() => [] as string[]);
  for (const folder of folders) onDetected(folder);
}

export async function startWatching(): Promise<void> {
  const root = store.get('rootPath');
  if (root) await projects.watchRoot(root, onDetected).catch((error) => console.error('[watcher]', error));
}

async function rescan(): Promise<AppState> {
  const root = store.get('rootPath');
  if (root) {
    saveProjects(await projects.scanRoot(root, store.get('projects'), store.get('ignoredPaths')));
  } else {
    const kept = await Promise.all(store.get('projects').map((p) => projects.inspectProject(p.path, p)));
    saveProjects(kept);
  }
  return getState();
}

const SETTING_CHECKS: { [K in keyof Settings]: (value: unknown) => boolean } = {
  defaultIdeId: (v) => v === null || typeof v === 'string',
  quality: (v) => v === 'low' || v === 'medium' || v === 'high',
  grass: (v) => typeof v === 'boolean',
  shadows: (v) => typeof v === 'boolean',
  postProcess: (v) => typeof v === 'boolean',
  liquidRefraction: (v) => typeof v === 'boolean',
  dayCycle: (v) => v === 'real' || v === 'day' || v === 'night' || v === 'fast',
  theme: (v) => v === 'auto' || v === 'light' || v === 'dark',
  sounds: (v) => typeof v === 'boolean',
  permissionMode: (v) => ['acceptEdits', 'auto', 'plan', 'dontAsk', 'manual', 'bypassPermissions'].includes(v as string),
  model: (v) => typeof v === 'string' && (v === '' || /^[\w.:\-[\]]+$/.test(v)),
  effort: (v) => v === '' || (EFFORT_LEVELS as readonly unknown[]).includes(v),
  limitAlarms: (v) => typeof v === 'boolean',
};

function sanitizeSettings(patch: unknown): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries((patch ?? {}) as Record<string, unknown>)) {
    if (key in DEFAULT_SETTINGS && SETTING_CHECKS[key as keyof Settings]?.(value)) out[key] = value;
  }
  return out as Partial<Settings>;
}

function applyPatch(project: Project, patch: ProjectPatch): Project {
  const next = { ...project };
  if (typeof patch.name === 'string' && patch.name.trim()) next.name = patch.name.trim().slice(0, 60);
  if (typeof patch.color === 'string' && /^#[0-9a-f]{6}$/i.test(patch.color)) {
    next.color = patch.color;
    next.colorCustom = true;
  }
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled;
  if (patch.roomType === null) delete next.roomType;
  else if (PROJECT_ROOM_TYPES.includes(patch.roomType as ProjectRoomType)) next.roomType = patch.roomType as ProjectRoomType;
  if ('ideId' in patch) {
    if (typeof patch.ideId === 'string' && patch.ideId) next.ideId = patch.ideId;
    else delete next.ideId;
  }
  return next;
}

function insideProject(project: Project, relPath: string): string {
  const full = resolve(project.path, relPath);
  if (full !== project.path && !full.startsWith(project.path + sep)) throw new Error('Chemin hors du projet.');
  return full;
}

function handle<A extends unknown[], R>(channel: string, fn: (...args: A) => R | Promise<R>): void {
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!window || event.sender !== window.webContents) throw new Error('Émetteur non autorisé.');
    return fn(...(args as A));
  });
}

export function registerIpc(target: BrowserWindow): void {
  window = target;
  migrateColors();

  agents.initAgents({
    resolveProject: findProject,
    emit(event) {
      send('task:event', event);
      notifyIfNeeded(event);
    },
  });

  handle('state:get', () => getState());

  handle('projects:chooseRoot', async () => {
    const result = await dialog.showOpenDialog(target, {
      title: 'Choisir le dossier racine des projets',
      properties: ['openDirectory'],
    });
    const root = result.filePaths[0];
    if (result.canceled || !root) return null;
    const previousRoot = store.get('rootPath');
    store.set('rootPath', resolve(root));
    if (previousRoot !== resolve(root)) {
      saveProjects(store.get('projects').filter((p) => p.external));
    }
    const state = await rescan();
    await startWatching();
    return state;
  });

  handle('projects:rescan', () => rescan());

  handle('projects:addExternal', async () => {
    const result = await dialog.showOpenDialog(target, { title: 'Ajouter un dossier', properties: ['openDirectory'] });
    const path = result.filePaths[0];
    if (result.canceled || !path) return null;
    const resolved = resolve(path);
    if (!store.get('projects').some((p) => p.path === resolved)) {
      const root = store.get('rootPath');
      const isChild = root !== null && resolved.startsWith(resolve(root) + sep);
      saveProjects([...store.get('projects'), await projects.inspectProject(resolved, undefined, !isChild)]);
    }
    return getState();
  });

  handle('projects:update', (id: string, patch: ProjectPatch) => {
    requireProject(id);
    saveProjects(store.get('projects').map((p) => (p.id === id ? applyPatch(p, patch) : p)));
    return getState();
  });

  handle('projects:remove', (id: string) => {
    const project = requireProject(id);
    saveProjects(store.get('projects').filter((p) => p.id !== id));
    if (!project.external) store.set('ignoredPaths', [...store.get('ignoredPaths'), project.path]);
    return getState();
  });

  handle('projects:acceptDetected', async (path: string) => {
    if (!detected.has(path)) throw new Error('Dossier non signalé.');
    detected.delete(path);
    saveProjects([...store.get('projects'), await projects.inspectProject(path)]);
    return getState();
  });

  handle('projects:ignoreDetected', (path: string) => {
    if (!detected.delete(path)) return;
    store.set('ignoredPaths', [...store.get('ignoredPaths'), path]);
  });

  handle('settings:update', (patch: Partial<Settings>) => {
    store.set('settings', { ...getSettings(), ...sanitizeSettings(patch) });
    send('state:changed', getState());
    return getState();
  });

  handle('docs:list', (id: string) => projects.listDocs(requireProject(id).path));
  handle('docs:read', (id: string, relPath: string) => projects.readDoc(requireProject(id).path, String(relPath)));
  handle('git:info', (id: string) => projects.gitInfo(requireProject(id).path));
  handle('git:diff', (id: string, relPath?: string) => projects.gitDiff(requireProject(id).path, relPath));

  handle('ide:list', (force?: boolean) => ide.listIdes(force === true));
  handle('ide:open', async (id: string, ideId?: string, relPath?: string) => {
    const project = requireProject(id);
    const chosen = ideId ?? project.ideId ?? getSettings().defaultIdeId;
    const fallback = (await ide.listIdes()).find((entry) => entry.available)?.id;
    const final = chosen ?? fallback;
    if (!final) throw new Error('Aucun IDE détecté.');
    await ide.openInIde(final, relPath ? insideProject(project, relPath) : project.path);
  });
  handle('ide:addCustom', (name: string, command: string) => ide.addCustomIde(String(name), String(command)));
  handle('ide:removeCustom', (id: string) => ide.removeCustomIde(String(id)));
  handle('os:explorer', (id: string) => ide.openInExplorer(requireProject(id).path));
  handle('os:terminal', (id: string) => ide.openTerminal(requireProject(id).path));
  handle('os:copy', (text: string) => clipboard.writeText(String(text)));

  handle('notes:list', (id: string) => store.get('notes')[requireProject(id).id] ?? []);
  handle('notes:save', (id: string, notes: Note[]) => {
    const project = requireProject(id);
    const clean = (Array.isArray(notes) ? notes : []).slice(0, 200).map((n) => ({
      id: String(n.id),
      text: String(n.text).slice(0, 1000),
      done: Boolean(n.done),
      createdAt: Number(n.createdAt) || Date.now(),
    }));
    store.set('notes', { ...store.get('notes'), [project.id]: clean });
  });

  handle('claude:status', (force?: boolean) => agents.claudeStatus(force === true));
  handle('tasks:list', (id?: string) => agents.listTasks(id));
  handle('tasks:send', (id: string, prompt: string, continueTaskId?: string) =>
    agents.sendPrompt(requireProject(id).id, String(prompt), continueTaskId),
  );
  handle('tasks:cancel', (taskId: string) => agents.cancelTask(String(taskId)));
  handle('tasks:acknowledge', (taskId: string) => agents.acknowledgeTask(String(taskId)));
  handle('tasks:clear', (id: string) => agents.clearHistory(requireProject(id).id));

  handle('logistics:all', () => logistics.getLogistics());
  handle('logistics:readFile', (id: string) => logistics.readCatalogFile(String(id)));
  handle('logistics:usage', () => logistics.getUsage());
  handle('logistics:artifacts', () => ({ items: store.get('artifacts'), updatedAt: store.get('artifactsAt') }));
  handle('logistics:refreshArtifacts', () => logistics.refreshArtifacts());
  handle('logistics:openArtifact', (url: string) => logistics.openArtifact(String(url)));

  handle('voice:prepare', () => prepareVoice((fraction) => send('voice:progress', fraction)));

  handle('limits:get', () => limits.getLimits());
  limits.watchLimits({
    claude: () => agents.claudeStatus(),
    enabled: () => getSettings().limitAlarms,
    onChange: (value) => send('limits:update', value),
  });

  handle('history:list', () => listHistory(store.get('projects')));
  handle('history:read', (id: string) => readHistory(String(id), store.get('projects')));
  handle('history:resume', async (id: string) => {
    const { session, messages } = await readHistory(String(id), store.get('projects'));
    if (!session.projectId) throw new Error("Cette discussion n'appartient à aucune pièce de la maison.");
    if (session.live) throw new Error('Cette discussion est encore en cours dans Claude Desktop.');
    const spoken = messages.filter((m) => m.role !== 'tools').slice(-200);
    return agents.adoptSession(session.projectId, session.id, session.title, spoken.map((m) => ({ role: m.role as 'user' | 'assistant', text: m.text, at: m.at })));
  });

  handle('conversations:list', () => listConversations(store.get('projects')));
  watchConversations(
    () => store.get('projects'),
    (list) => send('conversations:update', list),
  );

  handle('window:control', (action: 'minimize' | 'maximize' | 'close') => {
    if (action === 'minimize') target.minimize();
    else if (action === 'close') target.close();
    else if (target.isMaximized()) target.unmaximize();
    else target.maximize();
  });
}

let notifyHandler: (title: string, body: string, projectId: string, taskId: string) => void = () => {};

export function setNotifyHandler(fn: typeof notifyHandler): void {
  notifyHandler = fn;
}

function notifyIfNeeded(event: Parameters<Parameters<typeof agents.initAgents>[0]['emit']>[0]): void {
  if (event.channel !== 'task:done' && event.channel !== 'task:error') return;
  const { task } = event;
  if (task.status === 'cancelled') return;
  const project = findProject(task.projectId);
  notifyHandler(project?.name ?? 'Maison des Agents', task.progress, task.projectId, task.id);
}
