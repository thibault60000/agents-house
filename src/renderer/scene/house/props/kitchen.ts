import { pick, range } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';
import type { PropBuild } from './types';

const STONE = '#ece7dd';

function counterBase(b: GeoBuilder, c: Palette, w: number, doors = Math.round(w / 0.6)): void {
  b.box(w - 0.04, 0.08, 0.54, c.dark, 0, 0, -0.03);
  b.box(w, 0.76, 0.6, c.woodLight, 0, 0.08, 0);
  for (let i = 0; i < doors; i++) {
    const dw = w / doors;
    const x = -w / 2 + (i + 0.5) * dw;
    b.box(dw - 0.03, 0.72, 0.012, c.accentSoft, x, 0.1, 0.303);
    b.box(dw - 0.13, 0.62, 0.006, c.fabricAlt, x, 0.15, 0.31);
    b.cyl(0.008, 0.008, 0.11, c.metal, x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), 0.64, 0.325, { seg: 6 });
  }
  b.box(w + 0.03, 0.045, 0.64, STONE, 0, 0.84, 0.012, { r: 0.008 });
  b.box(w, 0.1, 0.012, STONE, 0, 0.885, -0.3);
}

function faucet(b: GeoBuilder, c: Palette, x: number, y: number, z: number, reach = 0.17): void {
  b.cyl(0.018, 0.022, 0.05, c.metal, x, y, z, { seg: 8 });
  b.cyl(0.011, 0.011, 0.22, c.metal, x, y + 0.05, z, { seg: 8 });
  b.ring(reach / 2, 0.011, c.metal, x, y + 0.27, z + reach / 2, { rx: 0, ry: Math.PI / 2, seg: 14 });
  b.box(0.03, 0.05, 0.03, c.metal, x, y + 0.2, z + reach, { r: 0.008 });
  b.box(0.012, 0.012, 0.07, c.metal, x + 0.03, y + 0.06, z);
}

export const counterPlain: PropBuild = ({ b, c, rng }) => {
  counterBase(b, c, 1.8);
  const x = range(rng, -0.25, 0.1);
  b.box(0.42, 0.022, 0.28, c.woodLight, x, 0.885, 0.04, { r: 0.008, ry: 0.1 });
  b.sphere(0.05, '#e8604c', x + 0.08, 0.93, 0.05, { seg: 10 });
  b.box(0.14, 0.012, 0.02, c.metal, x - 0.08, 0.91, 0.02, { ry: 0.5 });
  b.box(0.12, 0.2, 0.14, c.woodDark, -0.72, 0.885, -0.12, { rx: -0.14 });
  for (const dx of [-0.03, 0, 0.03]) b.box(0.015, 0.05, 0.02, c.dark, -0.72 + dx, 1.08, -0.15, { rx: -0.14 });
  b.box(0.2, 0.3, 0.24, c.dark, 0.66, 0.885, -0.12, { r: 0.02 });
  b.box(0.16, 0.08, 0.06, '#c9ccd1', 0.66, 1.0, 0.0);
  b.lathe([[0, 0], [0.03, 0], [0.036, 0.05], [0.036, 0.075]], c.ceramic, 0.66, 0.885, 0.0, { seg: 8 });
  b.box(0.05, 0.022, 0.004, '#7fe0a0', 0.66, 1.13, 0.004, { glow: true });
  b.lathe([[0, 0], [0.04, 0], [0.12, 0.05], [0.13, 0.08], [0.1, 0.05], [0, 0.012]], c.ceramic, 0.24, 0.885, -0.08, { seg: 12 });
};

export const counterSink: PropBuild = ({ b, c }) => {
  counterBase(b, c, 1.8);
  b.box(0.82, 0.008, 0.44, c.metal, -0.14, 0.885, 0.02, { r: 0.003 });
  for (const x of [-0.34, 0.06]) {
    b.box(0.36, 0.004, 0.34, '#6d7680', x, 0.89, 0.03);
    b.cyl(0.02, 0.02, 0.004, c.dark, x, 0.893, 0.03, { seg: 8 });
  }
  faucet(b, c, -0.14, 0.89, -0.2);
  b.box(0.44, 0.012, 0.3, c.metal, 0.58, 0.885, 0.02);
  for (let i = 0; i < 5; i++) b.cyl(0.075, 0.075, 0.012, c.ceramic, 0.42 + i * 0.075, 0.965, 0.02, { rz: Math.PI / 2 - 0.2, seg: 14 });
  for (const z of [-0.08, 0.12]) b.box(0.42, 0.016, 0.016, c.metal, 0.58, 0.92, z);
  b.lathe([[0, 0], [0.028, 0], [0.028, 0.09], [0.012, 0.11], [0.012, 0.14]], c.accent, -0.72, 0.885, -0.12, { seg: 8 });
  b.box(0.1, 0.03, 0.065, '#e9c64c', -0.72, 0.885, 0.06, { r: 0.008 });
};

export const counterStove: PropBuild = ({ b, c }) => {
  const w = 1.2;
  counterBase(b, c, w, 2);
  b.box(0.62, 0.715, 0.03, '#2a2c33', 0, 0.1, 0.31);
  b.box(0.5, 0.36, 0.012, '#4a3a2a', 0, 0.2, 0.325, { glow: true });
  b.box(0.54, 0.018, 0.03, c.metal, 0, 0.61, 0.34, { r: 0.006 });
  for (const x of [-0.2, 0, 0.2]) b.cyl(0.024, 0.024, 0.02, c.metal, x, 0.73, 0.33, { rx: Math.PI / 2, seg: 10 });
  b.box(0.76, 0.012, 0.52, '#25272d', 0, 0.885, 0.01);
  for (const [x, z] of [[-0.2, -0.13], [0.2, -0.13], [-0.2, 0.13], [0.2, 0.13]] as const) {
    b.cyl(0.07, 0.07, 0.008, '#44464e', x, 0.897, z, { seg: 12 });
    b.box(0.17, 0.016, 0.016, '#15161a', x, 0.91, z);
    b.box(0.016, 0.016, 0.17, '#15161a', x, 0.91, z);
  }
  b.lathe([[0, 0], [0.1, 0], [0.105, 0.11], [0.098, 0.11]], c.accentDark, 0.2, 0.922, -0.13, { seg: 14 });
  b.lathe([[0, 0], [0.104, 0], [0.05, 0.02], [0.012, 0.024], [0.015, 0.045], [0, 0.05]], c.metal, 0.2, 1.03, -0.13, { seg: 14 });
  b.lathe([[0, 0], [0.095, 0], [0.11, 0.035], [0.1, 0.03], [0, 0.01]], c.dark, -0.2, 0.922, 0.13, { seg: 14 });
  b.box(0.03, 0.015, 0.15, c.dark, -0.2, 0.945, 0.29, { ry: -0.5 });
};

export const fridge: PropBuild = ({ b, c, rng }) => {
  const body = '#e8ebee';
  b.box(0.82, 0.06, 0.68, c.dark, 0, 0, -0.02);
  b.box(0.85, 1.92, 0.7, body, 0, 0.05, -0.02, { r: 0.04 });
  b.box(0.83, 0.56, 0.05, '#f3f5f7', 0, 1.39, 0.34, { r: 0.018 });
  b.box(0.83, 1.22, 0.05, '#f3f5f7', 0, 0.13, 0.34, { r: 0.018 });
  for (const [y, h] of [[1.44, 0.36], [0.92, 0.36]] as const) {
    b.box(0.026, h, 0.026, c.metal, -0.33, y, 0.375, { r: 0.008 });
  }
  b.box(0.1, 0.14, 0.004, c.cream, 0.14, 1.02, 0.368, { rz: 0.06 });
  b.box(0.07, 0.05, 0.004, c.accent, 0.14, 1.12, 0.37);
  b.box(0.12, 0.09, 0.004, pick(rng, ['#ffd166', '#6cc6ff']), -0.06, 0.8, 0.368, { rz: -0.08 });
  b.sphere(0.018, '#e8604c', -0.06, 0.88, 0.372, { seg: 8 });
  b.box(0.24, 0.18, 0.2, '#c29a6c', -0.18, 1.97, -0.05);
  b.lathe([[0, 0], [0.05, 0], [0.05, 0.2], [0.02, 0.26], [0.02, 0.3]], c.accentDark, 0.2, 1.97, -0.05, { seg: 10 });
};

export const spiceShelf: PropBuild = ({ b, c, rng }) => {
  for (const x of [-0.6, 0.6]) {
    b.box(0.045, 1.6, 0.045, c.woodDark, x, 0, -0.08);
    b.box(0.045, 0.02, 0.24, c.woodDark, x, 0, -0.02);
  }
  for (const y of [0.9, 1.22, 1.54]) {
    b.box(1.3, 0.03, 0.24, c.wood, 0, y, 0);
    b.box(1.304, 0.035, 0.008, c.woodDark, 0, y + 0.02, 0.118);
    for (let i = 0; i < 7; i++) {
      const x = -0.54 + i * 0.18;
      const color = pick(rng, ['#c2452d', '#e8b64c', '#8c5a2b', '#6e8b3d', '#d97b29', '#f1e4c3', '#7a3b52']);
      b.cyl(0.05, 0.05, 0.11, color, x, y + 0.03, 0, { seg: 10 });
      b.cyl(0.052, 0.052, 0.03, c.dark, x, y + 0.14, 0, { seg: 10 });
      b.box(0.06, 0.04, 0.004, c.cream, x, y + 0.06, 0.05);
    }
  }
};
