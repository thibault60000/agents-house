import type { AgentTask, AppState, LimitWindow, UsageLimits, ArtifactEntry, ClaudeStatus, DesktopConversation, DetectedProject, IdeEntry, LogisticsData, Note, Project, UsageReport } from '@shared/types';
import type { AgentBadge } from '../scene/agents/bubble';
import type { World } from '../scene/world';
import { chime } from './sound';

export type PanelKind = 'history' | 'chat' | 'docs' | 'chest' | 'board' | 'settings' | 'rooms' | 'logistics' | 'schedules' | 'artifacts' | 'skills' | 'commands' | 'usage';

export interface PanelState {
  kind: PanelKind;
  projectId: string | null;
  taskId?: string | null;
  sessionId?: string | null;
}

export interface ArtifactView {
  url: string;
  title: string;
  named: boolean;
  updated: string;
  projectIds: string[];
}

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

export const LIMIT_ALARM = 90;

class Ui {
  app = $state<AppState | null>(null);
  tasks = $state<AgentTask[]>([]);
  panel = $state<PanelState | null>(null);
  floors = $state(1);
  activeFloor = $state(0);
  ides = $state<IdeEntry[]>([]);
  claude = $state<ClaudeStatus | null>(null);
  paletteOpen = $state(false);
  detected = $state<DetectedProject[]>([]);
  toasts = $state<Toast[]>([]);
  isNight = $state(false);
  noteCounts = $state<Record<string, number>>({});
  usage = $state.raw<UsageReport | null>(null);
  conversations = $state.raw<DesktopConversation[]>([]);
  limits = $state.raw<UsageLimits>({ fiveHour: null, sevenDay: null, updatedAt: 0 });
  clock = $state(Date.now());

  limitUsed(window: LimitWindow | null): number | null {
    if (!window) return null;
    return window.resetsAt > this.clock ? window.used : 0;
  }

  get alarmLevel(): 0 | 1 | 2 {
    if (!this.app?.settings.limitAlarms) return 0;
    if ((this.limitUsed(this.limits.sevenDay) ?? 0) >= LIMIT_ALARM) return 2;
    if ((this.limitUsed(this.limits.fiveHour) ?? 0) >= LIMIT_ALARM) return 1;
    return 0;
  }
  logistics = $state.raw<LogisticsData | null>(null);
  artifacts = $state.raw<ArtifactEntry[]>([]);
  artifactsAt = $state<number | null>(null);
  world: World | null = null;

  private toastId = 0;

  get projects(): Project[] {
    return this.app?.projects ?? [];
  }

  project(id: string | null | undefined): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  projectTasks(projectId: string): AgentTask[] {
    return this.tasks.filter((t) => t.projectId === projectId);
  }

  get quests(): AgentTask[] {
    return this.tasks
      .filter((t) => t.status === 'running' || t.status === 'queued' || (!t.acknowledged && (t.status === 'done' || t.status === 'error' || t.status === 'waiting')))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  featuredTask(projectId: string): AgentTask | null {
    const own = this.projectTasks(projectId).sort((a, b) => b.updatedAt - a.updatedAt);
    return (
      own.find((t) => t.status === 'running') ??
      own.find((t) => t.status === 'queued') ??
      own.find((t) => !t.acknowledged && (t.status === 'done' || t.status === 'error' || t.status === 'waiting')) ??
      null
    );
  }

  projectForPath(path: string): Project | undefined {
    let best: Project | undefined;
    for (const project of this.projects) {
      const inside = path === project.path || path.startsWith(`${project.path}/`) || path.startsWith(`${project.path}\\`);
      if (inside && (!best || project.path.length > best.path.length)) best = project;
    }
    return best;
  }

  async refreshLogistics(): Promise<void> {
    await Promise.all([
      this.call(() => window.house.getLogistics()).then((logistics) => {
        if (logistics) this.logistics = logistics;
        this.syncScreens();
      }),
      this.call(() => window.house.listArtifacts()).then((artifacts) => {
        if (!artifacts) return;
        this.artifacts = artifacts.items;
        this.artifactsAt = artifacts.updatedAt;
        this.syncScreens();
      }),
      this.call(() => window.house.getUsage()).then((usage) => {
        if (usage) this.usage = usage;
        this.syncScreens();
      }),
    ]);
  }

  async refreshArtifacts(quiet = false): Promise<void> {
    const list = quiet ? await window.house.refreshArtifacts().catch(() => null) : await this.call(() => window.house.refreshArtifacts());
    if (!list) return;
    this.artifacts = list;
    this.artifactsAt = Date.now();
    this.syncScreens();
  }

  get artifactIndex(): ArtifactView[] {
    const titles = this.usage?.artifactTitles ?? {};
    const known = new Map<string, ArtifactView>(
      this.artifacts.map((item) => [item.url, { url: item.url, title: item.title, named: item.title !== item.url, updated: item.updated, projectIds: [] }]),
    );
    const touch = (url: string): ArtifactView => {
      const existing = known.get(url);
      if (existing) return existing;
      const title = titles[url];
      const created: ArtifactView = { url, title: title ?? 'Artéfact sans titre connu', named: Boolean(title), updated: '', projectIds: [] };
      known.set(url, created);
      return created;
    };
    for (const folder of this.usage?.folders ?? []) {
      const project = this.projectForPath(folder.cwd);
      if (!project) continue;
      for (const url of folder.artifacts) {
        const entry = touch(url);
        if (!entry.projectIds.includes(project.id)) entry.projectIds.push(project.id);
      }
    }
    return [...known.values()].sort((a, b) => b.updated.localeCompare(a.updated) || Number(b.named) - Number(a.named));
  }

  syncScreens(): void {
    const world = this.world;
    const data = this.logistics;
    if (!world || !data) return;
    const planned = data.schedules.filter((item) => item.source !== 'Système');
    const artifacts = this.artifactIndex;
    const configured = this.projects.filter((project) => this.projectTotal(project.id) > 0).length;
    const total = data.skills.length + data.commands.length + data.agents.length + data.rules.length + data.mcp.length;
    world.setScreen('logistics', {
      title: 'Logistique',
      count: String(total),
      caption: `outils · ${configured}/${this.projects.length} projets équipés`,
      lines: [
        `${data.skills.length} skills · ${data.commands.length} commandes`,
        `${data.agents.length} agents · ${data.rules.length} règles · ${data.mcp.length} MCP`,
        `${artifacts.length} artéfacts · ${planned.length} tâches`,
        ...[...this.projects].sort((a, b) => this.projectTotal(b.id) - this.projectTotal(a.id)).slice(0, 1).map((project) => `${project.name} : ${this.projectTotal(project.id)} outils`),
      ],
    });
    if (this.usage) {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      const key = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}-${String(since.getDate()).padStart(2, '0')}`;
      const perModel = new Map<string, number>();
      for (const row of this.usage.days) {
        if (row.date >= key) perModel.set(row.model, (perModel.get(row.model) ?? 0) + row.stats.input + row.stats.output + row.stats.cacheWrite);
      }
      const compact = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
      const lines = [...perModel.entries()].sort((a, b) => b[1] - a[1]);
      world.setScreen('usage', {
        title: 'Garage',
        count: compact.format(lines.reduce((sum, [, tokens]) => sum + tokens, 0)),
        caption: 'tokens sur 7 jours',
        lines: lines.map(([model, tokens]) => `${model.replace(/^claude-/, '')} : ${compact.format(tokens)}`),
      });
    }
  }

  projectTotal(projectId: string): number {
    const data = this.logistics;
    if (!data) return 0;
    const own = (list: { projectId: string | null }[]) => list.filter((item) => item.projectId === projectId).length;
    return own(data.skills) + own(data.commands) + own(data.agents) + own(data.rules) + own(data.mcp);
  }

  setConversations(list: DesktopConversation[]): void {
    this.conversations = list;
    this.syncBadges();
  }

  syncBadges(): void {
    const badges = new Map<string, AgentBadge>();
    const grouped = new Map<string, DesktopConversation[]>();
    for (const conversation of this.conversations) {
      if (!conversation.projectId) continue;
      const list = grouped.get(conversation.projectId) ?? [];
      list.push(conversation);
      grouped.set(conversation.projectId, list);
    }
    for (const [projectId, list] of grouped) {
      const running = list.filter((c) => c.state === 'running').length;
      const unread = list.filter((c) => c.state === 'unread').length;
      const attention = running + unread;
      const parts = [`${list.length} conversation${list.length > 1 ? 's' : ''} ouverte${list.length > 1 ? 's' : ''}`];
      if (running > 0) parts.push(`${running} en cours`);
      if (unread > 0) parts.push(`${unread} non lue${unread > 1 ? 's' : ''}`);
      badges.set(projectId, { count: attention > 0 ? attention : list.length, alert: attention > 0, title: parts.join(', ') });
    }
    this.world?.applyBadges(badges);
    this.world?.setExternalWork(new Set(this.conversations.filter((c) => c.projectId && c.state === 'running').map((c) => c.projectId as string)));
  }

  toast(text: string, tone: Toast['tone'] = 'info'): void {
    const id = ++this.toastId;
    this.toasts = [...this.toasts, { id, text, tone }];
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 5200);
  }

  async call<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);
      this.toast(message, 'error');
      return undefined;
    }
  }

  setTask(task: AgentTask): void {
    const index = this.tasks.findIndex((t) => t.id === task.id);
    if (index >= 0) this.tasks[index] = task;
    else this.tasks = [...this.tasks, task];
    this.syncAgent(task.projectId);
  }

  syncAgent(projectId: string): void {
    this.world?.applyTask(projectId, $state.snapshot(this.featuredTask(projectId)) as AgentTask | null);
  }

  syncAllAgents(): void {
    for (const project of this.projects) this.syncAgent(project.id);
  }

  onTaskFinished(task: AgentTask): void {
    if (!this.app?.settings.sounds || task.status === 'cancelled') return;
    chime(task.status === 'error' ? 'error' : 'done');
  }

  openPanel(panel: PanelState): void {
    this.panel = panel;
    if (panel.kind === 'chat' && panel.projectId) {
      const taskId = panel.taskId ?? this.latestTaskId(panel.projectId);
      if (taskId) this.acknowledge(taskId);
    }
  }

  latestTaskId(projectId: string): string | null {
    const own = this.projectTasks(projectId).sort((a, b) => b.updatedAt - a.updatedAt);
    return own[0]?.id ?? null;
  }

  acknowledge(taskId: string): void {
    const task = this.tasks.find((t) => t.id === taskId);
    if (!task || task.acknowledged || task.status === 'running' || task.status === 'queued') return;
    void this.call(() => window.house.acknowledgeTask(taskId));
  }

  async refreshNoteCounts(): Promise<void> {
    const counts: Record<string, number> = {};
    await Promise.all(
      this.projects.map(async (project) => {
        const notes = (await window.house.listNotes(project.id)) as Note[];
        counts[project.id] = notes.filter((n) => !n.done).length;
      }),
    );
    this.noteCounts = counts;
  }
}

export const ui = new Ui();
