import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

app.setPath('userData', join(app.getPath('appData'), 'Maison des Agents'));

export function privateWorkDir(): string {
  const dir = join(app.getPath('userData'), 'claude-cwd');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}
