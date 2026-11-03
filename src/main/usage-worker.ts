import { createReadStream, promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parentPort, workerData } from 'node:worker_threads';
import { emptyStats, type ModelStats, type PastSchedule, type UsageByFolder, type UsageDay } from '@shared/types';

interface FileEntry {
  version: number;
  mtimeMs: number;
  size: number;
  days: Record<string, Record<string, ModelStats>>;
  hasCost: boolean;
  cwd: string | null;
  lastAt: number;
  artifacts: string[];
  artifactTitles: Record<string, string>;
  scheduled: { label: string; at: number; tool: string }[];
}

const CACHE_VERSION = 3;
const ARTIFACT_URL = /https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+/g;
const URL_SOURCE = 'https://claude\\.ai/(?:code/)?artifact/[\\w-]+';
const TITLE_PATTERNS = [
  new RegExp(`\\[([^\\]\\n]{2,120})\\]\\((${URL_SOURCE})\\)`, 'g'),
  new RegExp(`\\\\*"title\\\\*":\\s*\\\\*"([^"\\\\]{2,120})\\\\*",\\s*\\\\*"url\\\\*":\\s*\\\\*"(${URL_SOURCE})`, 'g'),
];
const URL_THEN_TITLE = new RegExp(`\\\\*"url\\\\*":\\s*\\\\*"(${URL_SOURCE})\\\\*",\\s*\\\\*"title\\\\*":\\s*\\\\*"([^"\\\\]{2,120})`, 'g');

const SCHEDULING_TOOLS = new Set(['CronCreate', 'ScheduleWakeup', 'RemoteTrigger', 'mcp__scheduled-tasks__create_scheduled_task']);

type Cache = Record<string, FileEntry>;

const { cachePath } = workerData as { cachePath: string };
const ROOT = join(homedir(), '.claude', 'projects');

function dayOf(timestamp: unknown): string | null {
  if (typeof timestamp !== 'string' && typeof timestamp !== 'number') return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function lineCount(text: unknown): number {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) count++;
  return text.endsWith('\n') ? count - 1 : count;
}

function bucket(days: FileEntry['days'], day: string, model: string): ModelStats {
  const byModel = (days[day] ??= {});
  return (byModel[model] ??= emptyStats());
}

function countTool(stats: ModelStats, name: string, input: Record<string, any>): void {
  stats.tools++;
  if (name === 'Write') {
    stats.linesAdded += lineCount(input.content);
    stats.edits++;
  } else if (name === 'Edit') {
    stats.linesAdded += lineCount(input.new_string);
    stats.linesRemoved += lineCount(input.old_string);
    stats.edits++;
  } else if (name === 'MultiEdit' && Array.isArray(input.edits)) {
    for (const edit of input.edits) {
      stats.linesAdded += lineCount(edit?.new_string);
      stats.linesRemoved += lineCount(edit?.old_string);
    }
    stats.edits++;
  } else if (name === 'Bash' && typeof input.command === 'string') {
    if (/\bgit\s+commit\b/.test(input.command)) stats.commits++;
    if (/\bgh\s+pr\s+create\b/.test(input.command)) stats.pullRequests++;
  }
}

function keepTitle(entry: FileEntry, url: string | undefined, title: string | undefined): void {
  const clean = title?.trim();
  if (!url || !clean || clean.startsWith('http') || /artifact|artéfact|lien|link|^ici$/i.test(clean)) return;
  entry.artifactTitles[url] = clean;
}

async function parseFile(path: string, stat: { mtimeMs: number; size: number }): Promise<FileEntry> {
  const entry: FileEntry = { version: CACHE_VERSION, mtimeMs: stat.mtimeMs, size: stat.size, days: {}, hasCost: false, cwd: null, lastAt: 0, artifacts: [], artifactTitles: {}, scheduled: [] };
  const artifacts = new Set<string>();
  const messages = new Map<string, { day: string; model: string; usage: Record<string, any> }>();
  const seenTools = new Set<string>();
  const modelsInFile = new Set<string>();
  let firstDay: string | null = null;
  let lastCost: { day: string | null; modelUsage: Record<string, any> } | null = null;

  const lines = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.includes('claude.ai/') && line.includes('artifact/')) {
      for (const url of line.match(ARTIFACT_URL) ?? []) artifacts.add(url);
      for (const pattern of TITLE_PATTERNS) {
        for (const match of line.matchAll(pattern)) keepTitle(entry, match[2], match[1]);
      }
      for (const match of line.matchAll(URL_THEN_TITLE)) keepTitle(entry, match[1], match[2]);
    }
    if (!entry.cwd) entry.cwd = line.match(/"cwd":"((?:[^"\\\\]|\\\\.)*)"/)?.[1]?.replaceAll('\\\\', '\\') ?? null;
    const isAssistant = line.includes('"assistant"') && line.includes('"usage"');
    const isCost = line.includes('"cost-state"');
    if (!isAssistant && !isCost) continue;
    let event: Record<string, any>;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (event.type === 'cost-state' && event.modelUsage) {
      lastCost = { day: dayOf(event.startTime), modelUsage: event.modelUsage };
      continue;
    }
    if (event.type !== 'assistant') continue;
    const message = event.message;
    const model = message?.model;
    const day = dayOf(event.timestamp);
    if (typeof model !== 'string' || model.startsWith('<') || !day) continue;
    const at = new Date(event.timestamp).getTime();
    if (at > entry.lastAt) entry.lastAt = at;
    firstDay ??= day;
    modelsInFile.add(model);
    const id = typeof message.id === 'string' ? message.id : `${event.requestId}:${event.uuid}`;
    if (message.usage) messages.set(id, { day, model, usage: message.usage });
    for (const block of Array.isArray(message.content) ? message.content : []) {
      if (block?.type !== 'tool_use' || typeof block.name !== 'string') continue;
      if (block.id && seenTools.has(block.id)) continue;
      if (block.id) seenTools.add(block.id);
      const input = (block.input ?? {}) as Record<string, any>;
      countTool(bucket(entry.days, day, model), block.name, input);
      if (SCHEDULING_TOOLS.has(block.name)) {
        const label = String(input.reason ?? input.description ?? input.prompt ?? input.name ?? block.name).replace(/\s+/g, ' ').slice(0, 120);
        entry.scheduled.push({ label, at, tool: block.name });
      }
    }
  }

  for (const { day, model, usage } of messages.values()) {
    const stats = bucket(entry.days, day, model);
    stats.messages++;
    stats.input += Number(usage.input_tokens) || 0;
    stats.output += Number(usage.output_tokens) || 0;
    stats.cacheRead += Number(usage.cache_read_input_tokens) || 0;
    stats.cacheWrite += Number(usage.cache_creation_input_tokens) || 0;
  }
  if (firstDay) for (const model of modelsInFile) bucket(entry.days, firstDay, model).sessions++;
  if (lastCost) {
    entry.hasCost = true;
    for (const [model, usage] of Object.entries(lastCost.modelUsage)) {
      const cost = Number((usage as Record<string, unknown>).costUSD) || 0;
      if (cost > 0) bucket(entry.days, lastCost.day ?? firstDay ?? 'inconnu', model).cost += cost;
    }
  }
  entry.artifacts = [...artifacts];
  return entry;
}

async function listFiles(): Promise<string[]> {
  const entries = await fs.readdir(ROOT, { recursive: true, withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isFile() && e.name.endsWith('.jsonl')).map((e) => join(e.parentPath, e.name));
}

async function loadCache(): Promise<Cache> {
  try {
    return JSON.parse(await fs.readFile(cachePath, 'utf8')) as Cache;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const previous = await loadCache();
  const next: Cache = {};
  let changed = false;
  for (const path of await listFiles()) {
    try {
      const stat = await fs.stat(path);
      const cached = previous[path];
      if (cached && cached.version === CACHE_VERSION && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        next[path] = cached;
      } else {
        next[path] = await parseFile(path, stat);
        changed = true;
      }
    } catch {
    }
  }
  if (changed || Object.keys(previous).length !== Object.keys(next).length) {
    await fs.writeFile(cachePath, JSON.stringify(next));
  }

  const merged = new Map<string, UsageDay>();
  let costSessions = 0;
  let sessions = 0;
  const folders = new Map<string, UsageByFolder>();
  const pastSchedules: PastSchedule[] = [];
  const artifactTitles: Record<string, string> = {};
  for (const entry of Object.values(next)) {
    Object.assign(artifactTitles, entry.artifactTitles);
    if (entry.cwd) {
      const folder = folders.get(entry.cwd) ?? { cwd: entry.cwd, tokens: 0, lines: 0, sessions: 0, lastAt: 0, artifacts: [] };
      folder.sessions++;
      folder.lastAt = Math.max(folder.lastAt, entry.lastAt);
      folder.artifacts = [...new Set([...folder.artifacts, ...entry.artifacts])];
      for (const byModel of Object.values(entry.days)) {
        for (const stats of Object.values(byModel)) {
          folder.tokens += stats.input + stats.output + stats.cacheWrite;
          folder.lines += stats.linesAdded;
        }
      }
      folders.set(entry.cwd, folder);
      for (const item of entry.scheduled) pastSchedules.push({ cwd: entry.cwd, ...item });
    }
    if (entry.hasCost) costSessions++;
    if (Object.keys(entry.days).length > 0) sessions++;
    for (const [date, byModel] of Object.entries(entry.days)) {
      for (const [model, stats] of Object.entries(byModel)) {
        const key = `${date}|${model}`;
        const row = merged.get(key) ?? { date, model, stats: emptyStats() };
        for (const field of Object.keys(stats) as (keyof ModelStats)[]) row.stats[field] += stats[field];
        merged.set(key, row);
      }
    }
  }
  pastSchedules.sort((a, b) => b.at - a.at);
  parentPort?.postMessage({
    days: [...merged.values()],
    files: Object.keys(next).length,
    sessions,
    costSessions,
    scannedAt: Date.now(),
    folders: [...folders.values()],
    pastSchedules: pastSchedules.slice(0, 100),
    artifactTitles,
  });
}

void main().catch((error) => {
  parentPort?.postMessage({ error: String(error) });
});
