import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const MARK = '__HOUSE_PATH__';

export async function hydratePath(): Promise<void> {
  const extras = [
    join(homedir(), '.local', 'bin'),
    join(homedir(), '.local', 'share', 'JetBrains', 'Toolbox', 'scripts'),
    join(homedir(), '.claude', 'local'),
    '/usr/local/bin',
    '/opt/homebrew/bin',
  ];
  let shellPath = '';
  if (process.platform !== 'win32') {
    const shell = process.env.SHELL || '/bin/bash';
    shellPath = await new Promise<string>((resolve) => {
      execFile(shell, ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`], { timeout: 4000 }, (_err, stdout) => {
        const match = stdout?.match(new RegExp(`${MARK}(.*)${MARK}`));
        resolve(match?.[1] ?? '');
      });
    });
  }
  const parts = [...shellPath.split(delimiter), ...(process.env.PATH ?? '').split(delimiter), ...extras];
  process.env.PATH = [...new Set(parts.filter(Boolean))].join(delimiter);
}

export function which(command: string): Promise<string | null> {
  const finder = process.platform === 'win32' ? 'where' : 'which';
  return new Promise((resolve) => {
    execFile(finder, [command], { timeout: 4000 }, (error, stdout) => {
      if (error) return resolve(null);
      resolve(stdout.split(/\r?\n/)[0]?.trim() || null);
    });
  });
}
