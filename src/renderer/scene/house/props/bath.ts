import { pick } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';
import type { PropBuild } from './types';

function tap(b: GeoBuilder, c: Palette, x: number, y: number, z: number, reach = 0.12): void {
  b.cyl(0.015, 0.018, 0.04, c.metal, x, y, z, { seg: 8 });
  b.cyl(0.009, 0.009, 0.1, c.metal, x, y + 0.04, z, { seg: 8 });
  b.box(0.018, 0.018, reach, c.metal, x, y + 0.13, z + reach / 2, { r: 0.006 });
  b.box(0.012, 0.012, 0.06, c.metal, x, y + 0.155, z, { ry: 0.6 });
}

export const bathtub: PropBuild = ({ b, c, rng }) => {
  const shell = c.ceramic;
  b.box(1.9, 0.5, 0.86, shell, 0, 0.05, 0, { r: 0.14, soft: true });
  for (const z of [-0.39, 0.39]) b.box(1.92, 0.05, 0.1, '#ffffff', 0, 0.53, z, { r: 0.02 });
  for (const x of [-0.9, 0.9]) b.box(0.12, 0.05, 0.88, '#ffffff', x, 0.53, 0, { r: 0.02 });
  b.box(1.72, 0.03, 0.7, '#dfe9ec', 0, 0.5, 0);
  b.box(1.7, 0.012, 0.68, '#8fd0e0', 0, 0.552, 0);
  for (const x of [-0.8, 0.8]) for (const z of [-0.32, 0.32]) b.sphere(0.05, c.metal, x, 0.05, z, { seg: 8 });
  tap(b, c, -0.8, 0.58, -0.02, 0.15);
  b.box(0.14, 0.02, 0.05, c.metal, -0.8, 0.585, -0.26);
  b.cyl(0.01, 0.01, 0.16, c.metal, -0.8, 0.59, 0.26, { seg: 8 });
  b.cyl(0.035, 0.03, 0.03, c.metal, -0.78, 0.74, 0.26, { seg: 10, rz: -0.6 });
  const towel = pick(rng, [c.accentSoft, c.fabricAlt, c.cream]);
  b.box(0.46, 0.022, 0.09, towel, 0.34, 0.58, 0.42);
  b.box(0.46, 0.28, 0.018, towel, 0.34, 0.31, 0.45);
  b.sphere(0.05, '#ffd166', 0.3, 0.575, -0.06, { sy: 0.8, seg: 10 });
  b.sphere(0.034, '#ffd166', 0.34, 0.635, -0.06, { seg: 10 });
  b.box(0.022, 0.01, 0.024, '#e8743b', 0.375, 0.63, -0.06);
};

export const vanity: PropBuild = ({ b, c, rng }) => {
  b.box(0.88, 0.1, 0.46, c.dark, 0, 0, -0.01);
  b.box(0.92, 0.64, 0.5, c.woodLight, 0, 0.1, 0, { r: 0.008 });
  for (const x of [-0.225, 0.225]) {
    b.box(0.43, 0.58, 0.012, c.wood, x, 0.13, 0.252);
    b.cyl(0.007, 0.007, 0.09, c.metal, x + (x < 0 ? 0.17 : -0.17), 0.52, 0.266, { seg: 6 });
  }
  b.box(0.96, 0.04, 0.54, c.ceramic, 0, 0.74, 0, { r: 0.01 });
  b.lathe([[0, 0], [0.09, 0], [0.19, 0.08], [0.2, 0.11], [0.17, 0.09], [0.05, 0.02], [0, 0.015]], c.ceramic, 0, 0.78, 0.03, { seg: 18 });
  tap(b, c, 0, 0.78, -0.2, 0.13);
  b.lathe([[0, 0], [0.032, 0], [0.038, 0.1]], pick(rng, [c.accent, c.accentSoft]), -0.36, 0.78, -0.05, { seg: 10 });
  for (const [dx, color] of [[-0.012, '#6cc6ff'], [0.012, '#ff8a5c']] as const) b.cyl(0.008, 0.008, 0.17, color, -0.36 + dx, 0.81, -0.05, { rz: dx * 8, seg: 5 });
  b.box(0.08, 0.025, 0.055, c.cream, 0.36, 0.78, 0, { r: 0.012 });
  b.box(0.05, 0.42, 0.03, c.metal, 0, 0.78, -0.25);
  b.cyl(0.33, 0.33, 0.025, c.metal, 0, 1.14, -0.24, { rx: Math.PI / 2, seg: 24 });
  b.cyl(0.3, 0.3, 0.012, '#c8e0ea', 0, 1.14, -0.225, { rx: Math.PI / 2, seg: 24 });
  b.box(0.4, 0.022, 0.03, '#fff3c4', 0, 1.5, -0.22, { glow: true, r: 0.008 });
};

export const toilet: PropBuild = ({ b, c }) => {
  const white = c.ceramic;
  b.box(0.42, 0.42, 0.17, white, 0, 0.42, -0.22, { r: 0.04, soft: true });
  b.box(0.44, 0.03, 0.19, '#ffffff', 0, 0.84, -0.22, { r: 0.012 });
  b.cyl(0.03, 0.03, 0.012, c.metal, 0, 0.87, -0.22, { seg: 10 });
  b.lathe([[0, 0], [0.13, 0], [0.11, 0.1], [0.14, 0.2], [0.2, 0.33], [0.21, 0.39], [0, 0.39]], white, 0, 0, 0.04, { seg: 18, sz: 1.2 });
  b.cyl(0.215, 0.215, 0.02, '#ffffff', 0, 0.395, 0.05, { seg: 18, sz: 1.22 });
  b.cyl(0.205, 0.205, 0.024, '#f0f1f2', 0, 0.42, 0.05, { seg: 18, sz: 1.2 });
  b.box(0.03, 0.5, 0.03, c.metal, 0.4, 0, -0.24);
  b.box(0.15, 0.015, 0.015, c.metal, 0.4, 0.5, -0.17, { ry: Math.PI / 2 });
  b.cyl(0.055, 0.055, 0.1, c.cream, 0.4, 0.42, -0.13, { rz: Math.PI / 2, seg: 12 });
  b.cyl(0.02, 0.02, 0.102, '#c8b796', 0.4, 0.42, -0.13, { rz: Math.PI / 2, seg: 8 });
  b.lathe([[0, 0], [0.05, 0], [0.055, 0.15]], white, -0.38, 0, -0.2, { seg: 12 });
  b.cyl(0.008, 0.008, 0.3, c.metal, -0.38, 0.14, -0.2, { seg: 6 });
  b.sphere(0.016, c.metal, -0.38, 0.44, -0.2, { seg: 8 });
};

export const smallSink: PropBuild = ({ b, c }) => {
  b.lathe([[0, 0], [0.085, 0], [0.075, 0.02], [0.05, 0.3], [0.09, 0.66], [0.18, 0.74]], c.ceramic, 0, 0, -0.03, { seg: 14 });
  b.lathe([[0, 0], [0.18, 0], [0.2, 0.05], [0.18, 0.04], [0.04, 0.005], [0, 0]], c.ceramic, 0, 0.72, 0, { seg: 16 });
  tap(b, c, 0, 0.75, -0.16, 0.1);
  b.box(0.04, 0.5, 0.025, c.metal, 0.22, 0, -0.2);
  b.box(0.05, 0.34, 0.025, c.metal, 0, 0.72, -0.2);
  b.box(0.46, 0.4, 0.02, c.metal, 0, 1.02, -0.2, { r: 0.008 });
  b.box(0.42, 0.36, 0.01, '#c8e0ea', 0, 1.04, -0.19);
  b.box(0.016, 0.32, 0.016, c.metal, 0.22, 0.5, -0.2);
  b.box(0.016, 0.016, 0.15, c.metal, 0.22, 0.72, -0.13);
  b.box(0.1, 0.22, 0.02, c.accentSoft, 0.22, 0.5, -0.06);
};

export const washer: PropBuild = ({ b, c }) => {
  const white = c.ceramic;
  b.box(0.7, 0.04, 0.66, c.dark, 0, 0, 0);
  b.box(0.72, 0.86, 0.68, white, 0, 0.04, 0, { r: 0.025 });
  b.box(0.7, 0.14, 0.012, '#dfe3e7', 0, 0.74, 0.343);
  b.box(0.2, 0.09, 0.016, '#c9ced4', -0.22, 0.765, 0.347);
  b.box(0.14, 0.05, 0.006, '#1f2730', 0.08, 0.785, 0.35);
  b.box(0.08, 0.018, 0.004, '#7fe0a0', 0.08, 0.8, 0.354, { glow: true });
  b.cyl(0.042, 0.042, 0.022, c.metal, 0.26, 0.81, 0.352, { rx: Math.PI / 2, seg: 14 });
  b.cyl(0.27, 0.27, 0.022, '#d2d6db', 0, 0.38, 0.35, { rx: Math.PI / 2, seg: 24 });
  b.ring(0.235, 0.022, c.metal, 0, 0.38, 0.362, { rx: 0, seg: 24 });
  b.cyl(0.215, 0.215, 0.012, '#27323b', 0, 0.38, 0.36, { rx: Math.PI / 2, seg: 22 });
  b.sphere(0.13, c.accentSoft, -0.03, 0.31, 0.32, { sz: 0.35, seg: 12 });
  b.sphere(0.09, c.fabric, 0.07, 0.33, 0.325, { sz: 0.35, seg: 10 });
  b.box(0.05, 0.1, 0.03, c.metal, 0.24, 0.33, 0.37, { r: 0.008 });
  b.box(0.12, 0.2, 0.08, c.accent, 0.2, 0.9, -0.12, { r: 0.018 });
  b.cyl(0.024, 0.024, 0.04, c.cream, 0.18, 1.1, -0.12, { seg: 8 });
};

export const laundryBasket: PropBuild = ({ b, c, rng }) => {
  const rattan = '#c9a877';
  const dark = '#a98a5c';
  b.lathe([[0, 0], [0.2, 0], [0.26, 0.48]], rattan, 0, 0, 0, { seg: 14 });
  for (let i = 0; i < 6; i++) b.ring(0.205 + i * 0.011, 0.012, i % 2 ? dark : '#d8bb8c', 0, 0.05 + i * 0.08, 0, { seg: 16 });
  b.ring(0.265, 0.018, dark, 0, 0.48, 0, { seg: 18 });
  for (const side of [-1, 1]) b.ring(0.05, 0.009, dark, side * 0.27, 0.43, 0, { rx: 0, ry: Math.PI / 2, seg: 10 });
  b.sphere(0.2, pick(rng, [c.accentSoft, c.cream, c.fabric]), 0, 0.5, 0, { sy: 0.65, seg: 12 });
  b.sphere(0.12, pick(rng, [c.accent, c.fabricAlt]), 0.09, 0.57, 0.07, { sy: 0.7, seg: 10 });
  b.box(0.14, 0.24, 0.012, c.fabricAlt, 0.14, 0.32, 0.21, { rx: 0.2 });
};

export const dryingRack: PropBuild = ({ b, c }) => {
  const steel = '#cfd3d8';
  for (const x of [-0.55, 0.55]) {
    for (const side of [-1, 1]) b.cyl(0.011, 0.011, 1.05, steel, x, 0.04, side * 0.09, { rx: side * 0.34, seg: 6 });
    b.box(0.03, 0.02, 0.5, steel, x, 0, 0);
  }
  for (const z of [-0.16, -0.08, 0, 0.08, 0.16]) b.cyl(0.009, 0.009, 1.1, steel, 0, 0.5, z, { rz: Math.PI / 2, seg: 6, sy: 1 });
  const cloth = (x: number, z: number, w: number, h: number, color: string) => {
    b.box(w, h, 0.01, color, x, 1.04 - h, z);
    b.box(w, 0.012, 0.03, color, x, 1.03, z);
  };
  b.box(1.1, 0.016, 0.016, steel, 0, 1.03, 0.16);
  b.box(1.1, 0.016, 0.016, steel, 0, 1.03, -0.16);
  cloth(-0.26, 0.16, 0.36, 0.5, c.accentSoft);
  cloth(0.24, 0.16, 0.28, 0.36, c.cream);
  cloth(0.05, -0.16, 0.5, 0.6, c.fabricAlt);
  for (const x of [-0.4, -0.12, 0.34]) b.box(0.016, 0.03, 0.02, c.accent, x, 1.04, 0.16);
};
