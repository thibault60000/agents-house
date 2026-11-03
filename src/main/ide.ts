import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { shell } from 'electron';
import type { CustomIde, IdeEntry } from '@shared/types';
import { which } from './env';
import { store } from './store';

interface IdeDef {
  id: string;
  name: string;
  cli: string[];
  url?: string;
  macApps?: string[];
  paths?: { win32?: string[]; linux?: string[]; darwin?: string[] };
  inTerminal?: boolean;
}

const LOCALAPPDATA = process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local');
const TOOLBOX_LINUX = join(homedir(), '.local', 'share', 'JetBrains', 'Toolbox', 'scripts');
const TOOLBOX_MAC = join(homedir(), 'Library', 'Application Support', 'JetBrains', 'Toolbox', 'scripts');
const TOOLBOX_WIN = join(LOCALAPPDATA, 'JetBrains', 'Toolbox', 'scripts');

function jetbrains(script: string): IdeDef['paths'] {
  return {
    linux: [join(TOOLBOX_LINUX, script)],
    darwin: [join(TOOLBOX_MAC, script)],
    win32: [join(TOOLBOX_WIN, `${script}.cmd`)],
  };
}

const REGISTRY: IdeDef[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    cli: ['code'],
    url: 'vscode://file/{path}',
    macApps: ['Visual Studio Code'],
    paths: {
      win32: [join(LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')],
      linux: ['/usr/bin/code', '/snap/bin/code'],
    },
  },
  {
    id: 'cursor',
    name: 'Cursor',
    cli: ['cursor'],
    url: 'cursor://file/{path}',
    macApps: ['Cursor'],
    paths: { win32: [join(LOCALAPPDATA, 'Programs', 'cursor', 'resources', 'app', 'bin', 'cursor.cmd')] },
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    cli: ['windsurf'],
    macApps: ['Windsurf'],
    paths: { win32: [join(LOCALAPPDATA, 'Programs', 'Windsurf', 'bin', 'windsurf.cmd')] },
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cli: ['antigravity', 'antigravity-ide-snap.antigravity-ide'],
    macApps: ['Antigravity'],
    paths: {
      win32: [join(LOCALAPPDATA, 'Programs', 'Antigravity', 'bin', 'antigravity.cmd')],
      linux: [
        '/usr/bin/antigravity',
        '/usr/share/antigravity/bin/antigravity',
        '/snap/bin/antigravity-ide-snap.antigravity-ide',
        join(homedir(), '.local', 'bin', 'antigravity'),
      ],
    },
  },
  {
    id: 'zed',
    name: 'Zed',
    cli: ['zed', 'zeditor'],
    macApps: ['Zed'],
    paths: { linux: [join(homedir(), '.local', 'bin', 'zed')] },
  },
  { id: 'idea', name: 'IntelliJ IDEA', cli: ['idea', 'idea64'], macApps: ['IntelliJ IDEA', 'IntelliJ IDEA CE'], paths: jetbrains('idea') },
  { id: 'webstorm', name: 'WebStorm', cli: ['webstorm', 'webstorm64'], macApps: ['WebStorm'], paths: jetbrains('webstorm') },
  { id: 'pycharm', name: 'PyCharm', cli: ['pycharm', 'charm', 'pycharm64'], macApps: ['PyCharm', 'PyCharm CE'], paths: jetbrains('pycharm') },
  { id: 'rider', name: 'Rider', cli: ['rider', 'rider64'], macApps: ['Rider'], paths: jetbrains('rider') },
  { id: 'sublime', name: 'Sublime Text', cli: ['subl'], macApps: ['Sublime Text'], paths: { win32: ['C:\\Program Files\\Sublime Text\\subl.exe'] } },
  { id: 'fleet', name: 'Fleet', cli: ['fleet'], macApps: ['Fleet'], paths: jetbrains('fleet') },
  { id: 'nvim', name: 'Neovim', cli: ['nvim'], inTerminal: true },
  { id: 'android-studio', name: 'Android Studio', cli: ['studio', 'android-studio'], macApps: ['Android Studio'], paths: jetbrains('studio') },
  { id: 'xcode', name: 'Xcode', cli: [], macApps: ['Xcode'] },
];

interface Resolved {
  via: 'cli' | 'app' | 'url';
  target: string;
}

function macAppExists(app: string): boolean {
  return [`/Applications/${app}.app`, join(homedir(), 'Applications', `${app}.app`)].some(existsSync);
}

async function resolveIde(def: IdeDef): Promise<Resolved | null> {
  for (const cli of def.cli) {
    const found = await which(cli);
    if (found) return { via: 'cli', target: found };
  }
  const platform = process.platform as 'win32' | 'linux' | 'darwin';
  for (const path of def.paths?.[platform] ?? []) {
    if (existsSync(path)) return { via: 'cli', target: path };
  }
  if (platform === 'darwin') {
    for (const app of def.macApps ?? []) {
      if (macAppExists(app)) return { via: 'app', target: app };
    }
  }
  return null;
}

const resolvedCache = new Map<string, Resolved>();

export async function listIdes(force = false): Promise<IdeEntry[]> {
  const custom = store.get('customIdes');
  const cached = store.get('ideCache');
  if (!force && cached && resolvedCache.size > 0) return withCustom(cached, custom);

  resolvedCache.clear();
  const entries = await Promise.all(
    REGISTRY.map(async (def): Promise<IdeEntry> => {
      const resolved = await resolveIde(def);
      if (resolved) resolvedCache.set(def.id, resolved);
      return {
        id: def.id,
        name: def.name,
        available: resolved !== null,
        via: resolved?.via ?? null,
        command: def.cli[0] ? `${def.cli[0]} <path>` : `open -a ${def.macApps?.[0] ?? def.name}`,
      };
    }),
  );
  store.set('ideCache', entries);
  return withCustom(entries, custom);
}

function withCustom(entries: IdeEntry[], custom: CustomIde[]): IdeEntry[] {
  return [
    ...entries,
    ...custom.map((c): IdeEntry => ({ id: c.id, name: c.name, available: true, via: 'cli', custom: true, command: c.command })),
  ];
}

function launch(command: string, args: string[], cwd?: string): Promise<void> {
  const useShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const finalArgs = useShell ? args.map(quoteForCmd) : args;
  return new Promise((resolve, reject) => {
    const child = spawn(useShell ? `"${command}"` : command, finalArgs, {
      detached: true,
      stdio: 'ignore',
      shell: useShell,
      ...(cwd ? { cwd } : {}),
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function quoteForCmd(arg: string): string {
  if (/["%^&|<>\r\n]/.test(arg)) throw new Error(`Chemin non pris en charge par cmd.exe : ${arg}`);
  return `"${arg}"`;
}

export function parseCommand(template: string, path: string): { command: string; args: string[] } {
  const tokens = template.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  const parts = tokens.map((t) => t.replace(/^(["'])(.*)\1$/, '$2').replaceAll('{path}', path));
  const [command, ...args] = parts;
  if (!command) throw new Error('Commande vide.');
  if (!template.includes('{path}')) args.push(path);
  return { command, args };
}

export async function openInIde(ideId: string, path: string): Promise<void> {
  const custom = store.get('customIdes').find((c) => c.id === ideId);
  if (custom) {
    const { command, args } = parseCommand(custom.command, path);
    return launch(command, args);
  }

  const def = REGISTRY.find((d) => d.id === ideId);
  if (!def) throw new Error(`IDE inconnu : ${ideId}`);
  if (resolvedCache.size === 0) await listIdes(true);
  const resolved = resolvedCache.get(ideId);

  if (resolved && def.inTerminal) return openTerminal(path, [resolved.target, path]);
  if (resolved?.via === 'cli') return launch(resolved.target, [path]);
  if (resolved?.via === 'app') return launch('open', ['-a', resolved.target, path]);
  if (def.url) {
    await shell.openExternal(def.url.replace('{path}', encodeURI(path.replaceAll('\\', '/'))));
    return;
  }
  throw new Error(`${def.name} n'est pas installé.`);
}

export async function addCustomIde(name: string, command: string): Promise<IdeEntry[]> {
  const cleanName = name.trim();
  const cleanCommand = command.trim();
  if (!cleanName || !cleanCommand) throw new Error('Nom et commande requis.');
  const id = `custom-${Date.now().toString(36)}`;
  store.set('customIdes', [...store.get('customIdes'), { id, name: cleanName, command: cleanCommand }]);
  return listIdes();
}

export async function removeCustomIde(id: string): Promise<IdeEntry[]> {
  store.set('customIdes', store.get('customIdes').filter((c) => c.id !== id));
  return listIdes();
}

export async function openInExplorer(path: string): Promise<void> {
  const error = await shell.openPath(path);
  if (error) throw new Error(error);
}

interface LinuxTerminal {
  bin: string;
  args(cwd: string, exec?: string[]): string[];
}

const LINUX_TERMINALS: LinuxTerminal[] = [
  { bin: 'x-terminal-emulator', args: (_c, e) => (e ? ['-e', ...e] : []) },
  { bin: 'gnome-terminal', args: (c, e) => [`--working-directory=${c}`, ...(e ? ['--', ...e] : [])] },
  { bin: 'konsole', args: (c, e) => ['--workdir', c, ...(e ? ['-e', ...e] : [])] },
  { bin: 'xfce4-terminal', args: (c, e) => [`--working-directory=${c}`, ...(e ? ['-x', ...e] : [])] },
  { bin: 'kitty', args: (c, e) => ['--directory', c, ...(e ?? [])] },
  { bin: 'alacritty', args: (c, e) => ['--working-directory', c, ...(e ? ['-e', ...e] : [])] },
  { bin: 'wezterm', args: (c, e) => ['start', '--cwd', c, ...(e ? ['--', ...e] : [])] },
  { bin: 'tilix', args: (c, e) => ['--working-directory', c, ...(e ? ['-e', e.join(' ')] : [])] },
  { bin: 'foot', args: (c, e) => [`--working-directory=${c}`, ...(e ?? [])] },
  { bin: 'xterm', args: (_c, e) => (e ? ['-e', ...e] : []) },
];

export async function openTerminal(path: string, exec?: string[]): Promise<void> {
  if (process.platform === 'darwin') {
    if (!exec) return launch('open', ['-a', 'Terminal', path]);
    const command = `cd ${shellQuote(path)} && ${exec.map(shellQuote).join(' ')}`;
    return launch('osascript', ['-e', 'on run argv', '-e', 'tell application "Terminal" to do script (item 1 of argv)', '-e', 'end run', command]);
  }
  if (process.platform === 'win32') {
    if (await which('wt')) {
      const unsafe = [path, ...(exec ?? [])].find((arg) => arg.includes(';'));
      if (unsafe) throw new Error(`Chemin non pris en charge par Windows Terminal : ${unsafe}`);
      return launch('wt', ['-d', path, ...(exec ?? [])]);
    }
    exec?.forEach(quoteForCmd);
    return launch('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', ...(exec ?? [])], path);
  }
  for (const term of LINUX_TERMINALS) {
    const bin = await which(term.bin);
    if (bin) return launch(bin, term.args(path, exec), path);
  }
  throw new Error('Aucun terminal trouvé sur ce système.');
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
