import { execFile } from 'node:child_process';
import { promises as fs, type Dirent } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import chokidar, { type FSWatcher } from 'chokidar';
import { hashString } from '@shared/random';
import {
  PROJECT_COLORS,
  type DocFile,
  type GitInfo,
  type Project,
  type ProjectCategory,
  type ProjectKind,
} from '@shared/types';

const run = promisify(execFile);

const IGNORED_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'target', 'vendor', '__pycache__', 'venv', 'coverage', 'release']);

function isIgnoredDir(name: string): boolean {
  return name.startsWith('.') || IGNORED_DIRS.has(name);
}

export function projectIdFor(path: string): string {
  return hashString(resolve(path)).toString(16).padStart(8, '0');
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function readTextSafe(path: string, maxBytes = 256 * 1024): Promise<string> {
  try {
    const stat = await fs.stat(path);
    if (stat.size > maxBytes) return '';
    return await fs.readFile(path, 'utf8');
  } catch {
    return '';
  }
}

const KIND_MARKERS: [string, ProjectKind][] = [
  ['package.json', 'node'],
  ['Cargo.toml', 'rust'],
  ['pyproject.toml', 'python'],
  ['requirements.txt', 'python'],
  ['setup.py', 'python'],
  ['go.mod', 'go'],
  ['pom.xml', 'java'],
  ['build.gradle', 'java'],
  ['build.gradle.kts', 'java'],
  ['Gemfile', 'ruby'],
  ['composer.json', 'php'],
  ['CMakeLists.txt', 'cpp'],
];

async function detectKind(path: string, entries: string[]): Promise<ProjectKind> {
  for (const [marker, kind] of KIND_MARKERS) {
    if (entries.includes(marker)) return kind;
  }
  if (entries.some((e) => e.endsWith('.csproj') || e.endsWith('.sln'))) return 'dotnet';
  return (await exists(join(path, 'src', 'main.cpp'))) ? 'cpp' : 'other';
}

const GAME_HINTS = /\b(phaser|pixi(\.js)?|three|babylonjs|godot|bevy|pygame|unity|love2d|excalibur|kaboom|raylib)\b/i;
const DATA_HINTS = /\b(pandas|numpy|scikit-learn|torch|tensorflow|polars|dbt|jupyter|duckdb|airflow|matplotlib)\b/i;
const WEB_HINTS = /\b(react|svelte|vue|next|nuxt|astro|express|fastapi|django|rails|laravel|hono|vite)\b/i;

async function detectCategory(path: string, entries: string[], docCount: number): Promise<ProjectCategory> {
  if (entries.includes('project.godot') || entries.includes('ProjectSettings')) return 'game';
  if (entries.some((e) => e.endsWith('.ipynb'))) return 'data';
  if (entries.includes('Dockerfile') && !entries.includes('package.json')) return 'infra';
  if (entries.some((e) => e.endsWith('.tf')) || entries.includes('Chart.yaml')) return 'infra';

  const manifests = await Promise.all(
    ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml']
      .filter((name) => entries.includes(name))
      .map((name) => readTextSafe(join(path, name))),
  );
  const text = manifests.join('\n');
  if (GAME_HINTS.test(text)) return 'game';
  if (DATA_HINTS.test(text)) return 'data';
  if (WEB_HINTS.test(text)) return 'web';
  const hasCode = manifests.length > 0 || entries.includes('src');
  if (!hasCode && docCount > 0) return 'docs';
  return 'generic';
}

export async function listDocs(projectPath: string): Promise<DocFile[]> {
  const out: DocFile[] = [];

  async function collect(dir: string, depth: number): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
        const { size } = await fs.stat(full);
        out.push({ relPath: relative(projectPath, full).split(sep).join('/'), size });
      } else if (entry.isDirectory() && depth > 0 && !isIgnoredDir(entry.name)) {
        await collect(full, depth - 1);
      }
    }
  }

  let rootEntries: Dirent[] = [];
  try {
    rootEntries = await fs.readdir(projectPath, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of rootEntries) {
    if (entry.isFile() && /\.(md|markdown)$/i.test(entry.name)) {
      const { size } = await fs.stat(join(projectPath, entry.name));
      out.push({ relPath: entry.name, size });
    }
  }
  await collect(join(projectPath, 'docs'), 3);
  return out.sort((a, b) => {
    const readme = Number(/^readme/i.test(b.relPath)) - Number(/^readme/i.test(a.relPath));
    return readme || a.relPath.localeCompare(b.relPath);
  });
}

export async function readDoc(projectPath: string, relPath: string): Promise<string> {
  if (!/\.(md|markdown)$/i.test(relPath)) throw new Error('Seuls les fichiers Markdown sont lisibles.');
  const root = await fs.realpath(projectPath);
  const full = await fs.realpath(resolve(root, relPath));
  if (full !== root && !full.startsWith(root + sep)) throw new Error('Chemin hors du projet.');
  return fs.readFile(full, 'utf8');
}

export async function inspectProject(path: string, previous?: Project, external = false): Promise<Project> {
  const resolved = resolve(path);
  const entries = await fs.readdir(resolved).catch(() => [] as string[]);
  const docs = await listDocs(resolved);
  const seed = previous?.seed ?? hashString(resolved);
  const color = previous?.color ?? (PROJECT_COLORS[seed % PROJECT_COLORS.length] as string);
  const project: Project = {
    id: projectIdFor(resolved),
    path: resolved,
    name: previous?.name ?? basename(resolved),
    color,
    ...(previous?.colorCustom ? { colorCustom: true } : {}),
    enabled: previous?.enabled ?? true,
    seed,
    kind: await detectKind(resolved, entries),
    category: await detectCategory(resolved, entries, docs.length),
    hasGit: entries.includes('.git'),
    docCount: docs.length,
  };
  if (previous?.roomType) project.roomType = previous.roomType;
  if (previous?.ideId) project.ideId = previous.ideId;
  if (external || previous?.external) project.external = true;
  return project;
}

export async function listSubfolders(root: string): Promise<string[]> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !isIgnoredDir(e.name))
    .map((e) => join(root, e.name))
    .sort((a, b) => a.localeCompare(b));
}

export async function scanRoot(root: string, previous: Project[], ignored: string[]): Promise<Project[]> {
  const folders = await listSubfolders(root);
  const byPath = new Map(previous.map((p) => [p.path, p]));
  const kept = await Promise.all(
    previous.map(async (p) => {
      if (!p.external && !folders.includes(p.path)) return null;
      if (!(await exists(p.path))) return null;
      return inspectProject(p.path, p);
    }),
  );
  const added = await Promise.all(
    folders.filter((f) => !byPath.has(f) && !ignored.includes(f)).map((f) => inspectProject(f)),
  );
  return [...kept.filter((p): p is Project => p !== null), ...added];
}

let watcher: FSWatcher | null = null;

export async function watchRoot(root: string, onAdd: (path: string) => void): Promise<void> {
  await stopWatching();
  watcher = chokidar.watch(root, { depth: 0, ignoreInitial: true, persistent: true });
  watcher.on('addDir', (path) => {
    if (resolve(path) === resolve(root)) return;
    if (isIgnoredDir(basename(path))) return;
    onAdd(resolve(path));
  });
  watcher.on('error', (error) => console.error('[watcher]', error));
}

export async function stopWatching(): Promise<void> {
  await watcher?.close();
  watcher = null;
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run('git', args, { cwd, maxBuffer: 16 * 1024 * 1024, timeout: 15_000 });
  return stdout;
}

export async function gitInfo(path: string): Promise<GitInfo> {
  const empty: GitInfo = { isRepo: false, branch: null, lastCommit: null, changedFiles: [] };
  try {
    await git(path, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    return empty;
  }
  const info: GitInfo = { ...empty, isRepo: true };
  info.branch = (await git(path, ['branch', '--show-current']).catch(() => '')).trim() || null;
  const log = await git(path, ['log', '-1', '--format=%h%x1f%s%x1f%an%x1f%cI']).catch(() => '');
  const [hash, subject, author, date] = log.trim().split('\x1f');
  if (hash && subject !== undefined) {
    info.lastCommit = { hash, subject, author: author ?? '', date: date ?? '' };
  }
  const status = await git(path, ['status', '--porcelain=v1']).catch(() => '');
  info.changedFiles = status
    .split('\n')
    .filter(Boolean)
    .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3) }));
  return info;
}

export async function gitDiff(path: string, relPath?: string): Promise<string> {
  const args = ['diff', 'HEAD', '--no-color'];
  if (relPath) args.push('--', relPath);
  return git(path, args).catch(() => git(path, ['diff', '--no-color', ...(relPath ? ['--', relPath] : [])]));
}
