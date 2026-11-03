import { createReadStream, promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import type { HistoryMessage, HistorySession, HistorySource, HistoryTranscript, Project } from '@shared/types';
import { listSessionFiles, liveStatuses, projectFor, readSession } from './conversations';

const PROBE_BYTES = 96 * 1024;
const MAX_SESSIONS = 600;
const MAX_MESSAGES = 1500;
const MAX_TEXT = 60_000;

interface Summary {
  id: string;
  path: string;
  mtimeMs: number;
  size: number;
  cwd: string;
  source: HistorySource;
  title: string;
}

const summaries = new Map<string, Summary>();

function cleanUserText(raw: string): string {
  return raw
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<local-command-(stdout|stderr|caveat)>[\s\S]*?<\/local-command-\1>/g, '')
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    .replace(/<command-args>([\s\S]*?)<\/command-args>/g, ' $1')
    .replace(/<command-name>([\s\S]*?)<\/command-name>/g, '$1')
    .trim();
}

function userText(entry: any): string {
  if (entry.type !== 'user' || entry.isMeta || entry.isSidechain || entry.isCompactSummary) return '';
  const content = entry.message?.content;
  if (typeof content === 'string') return cleanUserText(content);
  if (!Array.isArray(content)) return '';
  return cleanUserText(content.filter((block: any) => block?.type === 'text').map((block: any) => block.text).join('\n'));
}

function lastMatch(chunk: string, pattern: RegExp): string | null {
  let found: string | null = null;
  for (const match of chunk.matchAll(pattern)) found = match[1] ?? null;
  if (found === null) return null;
  try {
    return JSON.parse(`"${found}"`);
  } catch {
    return null;
  }
}

function sourceOf(entrypoint: string | null): HistorySource {
  if (entrypoint === 'claude-desktop') return 'desktop';
  if (entrypoint === 'claude-vscode') return 'vscode';
  if (entrypoint === 'cli') return 'terminal';
  return 'other';
}

async function summarize(path: string, id: string, mtimeMs: number, size: number): Promise<Summary | null> {
  const handle = await fs.open(path, 'r').catch(() => null);
  if (!handle) return null;
  try {
    const head = Buffer.alloc(Math.min(PROBE_BYTES, size));
    await handle.read(head, 0, head.length, 0);
    const tail = Buffer.alloc(Math.min(PROBE_BYTES, size));
    await handle.read(tail, 0, tail.length, size - tail.length);
    const start = head.toString('utf8');
    const end = tail.toString('utf8');
    const cwd = lastMatch(start, /"cwd":"((?:[^"\\]|\\.)*)"/g) ?? lastMatch(end, /"cwd":"((?:[^"\\]|\\.)*)"/g);
    if (!cwd) return null;
    let firstPrompt = '';
    for (const line of start.split('\n')) {
      if (!line.includes('"type":"user"')) continue;
      try {
        firstPrompt = userText(JSON.parse(line));
      } catch {
        continue;
      }
      if (firstPrompt) break;
    }
    const title =
      lastMatch(end, /"customTitle":"((?:[^"\\]|\\.)*)"/g) ??
      lastMatch(end, /"aiTitle":"((?:[^"\\]|\\.)*)"/g) ??
      lastMatch(start, /"customTitle":"((?:[^"\\]|\\.)*)"/g) ??
      lastMatch(start, /"aiTitle":"((?:[^"\\]|\\.)*)"/g) ??
      (firstPrompt || lastMatch(end, /"lastPrompt":"((?:[^"\\]|\\.)*)"/g));
    if (!title) return null;
    return { id, path, mtimeMs, size, cwd, source: sourceOf(lastMatch(start, /"entrypoint":"([\w-]+)"/g)), title: title.replace(/\s+/g, ' ').trim().slice(0, 140) };
  } finally {
    await handle.close();
  }
}

async function desktopIndex(): Promise<Map<string, { title: string | null; archived: boolean; live: boolean }>> {
  const [files, live] = await Promise.all([listSessionFiles(), liveStatuses()]);
  const index = new Map<string, { title: string | null; archived: boolean; live: boolean }>();
  for (const file of files) {
    const raw = await readSession(file);
    if (typeof raw?.cliSessionId !== 'string') continue;
    const status = live.get(raw.sessionId);
    index.set(raw.cliSessionId, {
      title: typeof raw.title === 'string' && raw.title ? raw.title : null,
      archived: Boolean(raw.isArchived),
      live: status !== undefined && status !== 'idle',
    });
  }
  return index;
}

export async function listHistory(projects: Project[]): Promise<HistorySession[]> {
  const root = join(homedir(), '.claude', 'projects');
  const found: { path: string; id: string; mtimeMs: number; size: number }[] = [];
  for (const dir of await fs.readdir(root).catch(() => [] as string[])) {
    for (const name of await fs.readdir(join(root, dir)).catch(() => [] as string[])) {
      if (!name.endsWith('.jsonl')) continue;
      const path = join(root, dir, name);
      const stat = await fs.stat(path).catch(() => null);
      if (stat) found.push({ path, id: name.slice(0, -'.jsonl'.length), mtimeMs: stat.mtimeMs, size: stat.size });
    }
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const desktop = await desktopIndex();
  const sessions: HistorySession[] = [];
  for (const file of found.slice(0, MAX_SESSIONS)) {
    let summary = summaries.get(file.id);
    if (!summary || summary.mtimeMs !== file.mtimeMs || summary.size !== file.size) {
      const fresh = await summarize(file.path, file.id, file.mtimeMs, file.size);
      if (!fresh) continue;
      summary = fresh;
      summaries.set(file.id, fresh);
    }
    const known = desktop.get(summary.id);
    sessions.push({
      id: summary.id,
      title: known?.title ?? summary.title,
      cwd: summary.cwd,
      projectId: projectFor(summary.cwd, projects)?.id ?? null,
      source: known ? 'desktop' : summary.source,
      archived: known?.archived ?? false,
      lastActivity: summary.mtimeMs,
      live: known?.live ?? false,
    });
  }
  return sessions;
}

export async function readHistory(id: string, projects: Project[]): Promise<HistoryTranscript> {
  const session = (await listHistory(projects)).find((s) => s.id === id);
  const path = summaries.get(id)?.path;
  if (!session || !path) throw new Error('Discussion introuvable.');

  const messages: HistoryMessage[] = [];
  let tools: string[] = [];
  let toolsAt = 0;
  const flushTools = () => {
    if (tools.length === 0) return;
    const counts = new Map<string, number>();
    for (const name of tools) counts.set(name, (counts.get(name) ?? 0) + 1);
    messages.push({ role: 'tools', text: [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(' · '), at: toolsAt });
    tools = [];
  };
  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.includes('"type":"user"') && !line.includes('"type":"assistant"')) continue;
    let entry: any;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.isSidechain) continue;
    const at = Date.parse(entry.timestamp) || 0;
    if (entry.type === 'user') {
      const text = userText(entry);
      if (!text) continue;
      flushTools();
      messages.push({ role: 'user', text: text.slice(0, MAX_TEXT), at });
    } else if (entry.type === 'assistant' && Array.isArray(entry.message?.content)) {
      for (const block of entry.message.content) {
        if (block?.type === 'tool_use' && typeof block.name === 'string') {
          tools.push(block.name);
          toolsAt = at;
        } else if (block?.type === 'text' && block.text?.trim()) {
          flushTools();
          messages.push({ role: 'assistant', text: String(block.text).slice(0, MAX_TEXT), at });
        }
      }
    }
  }
  flushTools();
  const truncated = messages.length > MAX_MESSAGES;
  return { session, messages: truncated ? messages.slice(-MAX_MESSAGES) : messages, truncated };
}
