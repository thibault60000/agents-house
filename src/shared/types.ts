export type ProjectKind = 'node' | 'rust' | 'python' | 'go' | 'java' | 'dotnet' | 'ruby' | 'php' | 'cpp' | 'other';

export type ProjectCategory = 'game' | 'data' | 'web' | 'infra' | 'docs' | 'generic';

export const PROJECT_ROOM_TYPES = [
  'bureau',
  'salon',
  'cuisine',
  'salle-a-manger',
  'chambre',
  'atelier',
  'bibliotheque',
  'cellier',
  'veranda',
  'grenier',
  'salle-de-jeux',
] as const;

export const SERVICE_ROOM_TYPES = [
  'couloir',
  'entree',
  'salle-de-bain',
  'wc',
  'buanderie',
  'garage',
  'logistique',
] as const;

export type ProjectRoomType = (typeof PROJECT_ROOM_TYPES)[number];
export type ServiceRoomType = (typeof SERVICE_ROOM_TYPES)[number];
export type RoomType = ProjectRoomType | ServiceRoomType;

export const ROOM_LABELS: Record<RoomType, string> = {
  bureau: 'Bureau',
  salon: 'Salon',
  cuisine: 'Cuisine',
  'salle-a-manger': 'Salle à manger',
  chambre: 'Chambre',
  atelier: 'Atelier',
  bibliotheque: 'Bibliothèque',
  cellier: 'Cellier',
  garage: 'Garage',
  veranda: 'Véranda',
  grenier: 'Grenier',
  'salle-de-jeux': 'Salle de jeux',
  couloir: 'Couloir',
  entree: 'Entrée',
  'salle-de-bain': 'Salle de bain',
  wc: 'WC',
  buanderie: 'Buanderie',
  logistique: 'Logistique',
};

export interface Project {
  id: string;
  path: string;
  name: string;
  color: string;
  enabled: boolean;
  roomType?: ProjectRoomType;
  seed: number;
  kind: ProjectKind;
  category: ProjectCategory;
  hasGit: boolean;
  docCount: number;
  colorCustom?: boolean;
  ideId?: string;
  external?: boolean;
}

export type GraphicsQuality = 'low' | 'medium' | 'high';
export type DayCycleMode = 'real' | 'day' | 'night' | 'fast';
export type ThemeMode = 'auto' | 'light' | 'dark';
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];
export type PermissionMode = 'acceptEdits' | 'auto' | 'plan' | 'dontAsk' | 'manual' | 'bypassPermissions';

export interface Settings {
  defaultIdeId: string | null;
  quality: GraphicsQuality;
  grass: boolean;
  shadows: boolean;
  postProcess: boolean;
  liquidRefraction: boolean;
  dayCycle: DayCycleMode;
  theme: ThemeMode;
  sounds: boolean;
  permissionMode: PermissionMode;
  model: string;
  effort: EffortLevel | '';
  limitAlarms: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  defaultIdeId: null,
  quality: 'medium',
  grass: false,
  shadows: true,
  postProcess: true,
  liquidRefraction: true,
  dayCycle: 'real',
  theme: 'auto',
  sounds: false,
  permissionMode: 'acceptEdits',
  model: '',
  effort: '',
  limitAlarms: true,
};

export interface DetectedProject {
  path: string;
  name: string;
}

export interface DocFile {
  relPath: string;
  size: number;
}

export interface GitInfo {
  isRepo: boolean;
  branch: string | null;
  lastCommit: { hash: string; subject: string; author: string; date: string } | null;
  changedFiles: { status: string; path: string }[];
}

export interface IdeEntry {
  id: string;
  name: string;
  available: boolean;
  via: 'cli' | 'app' | 'url' | null;
  custom?: boolean;
  command: string;
}

export interface CustomIde {
  id: string;
  name: string;
  command: string;
}

export interface Note {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export type TaskStatus = 'queued' | 'running' | 'waiting' | 'done' | 'error' | 'cancelled';

export interface TaskMessage {
  role: 'user' | 'assistant';
  text: string;
  at: number;
}

export interface AgentTask {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  messages: TaskMessage[];
  progress: string;
  files: string[];
  sessionId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
  acknowledged: boolean;
  demo: boolean;
  pendingPrompt?: string;
  model?: string;
  effort?: EffortLevel | '';
}

export interface TaskEvent {
  channel: 'task:start' | 'task:progress' | 'task:delta' | 'task:done' | 'task:error';
  task: AgentTask;
  delta?: string;
}

export interface ScheduledItem {
  id: string;
  name: string;
  source: string;
  schedule: string;
  next: number | null;
  last: number | null;
  enabled: boolean;
  projectId: string | null;
}

export interface ArtifactEntry {
  title: string;
  url: string;
  updated: string;
}

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  source: string;
  enabled: boolean;
  projectId: string | null;
}

export interface LogisticsData {
  schedules: ScheduledItem[];
  skills: CatalogEntry[];
  commands: CatalogEntry[];
  agents: CatalogEntry[];
  rules: CatalogEntry[];
  mcp: CatalogEntry[];
  claudeMd: string[];
}

export interface UsageByFolder {
  cwd: string;
  tokens: number;
  lines: number;
  sessions: number;
  lastAt: number;
  artifacts: string[];
}

export interface PastSchedule {
  cwd: string;
  label: string;
  at: number;
  tool: string;
}

export interface ModelStats {
  sessions: number;
  messages: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  tools: number;
  edits: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
  pullRequests: number;
}

export function emptyStats(): ModelStats {
  return { sessions: 0, messages: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, tools: 0, edits: 0, linesAdded: 0, linesRemoved: 0, commits: 0, pullRequests: 0 };
}

export interface UsageDay {
  date: string;
  model: string;
  stats: ModelStats;
}

export interface UsageReport {
  days: UsageDay[];
  files: number;
  sessions: number;
  costSessions: number;
  scannedAt: number;
  folders: UsageByFolder[];
  pastSchedules: PastSchedule[];
  artifactTitles: Record<string, string>;
}

export interface CatalogFile {
  path: string;
  content: string;
  files: string[];
}

export interface LimitWindow {
  used: number;
  resetsAt: number;
}

export interface UsageLimits {
  fiveHour: LimitWindow | null;
  sevenDay: LimitWindow | null;
  updatedAt: number;
}

export type HistorySource = 'desktop' | 'vscode' | 'terminal' | 'other';

export interface HistorySession {
  id: string;
  title: string;
  cwd: string;
  projectId: string | null;
  source: HistorySource;
  archived: boolean;
  lastActivity: number;
  live: boolean;
}

export interface HistoryMessage {
  role: 'user' | 'assistant' | 'tools';
  text: string;
  at: number;
}

export interface HistoryTranscript {
  session: HistorySession;
  messages: HistoryMessage[];
  truncated: boolean;
}

export interface DesktopConversation {
  id: string;
  sessionId: string | null;
  title: string;
  cwd: string;
  projectId: string | null;
  state: 'running' | 'unread' | 'open';
  lastActivity: number;
}

export interface ClaudeStatus {
  available: boolean;
  version: string | null;
  path: string | null;
}

export interface AppState {
  rootPath: string | null;
  projects: Project[];
  settings: Settings;
  platform: string;
}

export interface HouseApi {
  getState(): Promise<AppState>;

  chooseRoot(): Promise<AppState | null>;
  rescan(): Promise<AppState>;
  addExternalProject(): Promise<AppState | null>;
  updateProject(id: string, patch: ProjectPatch): Promise<AppState>;
  removeProject(id: string): Promise<AppState>;
  acceptDetected(path: string): Promise<AppState>;
  ignoreDetected(path: string): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<AppState>;

  listDocs(projectId: string): Promise<DocFile[]>;
  readDoc(projectId: string, relPath: string): Promise<string>;
  gitInfo(projectId: string): Promise<GitInfo>;
  gitDiff(projectId: string, relPath?: string): Promise<string>;

  listIdes(force?: boolean): Promise<IdeEntry[]>;
  openInIde(projectId: string, ideId?: string, relPath?: string): Promise<void>;
  addCustomIde(name: string, command: string): Promise<IdeEntry[]>;
  removeCustomIde(id: string): Promise<IdeEntry[]>;
  openInExplorer(projectId: string): Promise<void>;
  openTerminal(projectId: string): Promise<void>;
  copyText(text: string): Promise<void>;

  listNotes(projectId: string): Promise<Note[]>;
  saveNotes(projectId: string, notes: Note[]): Promise<void>;

  claudeStatus(force?: boolean): Promise<ClaudeStatus>;
  listTasks(projectId?: string): Promise<AgentTask[]>;
  sendPrompt(projectId: string, prompt: string, continueTaskId?: string): Promise<AgentTask>;
  cancelTask(taskId: string): Promise<void>;
  acknowledgeTask(taskId: string): Promise<void>;
  clearHistory(projectId: string): Promise<void>;

  getLogistics(): Promise<LogisticsData>;
  readCatalogFile(id: string): Promise<CatalogFile>;
  getUsage(): Promise<UsageReport>;
  listArtifacts(): Promise<{ items: ArtifactEntry[]; updatedAt: number | null }>;
  refreshArtifacts(): Promise<ArtifactEntry[]>;
  openArtifact(url: string): Promise<void>;

  prepareVoice(): Promise<void>;
  onVoiceProgress(cb: (fraction: number) => void): () => void;
  getLimits(): Promise<UsageLimits>;
  onLimits(cb: (limits: UsageLimits) => void): () => void;
  listHistory(): Promise<HistorySession[]>;
  readHistory(id: string): Promise<HistoryTranscript>;
  resumeHistory(id: string): Promise<AgentTask>;
  listConversations(): Promise<DesktopConversation[]>;
  onConversations(cb: (list: DesktopConversation[]) => void): () => void;

  onTaskEvent(cb: (event: TaskEvent) => void): () => void;
  onProjectDetected(cb: (project: DetectedProject) => void): () => void;
  onStateChanged(cb: (state: AppState) => void): () => void;
  onOpenTask(cb: (task: { projectId: string; taskId: string }) => void): () => void;

  windowControl(action: 'minimize' | 'maximize' | 'close'): Promise<void>;
}

export type ProjectPatch = Partial<Pick<Project, 'name' | 'color' | 'enabled' | 'ideId'>> & {
  roomType?: ProjectRoomType | null;
  ideId?: string | undefined;
};

export const PROJECT_COLORS = [
  '#e5383b',
  '#2ed3f0',
  '#fcd116',
  '#7b3ff2',
  '#2fb344',
  '#ff7eb6',
  '#27348b',
  '#f77f00',
  '#9ff5cf',
  '#8a4f2a',
  '#c9b3ff',
  '#0f9d8f',
  '#d61fc7',
  '#a7e22e',
  '#2f6fed',
  '#eef0f2',
  '#3b4252',
  '#fdba8c',
] as const;
