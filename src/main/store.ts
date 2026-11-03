import Store from 'electron-store';
import {
  DEFAULT_SETTINGS,
  type AgentTask,
  type ArtifactEntry,
  type CustomIde,
  type IdeEntry,
  type Note,
  type Project,
  type Settings,
} from '@shared/types';

export interface PersistedState {
  rootPath: string | null;
  projects: Project[];
  settings: Settings;
  ignoredPaths: string[];
  notes: Record<string, Note[]>;
  customIdes: CustomIde[];
  ideCache: IdeEntry[] | null;
  artifacts: ArtifactEntry[];
  artifactsAt: number | null;
  colorScheme: number;
}

export const store = new Store<PersistedState>({
  name: 'house',
  defaults: {
    rootPath: null,
    projects: [],
    settings: DEFAULT_SETTINGS,
    ignoredPaths: [],
    notes: {},
    customIdes: [],
    ideCache: null,
    artifacts: [],
    artifactsAt: null,
    colorScheme: 1,
  },
});

export const historyStore = new Store<{ tasks: AgentTask[] }>({
  name: 'history',
  defaults: { tasks: [] },
});

export function getSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...store.get('settings') };
}
