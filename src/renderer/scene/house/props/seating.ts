import { pick } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import type { PropBuild } from './types';

export function taperedLeg(b: GeoBuilder, color: string, x: number, z: number, h: number, splay = 0.08, y = 0): void {
  b.cyl(0.032, 0.018, h, color, x, y, z, { rz: Math.sign(x) * splay, rx: -Math.sign(z) * splay });
}

export const sofa: PropBuild = ({ b, c, rng }) => {
  const f = c.fabric;
  b.box(2.34, 0.14, 0.94, f, 0, 0.14, 0, { r: 0.04 });
  for (const x of [-1.05, 1.05]) for (const z of [-0.38, 0.38]) taperedLeg(b, c.woodDark, x, z, 0.14);
  b.box(2.34, 0.54, 0.2, f, 0, 0.26, -0.39, { r: 0.08 });
  for (const x of [-1.16, 1.16]) {
    b.box(0.2, 0.34, 0.92, f, x, 0.24, 0.01, { r: 0.06 });
    b.capsule(0.11, 0.78, f, x, 0.59, 0.01, { rx: Math.PI / 2 });
  }
  for (const x of [-0.71, 0, 0.71]) {
    b.box(0.69, 0.18, 0.74, c.fabricAlt, x, 0.27, 0.08, { r: 0.05, soft: true });
    b.box(0.67, 0.4, 0.17, c.fabricAlt, x, 0.45, -0.24, { r: 0.07, soft: true, rx: -0.14 });
  }
  b.box(0.38, 0.36, 0.11, c.accent, -0.82, 0.47, -0.04, { r: 0.05, soft: true, rx: -0.3, rz: 0.12 });
  b.box(0.34, 0.32, 0.1, pick(rng, [c.cream, c.accentSoft]), 0.84, 0.47, -0.03, { r: 0.05, soft: true, rx: -0.3, rz: -0.14 });
  b.box(0.46, 0.018, 0.72, c.accentSoft, 0.36, 0.452, 0.1);
  b.box(0.46, 0.17, 0.018, c.accentSoft, 0.36, 0.3, 0.46);
  for (let i = 0; i < 7; i++) b.box(0.012, 0.05, 0.012, c.accentSoft, 0.17 + i * 0.063, 0.25, 0.46);
};

export const armchair: PropBuild = ({ b, c }) => {
  const f = c.fabric;
  b.box(0.82, 0.12, 0.76, f, 0, 0.17, 0, { r: 0.03 });
  for (const x of [-0.34, 0.34]) for (const z of [-0.3, 0.3]) taperedLeg(b, c.woodDark, x, z, 0.17, 0.12);
  b.box(0.78, 0.58, 0.16, f, 0, 0.27, -0.33, { r: 0.07, rx: -0.1 });
  for (const x of [-0.44, 0.44]) {
    b.box(0.13, 0.24, 0.74, f, x, 0.23, 0.01, { r: 0.04 });
    b.box(0.15, 0.04, 0.76, c.wood, x, 0.47, 0.01, { r: 0.015 });
  }
  b.box(0.68, 0.14, 0.62, c.fabricAlt, 0, 0.29, 0.06, { r: 0.05, soft: true });
  b.box(0.62, 0.36, 0.13, c.fabricAlt, 0, 0.44, -0.2, { r: 0.06, soft: true, rx: -0.16 });
  b.box(0.3, 0.26, 0.09, c.accent, 0.1, 0.48, -0.07, { r: 0.04, soft: true, rx: -0.3, rz: -0.14 });
};

export const stool: PropBuild = ({ b, c }) => {
  b.lathe([[0, 0], [0.17, 0], [0.19, 0.03], [0.18, 0.055], [0.12, 0.07], [0, 0.07]], c.fabric, 0, 0.6, 0, { seg: 18 });
  b.cyl(0.14, 0.14, 0.018, c.wood, 0, 0.585, 0, { seg: 18 });
  for (const a of [0.5, 2.6, 4.7]) {
    b.cyl(0.018, 0.024, 0.6, c.woodDark, Math.cos(a) * 0.145, 0, Math.sin(a) * 0.145, { rx: -Math.sin(a) * 0.13, rz: Math.cos(a) * 0.13 });
  }
  b.ring(0.13, 0.009, c.woodDark, 0, 0.24, 0);
};

export const wickerChair: PropBuild = ({ b, c }) => {
  const rattan = '#c9a877';
  const dark = '#a98a5c';
  b.lathe([[0, 0], [0.14, 0.01], [0.17, 0.04], [0.06, 0.12], [0.05, 0.2]], c.woodDark, 0, 0, 0, { seg: 16 });
  for (let i = 0; i < 6; i++) {
    const t = i / 5;
    b.ring(0.2 + t * 0.26, 0.02, i % 2 ? rattan : dark, 0, 0.22 + i * 0.05, 0);
  }
  for (let i = -6; i <= 6; i++) {
    const a = (i / 6) * 1.15;
    b.capsule(0.018, 0.55, i % 2 ? rattan : dark, Math.sin(a) * 0.46, 0.72, -Math.cos(a) * 0.46, { rx: -Math.cos(a) * 0.2, rz: -Math.sin(a) * 0.2 });
  }
  for (let k = 0; k < 3; k++) {
    for (let i = -6; i < 6; i++) {
      const a = ((i + 0.5) / 6) * 1.15;
      b.box(0.24, 0.022, 0.022, dark, Math.sin(a) * (0.47 + k * 0.03), 0.6 + k * 0.17, -Math.cos(a) * (0.47 + k * 0.03), { ry: -a });
    }
  }
  b.cyl(0.38, 0.38, 0.09, c.fabricAlt, 0, 0.47, 0.01, { seg: 18 });
  b.box(0.42, 0.28, 0.1, c.accent, 0, 0.6, -0.26, { r: 0.04, soft: true, rx: -0.2 });
};

export const beanbag: PropBuild = ({ b, c, rng }) => {
  const color = pick(rng, [c.fabric, c.accent, c.fabricAlt]);
  b.sphere(0.5, color, 0, 0.3, 0.04, { sy: 0.6, seg: 20 });
  b.sphere(0.36, color, 0, 0.5, -0.17, { sx: 1.1, sy: 0.92, sz: 0.85, seg: 18 });
  b.ring(0.47, 0.007, c.accentDark, 0, 0.3, 0.04);
};
