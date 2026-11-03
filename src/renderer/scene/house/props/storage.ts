import { pick, range } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';
import { blend } from './fx';
import { taperedLeg } from './seating';
import { tableLamp } from './decor';
import type { PropBuild } from './types';

function front(b: GeoBuilder, color: string, handle: string, x: number, y: number, z: number, w: number, h: number): void {
  b.box(w, h, 0.012, color, x, y, z);
  b.box(Math.min(0.16, w * 0.4), 0.014, 0.018, handle, x, y + h - 0.05, z + 0.012, { r: 0.004 });
}

export const tvStand: PropBuild = ({ b, c, rng }) => {
  b.box(1.9, 0.38, 0.46, c.wood, 0, 0.12, 0, { r: 0.012 });
  for (const x of [-0.82, 0.82]) for (const z of [-0.17, 0.17]) taperedLeg(b, c.dark, x, z, 0.12, 0.05);
  for (let i = 0; i < 26; i++) b.box(0.022, 0.32, 0.01, c.woodLight, -0.92 + i * 0.03, 0.15, 0.232);
  b.box(0.98, 0.32, 0.01, c.woodDark, 0.42, 0.15, 0.232);
  b.sphere(0.014, c.metal, 0.03, 0.31, 0.244, { seg: 8 });
  b.box(0.5, 0.018, 0.2, c.dark, 0, 0.5, -0.02, { r: 0.006 });
  b.box(0.06, 0.1, 0.03, c.dark, 0, 0.518, -0.02);
  b.box(1.6, 0.9, 0.035, c.dark, 0, 0.6, -0.02, { r: 0.012 });
  b.box(1.54, 0.84, 0.006, '#2f5e8f', 0, 0.63, 0.0, { glow: true });
  b.box(1.536, 0.296, 0.007, '#d98a5a', 0, 0.632, 0.001, { glow: true });
  b.box(1.532, 0.06, 0.008, '#ffd9a0', 0, 0.92, 0.002, { glow: true });
  b.box(0.7, 0.05, 0.08, c.dark, 0, 0.5, 0.16, { r: 0.018 });
  b.box(0.26, 0.05, 0.16, '#30323a', -0.68, 0.5, 0.06, { r: 0.008 });
  b.lathe([[0, 0], [0.05, 0], [0.07, 0.08], [0.05, 0.15]], pick(rng, [c.terracotta, c.ceramic]), 0.72, 0.5, 0.06, { seg: 10 });
  b.blob(0.09, c.leaf, 0.72, 0.72, 0.06);
};

export const sideboard: PropBuild = ({ b, c, rng }) => {
  b.box(1.8, 0.72, 0.46, c.wood, 0, 0.16, 0, { r: 0.012 });
  for (const x of [-0.8, 0.8]) for (const z of [-0.18, 0.18]) taperedLeg(b, c.woodDark, x, z, 0.16, 0.06);
  for (const x of [-0.585, 0, 0.585]) {
    b.box(0.56, 0.64, 0.012, c.woodLight, x, 0.2, 0.232);
    b.box(0.46, 0.54, 0.006, c.wood, x, 0.25, 0.24);
    b.cyl(0.012, 0.012, 0.06, c.metal, x + 0.22, 0.48, 0.248, { seg: 8 });
  }
  b.box(1.84, 0.03, 0.5, c.woodDark, 0, 0.88, 0, { r: 0.008 });
  b.lathe([[0, 0], [0.06, 0], [0.11, 0.12], [0.08, 0.26], [0.035, 0.33], [0.05, 0.36]], pick(rng, [c.accent, c.ceramic, c.terracotta]), -0.58, 0.91, 0, { seg: 12 });
  for (const [i, color] of [c.accent, c.accentDark, c.cream].entries()) b.box(0.3 - i * 0.02, 0.035, 0.2, color, 0.06, 0.91 + i * 0.035, 0, { ry: i * 0.08 });
  b.lathe([[0, 0], [0.05, 0], [0.14, 0.05], [0.15, 0.08], [0.12, 0.05], [0, 0.015]], c.woodDark, 0.58, 0.91, 0, { seg: 14 });
  for (const [dx, dz, color] of [[-0.05, 0, '#e8604c'], [0.05, 0.03, '#e9b44c'], [0.01, -0.05, '#7fae48']] as const) b.sphere(0.05, color, 0.58 + dx, 1.0, dz, { seg: 10 });
};

export const dresser: PropBuild = ({ b, c, rng }) => {
  b.box(1.3, 0.8, 0.48, c.wood, 0, 0.14, 0, { r: 0.012 });
  for (const x of [-0.56, 0.56]) for (const z of [-0.18, 0.18]) taperedLeg(b, c.woodDark, x, z, 0.14, 0.06);
  for (let y = 0; y < 3; y++) {
    for (const x of [-0.31, 0.31]) front(b, c.woodLight, c.metal, x, 0.18 + y * 0.25, 0.242, 0.58, 0.22);
  }
  b.box(1.34, 0.03, 0.52, c.woodDark, 0, 0.94, 0, { r: 0.008 });
  b.box(0.2, 0.025, 0.1, c.woodDark, 0, 0.97, -0.14);
  b.box(0.03, 0.14, 0.03, c.woodDark, 0, 0.99, -0.14);
  b.cyl(0.24, 0.24, 0.022, c.woodDark, 0, 1.33, -0.14, { rx: Math.PI / 2, seg: 22 });
  b.cyl(0.215, 0.215, 0.012, '#c4dde8', 0, 1.33, -0.125, { rx: Math.PI / 2, seg: 22 });
  b.lathe([[0, 0], [0.035, 0], [0.04, 0.05], [0.015, 0.08], [0.015, 0.11]], c.accentSoft, 0.42, 0.97, 0.02, { seg: 10 });
  b.lathe([[0, 0], [0.03, 0], [0.03, 0.09], [0.012, 0.11], [0.012, 0.14]], pick(rng, [c.accent, '#d9a441']), 0.52, 0.97, -0.06, { seg: 10 });
  b.box(0.22, 0.09, 0.15, c.accentDark, -0.42, 0.97, 0, { r: 0.012 });
  b.box(0.23, 0.02, 0.16, c.woodDark, -0.42, 1.06, 0);
};

export const nightstand: PropBuild = (ctx) => {
  const { b, c, rng } = ctx;
  b.box(0.5, 0.4, 0.42, c.wood, 0, 0.14, 0, { r: 0.012 });
  for (const x of [-0.2, 0.2]) for (const z of [-0.16, 0.16]) taperedLeg(b, c.woodDark, x, z, 0.14, 0.05);
  front(b, c.woodLight, c.metal, 0, 0.34, 0.214, 0.44, 0.16);
  b.box(0.44, 0.15, 0.006, c.woodDark, 0, 0.17, 0.212);
  b.box(0.52, 0.02, 0.44, c.woodDark, 0, 0.54, 0, { r: 0.006 });
  b.at(-0.1, -0.04, 0, () => tableLamp(ctx), 0.56);
  b.box(0.17, 0.03, 0.12, pick(rng, [c.accent, c.accentDark, c.dark]), 0.13, 0.56, 0.09, { ry: 0.3 });
  b.box(0.09, 0.05, 0.045, c.dark, 0.14, 0.59, 0.09, { ry: 0.3, r: 0.008 });
  b.box(0.06, 0.028, 0.004, '#ff8a5c', 0.145, 0.6, 0.113, { ry: 0.3, glow: true });
};

export const bookshelf: PropBuild = ({ b, c, rng }) => {
  const w = 1.9;
  const top = 1.8;
  for (const x of [-w / 2, w / 2]) b.box(0.05, top + 0.05, 0.38, c.woodDark, x, 0.05, 0);
  b.box(w + 0.05, 0.05, 0.38, c.woodDark, 0, 0, 0);
  b.box(w - 0.04, top - 0.05, 0.015, c.wood, 0, 0.05, -0.178);
  const levels = [0.05, 0.48, 0.91, 1.34, top];
  for (const y of levels) {
    b.box(w - 0.04, 0.04, 0.34, c.woodDark, 0, y, 0.005);
    if (y >= top) continue;
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.1) {
      const roll = rng();
      if (roll > 0.9 && x < w / 2 - 0.36) {
        const color = pick(rng, [c.accent, c.ceramic, c.terracotta, '#d9a441']);
        b.lathe([[0, 0], [0.05, 0], [0.085, 0.09], [0.05, 0.19], [0.025, 0.24]], color, x + 0.11, y + 0.04, 0.02, { seg: 10 });
        x += 0.23;
        continue;
      }
      if (roll > 0.82 && x < w / 2 - 0.34) {
        for (let k = 0; k < 3; k++) b.box(0.25, 0.035, 0.2, pick(rng, ['#7a3b52', '#3f6c8f', c.accent, c.cream]), x + 0.13, y + 0.04 + k * 0.036, 0.02, { ry: range(rng, -0.1, 0.1) });
        x += 0.28;
        continue;
      }
      const t = 0.038 + rng() * 0.04;
      const h = 0.25 + rng() * 0.11;
      const color = pick(rng, [c.accent, c.accentDark, c.accentSoft, '#7a3b52', '#3f6c8f', '#c9a13b', '#3f7d5a', c.cream, '#8a5a34']);
      const lean = rng() > 0.9 ? 0.09 : 0;
      b.box(t, h, 0.23, color, x + t / 2 + lean * h * 0.5, y + 0.04, 0.02, { rz: -lean });
      if (rng() > 0.55) b.box(t + 0.002, 0.012, 0.232, c.cream, x + t / 2 + lean * h * 0.5, y + 0.04 + h * 0.72, 0.02, { rz: -lean });
      x += t + 0.006 + lean * 0.3;
    }
  }
};

export const metalShelves: PropBuild = ({ b, c, rng }) => {
  const steel = '#7f858d';
  for (const x of [-0.74, 0.74]) {
    for (const z of [-0.2, 0.2]) {
      b.box(0.035, 1.9, 0.035, steel, x, 0, z);
      for (let k = 0; k < 8; k++) b.box(0.012, 0.03, 0.038, c.dark, x, 0.15 + k * 0.22, z);
    }
    b.box(0.02, 0.02, 0.4, steel, x, 1.0, 0);
  }
  for (const y of [0.18, 0.78, 1.38, 1.86]) {
    b.box(1.5, 0.03, 0.44, c.metal, 0, y, 0);
    b.box(1.504, 0.045, 0.012, steel, 0, y - 0.02, 0.222);
    if (y > 1.8) continue;
    let x = -0.62;
    while (x < 0.5) {
      const roll = rng();
      if (roll < 0.34) {
        const color = pick(rng, ['#c44536', '#3f7d5a', c.accent, '#e9b44c']);
        b.cyl(0.085, 0.085, 0.17, c.metal, x + 0.09, y + 0.03, 0, { seg: 12 });
        b.cyl(0.087, 0.087, 0.03, color, x + 0.09, y + 0.2, 0, { seg: 12 });
        b.box(0.04, 0.09, 0.006, color, x + 0.09, y + 0.11, 0.084);
        x += 0.22;
      } else if (roll < 0.68) {
        const color = pick(rng, [c.accentSoft, '#3f6c8f', '#e9b44c', c.dark]);
        b.box(0.32, 0.22, 0.32, color, x + 0.16, y + 0.03, 0, { r: 0.015 });
        b.box(0.34, 0.02, 0.34, color, x + 0.16, y + 0.25, 0);
        b.box(0.12, 0.05, 0.004, c.cream, x + 0.16, y + 0.12, 0.162);
        x += 0.38;
      } else {
        const h = 0.2 + rng() * 0.14;
        b.box(0.34, h, 0.3, '#c29a6c', x + 0.17, y + 0.03, 0);
        b.box(0.345, 0.003, 0.05, '#a9825a', x + 0.17, y + 0.03 + h, 0);
        x += 0.4;
      }
    }
  }
};

export const jarShelf: PropBuild = ({ b, c, rng }) => {
  for (const x of [-0.82, 0.82]) b.box(0.06, 1.98, 0.42, c.woodDark, x, 0, 0);
  b.box(1.66, 1.92, 0.015, c.wood, 0, 0.04, -0.2);
  for (const y of [0.18, 0.74, 1.3, 1.92]) {
    b.box(1.6, 0.04, 0.4, c.wood, 0, y, 0);
    if (y > 1.8) continue;
    for (let i = 0; i < 6; i++) {
      const x = -0.65 + i * 0.26;
      const color = pick(rng, ['#e8b64c', '#c2452d', '#6e8b3d', '#d97b29', '#f1e4c3', '#7a3b52']);
      const fill = 0.1 + rng() * 0.07;
      b.cyl(0.085, 0.082, fill, color, x, y + 0.04, 0, { seg: 10 });
      b.lathe([[0.085, 0], [0.085, 0.2 - fill], [0.058, 0.24 - fill]], '#dbe8ea', x, y + 0.04 + fill, 0, { seg: 10 });
      b.cyl(0.062, 0.062, 0.028, c.woodLight, x, y + 0.28, 0, { seg: 10 });
      b.box(0.075, 0.045, 0.004, c.cream, x, y + 0.08, 0.086);
    }
  }
};

export const trunk: PropBuild = ({ b, c }) => {
  const plankTone = blend(c.woodDark, c.wood, 0.3);
  b.box(1.12, 0.03, 0.6, blend(c.woodDark, c.dark, 0.5), 0, 0, 0);
  for (let i = 0; i < 4; i++) b.box(1.1, 0.11, 0.58, i % 2 ? plankTone : c.woodDark, 0, 0.03 + i * 0.11, 0);
  b.box(1.14, 0.05, 0.62, c.wood, 0, 0.47, 0);
  b.cyl(0.27, 0.27, 1.06, c.wood, 0, 0.52 - 0.53, 0, { rz: Math.PI / 2, sx: 0.55, seg: 18 });
  for (const x of [-0.42, 0.42]) {
    b.box(0.07, 0.43, 0.63, c.dark, x, 0.03, 0);
    b.cyl(0.295, 0.295, 0.07, c.dark, x, 0.52 - 0.035, 0, { rz: Math.PI / 2, sx: 0.55, seg: 18 });
  }
  b.box(0.13, 0.135, 0.02, '#c9a13b', 0, 0.33, 0.301, { r: 0.008 });
  b.cyl(0.02, 0.02, 0.012, c.dark, 0, 0.385, 0.312, { rx: Math.PI / 2, seg: 8 });
  for (const x of [-0.558, 0.558]) b.ring(0.05, 0.01, c.metal, x, 0.32, 0, { rx: 0, ry: Math.PI / 2, seg: 12 });
};
