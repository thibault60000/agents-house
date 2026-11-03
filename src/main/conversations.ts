import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { app } from 'electron';
import type { DesktopConversation, Project } from '@shared/types';

const POLL_MS = 4000;
const FOCUS_GRACE_MS = 3000;

interface CachedFile {
  mtimeMs: number;
  raw: Record<string, any> | null;
}

const cache = new Map<string, CachedFile>();

export async function listSessionFiles(): Promise<string[]> {
  const root = join(app.getPath('appData'), 'Claude');
  const out: string[] = [];
  for (const area of ['claude-code-sessions', 'local-agent-mode-sessions']) {
    for (const account of await fs.readdir(join(root, area)).catch(() => [] as string[])) {
      for (const org of await fs.readdir(join(root, area, account)).catch(() => [] as string[])) {
        const dir = join(root, area, account, org);
        for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
          if (name.startsWith('local_') && name.endsWith('.json')) out.push(join(dir, name));
        }
      }
    }
  }
  return out;
}

export async function readSession(path: string): Promise<Record<string, any> | null> {
  try {
    const { mtimeMs } = await fs.stat(path);
    const cached = cache.get(path);
    if (cached && cached.mtimeMs === mtimeMs) return cached.raw;
    let raw: Record<string, any> | null = null;
    try {
      raw = JSON.parse(await fs.readFile(path, 'utf8'));
    } catch {
      return cached?.raw ?? null;
    }
    cache.set(path, { mtimeMs, raw });
    return raw;
  } catch {
    return null;
  }
}

function isAlive(pid: unknown): boolean {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function liveStatuses(): Promise<Map<string, string>> {
  const dir = join(homedir(), '.claude', 'sessions');
  const out = new Map<string, string>();
  for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
    if (!name.endsWith('.json')) continue;
    try {
      const data = JSON.parse(await fs.readFile(join(dir, name), 'utf8'));
      if (typeof data.hostSessionId === 'string' && isAlive(data.pid)) out.set(data.hostSessionId, String(data.status ?? ''));
    } catch {
    }
  }
  return out;
}

export function projectFor(cwd: string, projects: Project[]): Project | null {
  const path = resolve(cwd);
  let best: Project | null = null;
  for (const project of projects) {
    const inside = path === project.path || path.startsWith(project.path + sep);
    if (inside && (!best || project.path.length > best.path.length)) best = project;
  }
  return best;
}

export async function listConversations(projects: Project[]): Promise<DesktopConversation[]> {
  const [files, live] = await Promise.all([listSessionFiles(), liveStatuses()]);
  const out = new Map<string, DesktopConversation>();
  for (const path of files) {
    const raw = await readSession(path);
    if (!raw || raw.isArchived || typeof raw.sessionId !== 'string') continue;
    const cwd = typeof raw.originCwd === 'string' ? raw.originCwd : typeof raw.cwd === 'string' ? raw.cwd : '';
    if (!cwd) continue;

    const lastActivity = Number(raw.lastActivityAt) || 0;
    const lastSeen = Math.max(Number(raw.lastFocusedAt) || 0, Number(raw.latestUserFrameAt) || 0);
    const status = live.get(raw.sessionId);
    const running = status !== undefined && status !== 'idle';
    const unread = lastActivity > lastSeen + FOCUS_GRACE_MS || Boolean(raw.interruptedAwaitingPerson);

    out.set(raw.sessionId, {
      id: raw.sessionId,
      sessionId: typeof raw.cliSessionId === 'string' ? raw.cliSessionId : null,
      title: typeof raw.title === 'string' && raw.title ? raw.title : 'Conversation sans titre',
      cwd,
      projectId: projectFor(cwd, projects)?.id ?? null,
      state: running ? 'running' : unread ? 'unread' : 'open',
      lastActivity,
    });
  }
  return [...out.values()].sort((a, b) => b.lastActivity - a.lastActivity);
}

let timer: NodeJS.Timeout | null = null;
let lastPayload = '';

export function watchConversations(getProjects: () => Project[], onChange: (list: DesktopConversation[]) => void): void {
  const tick = async () => {
    const list = await listConversations(getProjects()).catch(() => null);
    if (!list) return;
    const payload = JSON.stringify(list);
    if (payload === lastPayload) return;
    lastPayload = payload;
    onChange(list);
  };
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);
  timer.unref();
}

export function stopWatchingConversations(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
