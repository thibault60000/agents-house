import { spawn } from 'node:child_process';
import type { ClaudeStatus, LimitWindow, UsageLimits } from '@shared/types';
import { privateWorkDir } from './data-dir';

const PROBE_MS = 5 * 60_000;
const PROBE_NEAR_MS = 2 * 60_000;
const NEAR_LIMIT = 70;
const PROBE_TIMEOUT_MS = 45_000;

let limits: UsageLimits = { fiveHour: null, sevenDay: null, updatedAt: 0 };
let timer: NodeJS.Timeout | null = null;
let onChange: (limits: UsageLimits) => void = () => {};

export function getLimits(): UsageLimits {
  return limits;
}

function readWindow(raw: any): LimitWindow | null {
  const utilization = Number(raw?.utilization);
  const resetsAt = Number(raw?.resetsAt);
  if (!Number.isFinite(utilization) || !Number.isFinite(resetsAt)) return null;
  return { used: Math.min(100, Math.max(0, utilization * 100)), resetsAt: resetsAt * 1000 };
}

export function noteRateLimit(info: any): void {
  const windows = info?.unifiedWindows;
  if (!windows) return;
  limits = {
    fiveHour: readWindow(windows.five_hour) ?? limits.fiveHour,
    sevenDay: readWindow(windows.seven_day) ?? limits.sevenDay,
    updatedAt: Date.now(),
  };
  onChange(limits);
}

function probe(claudePath: string): Promise<void> {
  return new Promise((done) => {
    const args = ['-p', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands', '--system-prompt', 'Reply ok.', '--tools', '', '--no-session-persistence', '--model', 'haiku', '--effort', 'low', '--output-format', 'stream-json', '--verbose'];
    const child = spawn(claudePath, args, { cwd: privateWorkDir(), stdio: ['pipe', 'pipe', 'ignore'], shell: process.platform === 'win32', env: process.env });
    const guard = setTimeout(() => child.kill(), PROBE_TIMEOUT_MS);
    let buffer = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.includes('rate_limit_event')) continue;
        try {
          noteRateLimit(JSON.parse(line).rate_limit_info);
        } catch {
        }
      }
    });
    child.stdin?.on('error', () => {});
    child.stdin?.end('ok');
    const finish = () => {
      clearTimeout(guard);
      done();
    };
    child.on('error', finish);
    child.on('close', finish);
  });
}

export function watchLimits(options: { claude: () => Promise<ClaudeStatus>; enabled: () => boolean; onChange: (limits: UsageLimits) => void }): void {
  onChange = options.onChange;
  const tick = async () => {
    const interval = Math.max(limits.fiveHour?.used ?? 0, limits.sevenDay?.used ?? 0) >= NEAR_LIMIT ? PROBE_NEAR_MS : PROBE_MS;
    if (options.enabled() && Date.now() - limits.updatedAt >= interval - 5000) {
      const status = await options.claude().catch(() => null);
      if (status?.available && status.path) await probe(status.path);
    }
    timer = setTimeout(() => void tick(), 30_000);
    timer.unref();
  };
  timer = setTimeout(() => void tick(), 5000);
  timer.unref();
}

export function stopWatchingLimits(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}
