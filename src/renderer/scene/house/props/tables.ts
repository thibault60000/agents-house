import { pick, range } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';
import { steam } from './fx';
import { taperedLeg } from './seating';
import { blend } from './fx';
import type { PropBuild } from './types';

function book(b: GeoBuilder, c: Palette, color: string, x: number, y: number, z: number, ry: number, w = 0.26, d = 0.19, h = 0.032): void {
  b.box(w, h, d, color, x, y, z, { ry });
  b.box(w - 0.015, h - 0.012, d - 0.008, c.cream, x + Math.sin(ry) * 0.004, y + 0.006, z + Math.cos(ry) * 0.004, { ry });
}

function mug(b: GeoBuilder, color: string, x: number, y: number, z: number): void {
  b.lathe([[0, 0], [0.038, 0], [0.043, 0.008], [0.043, 0.085], [0.036, 0.085], [0.034, 0.02], [0, 0.02]], color, x, y, z, { seg: 12 });
  b.ring(0.024, 0.006, color, x + 0.052, y + 0.046, z, { rx: 0, seg: 10 });
  b.cyl(0.035, 0.035, 0.004, '#5a3a24', x, y + 0.066, z, { seg: 10 });
}

export const coffeeTable: PropBuild = ({ b, c, fx, rng }) => {
  b.box(1.22, 0.05, 0.68, c.wood, 0, 0.37, 0, { r: 0.018 });
  b.box(1.1, 0.025, 0.56, c.woodDark, 0, 0.13, 0, { r: 0.008 });
  for (const x of [-0.54, 0.54]) {
    for (const z of [-0.27, 0.27]) b.cyl(0.013, 0.013, 0.37, c.dark, x, 0, z, { seg: 8 });
    b.box(0.022, 0.022, 0.57, c.dark, x, 0.345, 0);
    b.box(0.022, 0.022, 0.57, c.dark, x, 0.11, 0);
  }
  book(b, c, c.accent, -0.3, 0.42, -0.08, 0.2);
  book(b, c, c.accentDark, -0.3, 0.452, -0.08, -0.1, 0.22, 0.16);
  const x = range(rng, 0.12, 0.38);
  mug(b, c.ceramic, x, 0.42, 0.1);
  steam(b, fx, x, 0.53, 0.1);
  b.box(0.3, 0.05, 0.2, c.accentSoft, 0.1, 0.155, 0, { r: 0.015 });
  b.lathe([[0, 0], [0.05, 0], [0.11, 0.05], [0.12, 0.06], [0.1, 0.05], [0, 0.015]], c.terracotta, -0.32, 0.155, 0.04, { seg: 12 });
};

function chair(b: GeoBuilder, c: Palette, x: number, z: number, ry: number): void {
  b.at(x, z, ry, () => {
    b.box(0.44, 0.04, 0.42, c.wood, 0, 0.44, 0, { r: 0.015 });
    b.box(0.4, 0.03, 0.38, c.fabricAlt, 0, 0.48, 0.01, { r: 0.012 });
    for (const [lx, lz] of [[-0.19, 0.18], [0.19, 0.18]] as const) taperedLeg(b, c.woodDark, lx, lz, 0.44, 0.03);
    for (const lx of [-0.19, 0.19]) b.box(0.035, 0.92, 0.035, c.woodDark, lx, 0, -0.19, { rx: -0.03 });
    b.box(0.4, 0.09, 0.022, c.wood, 0, 0.82, -0.2, { r: 0.008 });
    for (const lx of [-0.09, 0, 0.09]) b.box(0.022, 0.32, 0.014, c.wood, lx, 0.5, -0.198);
  });
}

export const diningTable: PropBuild = ({ b, c, rng }) => {
  const slatTone = blend(c.wood, c.woodDark, 0.22);
  for (let i = 0; i < 4; i++) b.box(2.2, 0.06, 0.2625, i % 2 ? slatTone : c.wood, 0, 0.72, -0.39375 + i * 0.2625);
  b.box(2.0, 0.07, 0.86, c.woodDark, 0, 0.65, 0);
  for (const x of [-0.98, 0.98]) for (const z of [-0.42, 0.42]) b.box(0.07, 0.65, 0.07, c.woodDark, x, 0, z);
  b.box(1.5, 0.006, 0.3, c.accentSoft, 0, 0.78, 0);
  for (const x of [-0.6, 0.6]) {
    for (const side of [-1, 1]) {
      b.lathe([[0, 0], [0.085, 0], [0.13, 0.014], [0.13, 0.018], [0.085, 0.008], [0, 0.008]], c.ceramic, x, 0.78, side * 0.37, { seg: 14 });
      b.lathe([[0, 0], [0.025, 0], [0.006, 0.01], [0.006, 0.06], [0.03, 0.09], [0.03, 0.13]], '#cfe3ea', x + 0.17, 0.78, side * 0.28, { seg: 8 });
      b.box(0.016, 0.005, 0.15, c.metal, x - 0.17, 0.782, side * 0.37);
    }
  }
  b.lathe([[0, 0], [0.05, 0], [0.085, 0.06], [0.07, 0.15], [0.035, 0.2], [0.042, 0.23]], pick(rng, [c.terracotta, c.accent, c.ceramic]), 0, 0.786, 0, { seg: 12 });
  for (const a of [0.4, 2.4, 4.3]) {
    b.cyl(0.008, 0.009, 0.26, c.leafDark, Math.cos(a) * 0.03, 1.0, Math.sin(a) * 0.03, { rz: -Math.cos(a) * 0.3, rx: Math.sin(a) * 0.3, seg: 6 });
    b.blob(0.05, c.leaf, Math.cos(a) * 0.1, 1.27, Math.sin(a) * 0.1, { sy: 0.8 });
  }
  for (const x of [-0.6, 0.6]) {
    chair(b, c, x, -0.82, 0);
    chair(b, c, x, 0.82, Math.PI);
  }
  chair(b, c, -1.4, 0, Math.PI / 2);
  chair(b, c, 1.4, 0, -Math.PI / 2);
};

export const sideTable: PropBuild = ({ b, c, rng }) => {
  b.lathe([[0, 0], [0.2, 0], [0.2, 0.015], [0.05, 0.05], [0.028, 0.1], [0.024, 0.5], [0.05, 0.56]], c.woodDark, 0, 0, 0, { seg: 14 });
  b.lathe([[0, 0], [0.3, 0], [0.32, 0.015], [0.32, 0.03], [0, 0.03]], c.woodLight, 0, 0.56, 0, { seg: 18 });
  mug(b, c.ceramic, 0.1, 0.59, 0.06);
  book(b, c, pick(rng, [c.accent, c.fabric]), -0.08, 0.59, -0.05, 0.5, 0.2, 0.15, 0.03);
};

export const consoleTable: PropBuild = ({ b, c, rng }) => {
  b.box(1.2, 0.04, 0.34, c.wood, 0, 0.8, 0, { r: 0.012 });
  b.box(1.1, 0.12, 0.3, c.wood, 0, 0.68, 0);
  for (const x of [-0.28, 0.28]) {
    b.box(0.52, 0.09, 0.008, c.woodLight, x, 0.695, 0.152);
    b.sphere(0.016, c.metal, x, 0.74, 0.164, { seg: 8 });
  }
  for (const x of [-0.54, 0.54]) for (const z of [-0.13, 0.13]) taperedLeg(b, c.woodDark, x, z, 0.68, 0.02);
  b.box(1.04, 0.02, 0.26, c.woodDark, 0, 0.22, 0);
  b.lathe([[0, 0], [0.05, 0], [0.09, 0.08], [0.07, 0.2], [0.03, 0.27], [0.04, 0.3]], pick(rng, [c.accent, c.ceramic, c.terracotta]), -0.34, 0.84, 0, { seg: 12 });
  b.lathe([[0, 0], [0.07, 0], [0.11, 0.025], [0.1, 0.02], [0, 0.008]], c.accentDark, 0.08, 0.84, 0.03, { seg: 12 });
  b.box(0.14, 0.18, 0.015, c.dark, 0.38, 0.84, -0.05, { rx: -0.14 });
  b.box(0.11, 0.15, 0.006, c.accentSoft, 0.38, 0.855, -0.04, { rx: -0.14 });
  b.box(0.3, 0.1, 0.18, c.woodLight, 0.2, 0.24, 0, { r: 0.01 });
};

export const shoeBench: PropBuild = ({ b, c }) => {
  b.box(1.2, 0.04, 0.38, c.wood, 0, 0.42, 0, { r: 0.012 });
  b.box(1.14, 0.05, 0.34, c.fabricAlt, 0, 0.46, 0, { r: 0.02, soft: true });
  for (const x of [-0.56, 0.56]) b.box(0.05, 0.42, 0.34, c.woodDark, x, 0, 0);
  for (const z of [-0.12, -0.04, 0.04, 0.12]) b.box(1.08, 0.015, 0.055, c.woodDark, 0, 0.14, z);
  const pair = (x: number, color: string) => {
    for (const dx of [-0.05, 0.05]) {
      b.box(0.075, 0.015, 0.22, c.cream, x + dx, 0.155, 0, { r: 0.006 });
      b.box(0.07, 0.04, 0.2, color, x + dx, 0.17, 0, { r: 0.018 });
      b.box(0.066, 0.05, 0.09, color, x + dx, 0.19, -0.055, { r: 0.02 });
    }
  };
  pair(-0.34, c.dark);
  pair(0.04, c.accent);
  pair(0.36, '#8a5a34');
};
