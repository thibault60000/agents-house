import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { isAbsolute, relative, sep } from 'node:path';
import { EFFORT_LEVELS, type AgentTask, type ClaudeStatus, type Project, type TaskEvent, type TaskMessage } from '@shared/types';
import { which } from './env';
import { noteRateLimit } from './limits';
import { getSettings, historyStore } from './store';

const MAX_TASKS_PER_PROJECT = 40;
const MAX_STDERR = 4000;

type Emit = (event: TaskEvent) => void;

interface RunningTask {
  taskId: string;
  cancel(): void;
}

let tasks: AgentTask[] = [];
let emit: Emit = () => {};
let resolveProject: (id: string) => Project | undefined = () => undefined;
let saveTimer: NodeJS.Timeout | null = null;
let claude: ClaudeStatus | null = null;

const running = new Map<string, RunningTask>();

export function initAgents(options: { emit: Emit; resolveProject: (id: string) => Project | undefined }): void {
  emit = options.emit;
  resolveProject = options.resolveProject;
  const now = Date.now();
  tasks = historyStore.get('tasks').map((task) =>
    task.status === 'running' || task.status === 'queued'
      ? { ...task, status: 'error', error: "Interrompue par la fermeture de l'application.", progress: 'Interrompue', acknowledged: false, updatedAt: now }
      : task,
  );
  scheduleSave();
}

function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    historyStore.set('tasks', tasks);
  }, 500);
}

export function flushHistory(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  historyStore.set('tasks', tasks);
}

export function shutdownAgents(): void {
  for (const run of running.values()) run.cancel();
  flushHistory();
}

function publish(channel: TaskEvent['channel'], task: AgentTask, delta?: string): void {
  task.updatedAt = Date.now();
  scheduleSave();
  emit(delta === undefined ? { channel, task: structuredClone(task) } : { channel, task: structuredClone(task), delta });
}

export function listTasks(projectId?: string): AgentTask[] {
  const list = projectId ? tasks.filter((t) => t.projectId === projectId) : tasks;
  return structuredClone(list);
}

export async function claudeStatus(force = false): Promise<ClaudeStatus> {
  if (claude && !force) return claude;
  const path = await which('claude');
  if (!path) {
    claude = { available: false, version: null, path: null };
    return claude;
  }
  const version = await new Promise<string | null>((resolve) => {
    execFile(path, ['--version'], { timeout: 8000, shell: process.platform === 'win32' }, (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
  claude = { available: version !== null, version, path };
  return claude;
}

export async function sendPrompt(projectId: string, prompt: string, continueTaskId?: string): Promise<AgentTask> {
  const clean = prompt.trim();
  if (!clean) throw new Error('Le message est vide.');
  if (!resolveProject(projectId)) throw new Error('Projet inconnu.');

  const now = Date.now();
  let task = continueTaskId ? tasks.find((t) => t.id === continueTaskId && t.projectId === projectId) : undefined;
  if (task) {
    if (task.status === 'running' || task.status === 'queued') throw new Error('Cette tâche est déjà en cours.');
    task.messages.push({ role: 'user', text: clean, at: now });
    task.status = 'queued';
    task.error = null;
    task.acknowledged = false;
    task.pendingPrompt = clean;
    task.model = getSettings().model;
    task.effort = getSettings().effort;
  } else {
    task = {
      id: randomUUID(),
      projectId,
      title: clean.length > 80 ? `${clean.slice(0, 77)}…` : clean,
      status: 'queued',
      messages: [{ role: 'user', text: clean, at: now }],
      progress: 'En attente…',
      files: [],
      sessionId: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      acknowledged: false,
      demo: false,
      pendingPrompt: clean,
      model: getSettings().model,
      effort: getSettings().effort,
    };
    tasks.push(task);
    trimHistory(projectId);
  }
  task.progress = 'En attente…';
  publish('task:progress', task);
  void pump(projectId);
  return structuredClone(task);
}

export function adoptSession(projectId: string, sessionId: string, title: string, messages: TaskMessage[]): AgentTask {
  const known = tasks.find((t) => t.projectId === projectId && t.sessionId === sessionId);
  if (known) return structuredClone(known);
  const now = Date.now();
  const task: AgentTask = {
    id: randomUUID(),
    projectId,
    title: title.length > 80 ? `${title.slice(0, 77)}…` : title,
    status: 'done',
    messages,
    progress: 'Discussion reprise',
    files: [],
    sessionId,
    error: null,
    createdAt: now,
    updatedAt: now,
    acknowledged: true,
    demo: false,
  };
  tasks.push(task);
  trimHistory(projectId);
  publish('task:progress', task);
  return structuredClone(task);
}

function trimHistory(projectId: string): void {
  const own = tasks.filter((t) => t.projectId === projectId);
  const excess = own.length - MAX_TASKS_PER_PROJECT;
  if (excess <= 0) return;
  const removable = own.filter((t) => t.status !== 'running' && t.status !== 'queued').slice(0, excess);
  const ids = new Set(removable.map((t) => t.id));
  tasks = tasks.filter((t) => !ids.has(t.id));
}

async function pump(projectId: string): Promise<void> {
  if (running.has(projectId)) return;
  const next = tasks.find((t) => t.projectId === projectId && t.status === 'queued');
  if (!next) return;
  running.set(projectId, { taskId: next.id, cancel: () => {} });

  const project = resolveProject(projectId);
  const status = await claudeStatus();
  if (next.status !== 'queued') return;
  if (!project) {
    running.delete(projectId);
    finish(next, 'error', 'Projet introuvable.');
    return;
  }
  next.status = 'running';
  next.progress = 'Démarre…';
  next.error = null;
  publish('task:start', next);
  if (status.available && status.path) startClaude(next, project, status.path);
  else startDemo(next);
}

function finish(task: AgentTask, status: 'done' | 'waiting' | 'error' | 'cancelled', detail?: string): void {
  delete task.pendingPrompt;
  task.status = status;
  if (status === 'error') {
    task.error = detail ?? 'Erreur inconnue.';
    task.progress = shortText(task.error);
    task.acknowledged = false;
    publish('task:error', task);
  } else if (status === 'cancelled') {
    task.progress = 'Annulée';
    task.acknowledged = true;
    publish('task:done', task);
  } else {
    task.progress = detail ?? 'Terminé';
    task.acknowledged = false;
    publish('task:done', task);
  }
  if (running.get(task.projectId)?.taskId === task.id) running.delete(task.projectId);
  void pump(task.projectId);
}

function shortText(text: string, max = 60): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

function fileLabel(path: unknown): string {
  if (typeof path !== 'string') return '';
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

export function describeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Read':
      return `Lit ${fileLabel(input.file_path) || 'des fichiers'}…`;
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Modifie ${fileLabel(input.file_path ?? input.notebook_path) || 'un fichier'}…`;
    case 'Write':
      return `Écrit ${fileLabel(input.file_path) || 'un fichier'}…`;
    case 'Bash':
      return typeof input.description === 'string' ? shortText(input.description, 40) : 'Lance une commande…';
    case 'Grep':
    case 'Glob':
      return 'Cherche dans le code…';
    case 'WebFetch':
    case 'WebSearch':
      return 'Consulte le web…';
    case 'Task':
    case 'Agent':
      return 'Délègue à un sous-agent…';
    case 'TodoWrite':
      return 'Organise ses tâches…';
    case 'AskUserQuestion':
      return 'Te pose une question';
    default:
      return `Utilise ${name}…`;
  }
}

const EDIT_TOOLS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit']);

function rememberFile(task: AgentTask, project: Project, raw: unknown): void {
  if (typeof raw !== 'string' || !raw) return;
  let path = raw;
  if (isAbsolute(raw)) {
    const rel = relative(project.path, raw);
    if (!rel.startsWith('..')) path = rel.split(sep).join('/');
  }
  if (!task.files.includes(path)) task.files.push(path);
}

function summary(task: AgentTask): string {
  const count = task.files.length;
  if (count === 0) return 'Terminé';
  return `Terminé : ${count} fichier${count > 1 ? 's' : ''} modifié${count > 1 ? 's' : ''}`;
}

function appendAssistant(task: AgentTask, text: string, freshBlock: boolean): void {
  const last = task.messages[task.messages.length - 1];
  if (last?.role === 'assistant') {
    last.text += freshBlock && last.text ? `\n\n${text}` : text;
  } else {
    task.messages.push({ role: 'assistant', text, at: Date.now() });
  }
}

interface StreamState {
  streamed: boolean;
  freshBlock: boolean;
  asked: boolean;
  gotResult: boolean;
}

function handleStreamLine(task: AgentTask, project: Project, line: string, state: StreamState): void {
  let event: Record<string, any>;
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }
  if (typeof event.session_id === 'string') task.sessionId = event.session_id;
  if (event.type === 'rate_limit_event') noteRateLimit(event.rate_limit_info);

  if (event.type === 'stream_event') {
    const inner = event.event;
    if (inner?.type === 'message_start') {
      state.streamed = false;
    } else if (inner?.type === 'content_block_start' && inner.content_block?.type === 'text') {
      state.freshBlock = true;
    } else if (inner?.type === 'content_block_delta' && inner.delta?.type === 'text_delta') {
      const text: string = inner.delta.text ?? '';
      if (!text) return;
      appendAssistant(task, text, state.freshBlock);
      state.freshBlock = false;
      state.streamed = true;
      task.progress = 'Rédige sa réponse…';
      publish('task:delta', task, text);
    }
    return;
  }

  if (event.type === 'assistant') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'text' && !state.streamed && block.text) {
        appendAssistant(task, block.text, true);
        publish('task:delta', task, block.text);
      } else if (block.type === 'tool_use') {
        const input = (block.input ?? {}) as Record<string, unknown>;
        task.progress = describeTool(block.name, input);
        if (EDIT_TOOLS.has(block.name)) rememberFile(task, project, input.file_path ?? input.notebook_path);
        if (block.name === 'AskUserQuestion') state.asked = true;
        publish('task:progress', task);
      }
    }
    state.streamed = false;
    return;
  }

  if (event.type === 'result') {
    state.gotResult = true;
    if (event.is_error || (typeof event.subtype === 'string' && event.subtype.startsWith('error'))) {
      const detail = typeof event.result === 'string' && event.result ? event.result : `Échec (${event.subtype ?? 'erreur'})`;
      finish(task, 'error', detail);
      return;
    }
    const last = task.messages[task.messages.length - 1];
    if (typeof event.result === 'string' && event.result && last?.role !== 'assistant') {
      appendAssistant(task, event.result, true);
    }
    const finalText = task.messages[task.messages.length - 1];
    const denied = Array.isArray(event.permission_denials) ? event.permission_denials.length : 0;
    const asks = state.asked || (finalText?.role === 'assistant' && /\?\s*$/.test(finalText.text));
    if (asks) finish(task, 'waiting', 'Attend ta réponse');
    else if (denied > 0) finish(task, 'waiting', `${denied} action${denied > 1 ? 's' : ''} refusée${denied > 1 ? 's' : ''}`);
    else finish(task, 'done', summary(task));
  }
}

function startClaude(task: AgentTask, project: Project, claudePath: string): void {
  const settings = getSettings();
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', settings.permissionMode];
  const model = task.model ?? settings.model;
  const effort = task.effort ?? settings.effort;
  if (/^[\w.:\-[\]]+$/.test(model)) args.push('--model', model);
  if ((EFFORT_LEVELS as readonly string[]).includes(effort)) args.push('--effort', effort);
  if (task.sessionId) args.push('--resume', task.sessionId);

  const child: ChildProcess = spawn(claudePath, args, {
    cwd: project.path,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    env: process.env,
  });

  let cancelled = false;
  running.set(project.id, {
    taskId: task.id,
    cancel() {
      cancelled = true;
      killTree(child);
    },
  });

  child.stdin?.on('error', () => {});
  child.stdin?.end(task.pendingPrompt ?? '');

  const state: StreamState = { streamed: false, freshBlock: false, asked: false, gotResult: false };
  let buffer = '';
  let stderr = '';
  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    buffer += chunk;
    let index: number;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line && !state.gotResult) handleStreamLine(task, project, line, state);
    }
  });
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (chunk: string) => {
    stderr = (stderr + chunk).slice(-MAX_STDERR);
  });

  child.once('error', (error) => {
    if (!state.gotResult) {
      state.gotResult = true;
      finish(task, 'error', `Impossible de lancer Claude Code : ${error.message}`);
    }
  });
  child.once('close', (code) => {
    if (state.gotResult) return;
    state.gotResult = true;
    if (cancelled) finish(task, 'cancelled');
    else if (code === 0) finish(task, 'done', summary(task));
    else finish(task, 'error', stderr.trim().split('\n').pop() || `Claude Code s'est arrêté (code ${code}).`);
  });
}

function killTree(child: ChildProcess): void {
  if (process.platform === 'win32' && child.pid) {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    return;
  }
  child.kill('SIGTERM');
  setTimeout(() => {
    if (child.exitCode === null) child.kill('SIGKILL');
  }, 3000).unref();
}

const DEMO_STEPS = ['Lit les fichiers…', 'Cherche dans le code…', 'Réfléchit…', 'Modifie README.md…', 'Vérifie le résultat…'];

function startDemo(task: AgentTask): void {
  task.demo = true;
  let step = 0;
  let cancelled = false;
  let timer: NodeJS.Timeout;
  const tick = () => {
    if (cancelled) return;
    const label = DEMO_STEPS[step];
    if (label) {
      task.progress = label;
      publish('task:progress', task);
      step++;
      timer = setTimeout(tick, 1400);
      return;
    }
    const text = "**Mode démo.** Claude Code n'est pas installé : aucune action réelle n'a été faite.\n\nInstalle la CLI pour que je travaille vraiment dans ce dossier.";
    appendAssistant(task, text, true);
    publish('task:delta', task, text);
    finish(task, 'done', 'Terminé (démo)');
  };
  running.set(task.projectId, {
    taskId: task.id,
    cancel() {
      cancelled = true;
      clearTimeout(timer);
      finish(task, 'cancelled');
    },
  });
  timer = setTimeout(tick, 600);
}

export function cancelTask(taskId: string): void {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (task.status === 'queued') {
    finish(task, 'cancelled');
    return;
  }
  const run = running.get(task.projectId);
  if (run?.taskId === taskId) run.cancel();
}

export function acknowledgeTask(taskId: string): void {
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.acknowledged) return;
  task.acknowledged = true;
  publish('task:progress', task);
}

export function clearHistory(projectId: string): void {
  tasks = tasks.filter((t) => t.projectId !== projectId || t.status === 'running' || t.status === 'queued');
  scheduleSave();
}
