import { PROJECT_COLORS, type Project } from './types';

type Lab = [number, number, number];

const MIN_DISTANCE = 0.1;

function linear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function oklab(hex: string): Lab {
  const r = linear(parseInt(hex.slice(1, 3), 16) / 255);
  const g = linear(parseInt(hex.slice(3, 5), 16) / 255);
  const b = linear(parseInt(hex.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122 * r + 0.5363 * g + 0.0514 * b);
  const m = Math.cbrt(0.2119 * r + 0.6807 * g + 0.1074 * b);
  const s = Math.cbrt(0.0883 * r + 0.2817 * g + 0.63 * b);
  return [0.2104 * l + 0.7936 * m - 0.004 * s, 1.9779 * l - 2.4286 * m + 0.4506 * s, 0.0259 * l + 0.7828 * m - 0.8087 * s];
}

function distance(a: string, b: string): number {
  const [al, aa, ab] = oklab(a);
  const [bl, ba, bb] = oklab(b);
  return Math.hypot(al - bl, aa - ba, ab - bb);
}

function hsl(hue: number, saturation: number, lightness: number): string {
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value = lightness - saturation * Math.min(lightness, 1 - lightness) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

const EXTENDED = Array.from({ length: 24 }, (_, i) => [hsl(i * 15, 0.8, 0.32), hsl(i * 15, 0.85, 0.5), hsl(i * 15, 0.8, 0.72)]).flat();

function farthestFrom(taken: string[], candidates: readonly string[]): { color: string; gap: number } {
  let best = { color: candidates[0] as string, gap: -1 };
  for (const color of candidates) {
    const gap = taken.length ? Math.min(...taken.map((other) => distance(color, other))) : Infinity;
    if (gap > best.gap) best = { color, gap };
  }
  return best;
}

function pickColor(taken: string[]): string {
  const fromPalette = farthestFrom(taken, PROJECT_COLORS);
  return fromPalette.gap >= MIN_DISTANCE ? fromPalette.color : farthestFrom(taken, EXTENDED).color;
}

export function distributeColors(projects: Project[]): Project[] {
  const taken = projects.filter((p) => p.colorCustom).map((p) => p.color);
  return projects.map((project) => {
    if (project.colorCustom) return project;
    const valid = /^#[0-9a-f]{6}$/i.test(project.color);
    const color = valid && taken.every((other) => distance(project.color, other) >= MIN_DISTANCE) ? project.color : pickColor(taken);
    taken.push(color);
    return color === project.color ? project : { ...project, color };
  });
}
