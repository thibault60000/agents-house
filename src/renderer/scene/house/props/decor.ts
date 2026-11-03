import { pick, range } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import { clockHands } from './fx';
import type { PropBuild } from './types';

export function pot(b: GeoBuilder, color: string, x: number, z: number, radius: number, h: number): void {
  b.cyl(radius * 0.96, radius * 0.9, 0.025, color, x, 0, z, { seg: 14 });
  b.lathe([[0, 0], [radius * 0.72, 0], [radius * 0.98, h * 0.82], [radius, h * 0.84], [radius * 1.04, h], [radius * 0.92, h], [radius * 0.9, h * 0.92], [0, h * 0.92]], color, x, 0.02, z, { seg: 14 });
  b.cyl(radius * 0.9, radius * 0.9, 0.012, '#3b2a20', x, h * 0.92 + 0.012, z, { seg: 12 });
}

export function blade(b: GeoBuilder, color: string, x: number, y: number, z: number, angle: number, length: number, width: number, tilt: number): void {
  const droop = tilt + 0.75;
  const l1 = length * 0.55;
  const l2 = length * 0.5;
  b.at(x, z, angle, () => {
    b.box(width, 0.012, l1, color, 0, y + (Math.cos(tilt) * l1) / 2, (Math.sin(tilt) * l1) / 2, { rx: tilt - Math.PI / 2 });
    b.box(width * 0.6, 0.01, l2, color, 0, y + Math.cos(tilt) * l1 + (Math.cos(droop) * l2) / 2, Math.sin(tilt) * l1 + (Math.sin(droop) * l2) / 2, { rx: droop - Math.PI / 2 });
  });
}

export const plant: PropBuild = ({ b, c, rng }) => {
  const variant = Math.floor(rng() * 3);
  pot(b, c.terracotta, 0, 0, 0.24, 0.38);
  if (variant === 0) {
    b.cyl(0.02, 0.03, 0.42, c.woodDark, 0, 0.38, 0, { seg: 7 });
    b.blob(0.3, c.leaf, 0, 0.92, 0, { sy: 0.9 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      b.blob(0.14 + rng() * 0.05, i % 2 ? c.leafDark : c.leaf, Math.cos(a) * 0.22, 0.86 + rng() * 0.2, Math.sin(a) * 0.22);
    }
  } else if (variant === 1) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rng();
      blade(b, i % 2 ? c.leaf : c.leafDark, Math.sin(a) * 0.04, 0.42, Math.cos(a) * 0.04, a, 0.5 + rng() * 0.22, 0.13, 0.32 + rng() * 0.3);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const r = 0.05 + (i % 3) * 0.05;
      const h = 0.55 + rng() * 0.4;
      b.box(0.075, h, 0.018, i % 2 ? c.leaf : c.leafDark, Math.sin(a) * r, 0.42, Math.cos(a) * r, { ry: a + 1.57, rx: Math.cos(a) * 0.06, rz: Math.sin(a) * 0.06 });
    }
  }
};

export const tallPlant: PropBuild = ({ b, c, rng }) => {
  pot(b, c.terracotta === '#2b2b2e' ? c.ceramic : c.terracotta, 0, 0, 0.32, 0.5);
  b.cyl(0.035, 0.06, 1.15, c.woodDark, 0, 0.5, 0, { seg: 8 });
  for (const [dx, dz, h] of [[0.24, 0.1, 1.15], [-0.22, -0.12, 1.3]] as const) {
    b.cyl(0.016, 0.024, 0.5, c.woodDark, dx * 0.5, h - 0.05, dz * 0.5, { rz: -dx * 1.8, rx: dz * 1.8, seg: 6 });
  }
  b.blob(0.42, c.leaf, 0, 1.9, 0, { sy: 0.92 });
  b.blob(0.3, c.leafDark, 0.28, 1.62, 0.12);
  b.blob(0.28, c.leaf, -0.28, 1.72, -0.12);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.blob(0.13, i % 2 ? c.leaf : c.leafDark, Math.cos(a) * 0.32, 1.72 + rng() * 0.42, Math.sin(a) * 0.32);
  }
};

export const slimPlant: PropBuild = ({ b, c }) => {
  pot(b, c.terracotta, 0, 0, 0.17, 0.3);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    b.capsule(0.024, 0.7, i % 2 ? c.leaf : c.leafDark, Math.cos(a) * 0.06, 0.72, Math.sin(a) * 0.06, { seg: 6 });
  }
  b.capsule(0.05, 0.7, c.leafDark, 0, 0.72, 0, { seg: 8 });
  b.capsule(0.032, 0.12, c.leafDark, 0.12, 0.62, 0, { rz: Math.PI / 2, seg: 6 });
  b.capsule(0.032, 0.22, c.leafDark, 0.19, 0.76, 0, { seg: 6 });
};

export const rug: PropBuild = ({ b, c, rng }) => {
  const w = 3 + rng() * 1.0;
  const d = 2.1 + rng() * 0.7;
  b.box(w, 0.016, d, c.fabric, 0, 0, 0);
  b.box(w - 0.24, 0.02, d - 0.24, c.accentSoft, 0, 0, 0);
  b.box(w - 0.44, 0.024, d - 0.44, c.fabricAlt, 0, 0, 0);
  const bands = 5;
  for (let i = 0; i < bands; i++) {
    const x = -(w - 0.9) / 2 + (i * (w - 0.9)) / (bands - 1);
    b.box(0.09, 0.027, d - 0.6, c.accentSoft, x, 0, 0);
  }
  const fringes = Math.round(d / 0.09);
  for (const side of [-1, 1]) {
    for (let i = 0; i < fringes; i++) b.box(0.09, 0.006, 0.03, c.cream, (side * (w + 0.09)) / 2, 0, -d / 2 + (i + 0.5) * (d / fringes));
  }
};

export const roundRug: PropBuild = ({ b, c }) => {
  b.cyl(1.38, 1.38, 0.016, c.fabric, 0, 0, 0, { seg: 32 });
  b.cyl(1.2, 1.2, 0.02, c.accentSoft, 0, 0, 0, { seg: 32 });
  b.cyl(1.02, 1.02, 0.024, c.fabricAlt, 0, 0, 0, { seg: 32 });
  b.cyl(0.62, 0.62, 0.028, c.accentSoft, 0, 0, 0, { seg: 28 });
  b.cyl(0.42, 0.42, 0.032, c.fabric, 0, 0, 0, { seg: 24 });
};

export const floorLamp: PropBuild = ({ b, c }) => {
  for (const a of [0.5, 2.6, 4.7]) {
    b.cyl(0.014, 0.022, 1.16, c.woodDark, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, { rx: -Math.sin(a) * 0.27, rz: Math.cos(a) * 0.27, seg: 7 });
  }
  b.cyl(0.03, 0.03, 0.05, c.dark, 0, 1.12, 0, { seg: 10 });
  b.cyl(0.012, 0.012, 0.32, c.dark, 0, 1.16, 0, { seg: 7 });
  b.lathe([[0.26, 0], [0.17, 0.32], [0.04, 0.33], [0.04, 0.32]], '#ffdf9e', 0, 1.3, 0, { glow: true, seg: 18 });
  b.ring(0.26, 0.007, c.cream, 0, 1.3, 0);
  b.ring(0.17, 0.006, c.cream, 0, 1.62, 0);
  b.cyl(0.008, 0.008, 1.15, c.dark, 0.05, 0.02, -0.03, { rz: 0.06, seg: 4 });
};

export const tableLamp: PropBuild = ({ b, c }) => {
  b.lathe([[0, 0], [0.08, 0], [0.09, 0.012], [0.05, 0.03], [0.075, 0.09], [0.04, 0.17], [0.014, 0.2], [0.014, 0.26]], c.accentDark, 0, 0, 0, { seg: 12 });
  b.lathe([[0.135, 0], [0.085, 0.15], [0.02, 0.155]], '#ffdf9e', 0, 0.21, 0, { glow: true, seg: 14 });
  b.sphere(0.012, c.metal, 0, 0.385, 0, { seg: 6 });
};

export const chandelier: PropBuild = ({ b, c }) => {
  b.cyl(0.009, 0.009, 0.5, c.dark, 0, 2.45, 0, { seg: 6 });
  b.lathe([[0, 0], [0.06, 0.02], [0.13, 0.1], [0.05, 0.14], [0.014, 0.18]], c.dark, 0, 2.28, 0, { seg: 12 });
  b.ring(0.45, 0.012, c.dark, 0, 2.3, 0, { seg: 28 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a);
    const z = Math.sin(a);
    b.box(0.45, 0.016, 0.016, c.dark, x * 0.225, 2.32, z * 0.225, { ry: -a });
    b.cyl(0.03, 0.022, 0.05, c.dark, x * 0.45, 2.29, z * 0.45, { seg: 8 });
    b.sphere(0.055, '#ffe7b0', x * 0.45, 2.37, z * 0.45, { glow: true, seg: 10 });
  }
};

export const bed: PropBuild = ({ b, c, rng }) => {
  b.box(1.76, 0.2, 2.16, c.woodDark, 0, 0.14, 0.04, { r: 0.018 });
  for (const x of [-0.8, 0.8]) for (const z of [-0.95, 1.04]) b.cyl(0.03, 0.022, 0.14, c.dark, x, 0, z, { seg: 8 });
  b.box(1.84, 1.04, 0.09, c.fabric, 0, 0.06, -1.12, { r: 0.04 });
  for (const x of [-0.6, 0, 0.6]) b.box(0.56, 0.72, 0.02, c.fabricAlt, x, 0.28, -1.066, { r: 0.008 });
  b.box(1.68, 0.22, 2.04, c.cream, 0, 0.32, 0.03, { r: 0.07, soft: true });
  b.box(1.72, 0.1, 1.46, c.fabric, 0, 0.5, 0.35, { r: 0.045, soft: true });
  b.box(1.73, 0.03, 0.26, c.cream, 0, 0.58, -0.2, { r: 0.012 });
  for (const side of [-1, 1]) b.box(0.018, 0.2, 1.42, c.fabric, side * 0.855, 0.32, 0.36);
  b.box(1.7, 0.2, 0.018, c.fabric, 0, 0.32, 1.07);
  for (const x of [-0.42, 0.42]) {
    b.box(0.66, 0.15, 0.42, c.ceramic, x, 0.54, -0.72, { r: 0.07, soft: true, rx: 0.12 });
  }
  b.box(0.42, 0.13, 0.3, pick(rng, [c.accent, c.accentSoft]), 0.05, 0.56, -0.5, { r: 0.05, soft: true, rx: 0.3 });
  b.box(1.72, 0.022, 0.42, c.accentSoft, 0, 0.6, 0.72, { r: 0.008 });
};

export const globe: PropBuild = ({ b, c }) => {
  b.lathe([[0, 0], [0.16, 0], [0.17, 0.02], [0.05, 0.05], [0.025, 0.1], [0.022, 0.62], [0.05, 0.68]], c.woodDark, 0, 0, 0, { seg: 12 });
  for (const a of [0.5, 2.6, 4.7]) b.box(0.26, 0.03, 0.05, c.wood, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2, { ry: -a, r: 0.01 });
  const cy = 1.0;
  b.ring(0.31, 0.012, '#c9a13b', 0, cy, 0, { rx: 0, rz: 0.4, seg: 28 });
  b.sphere(0.27, '#5a93b5', 0, cy, 0, { seg: 22 });
  for (const [dx, dy, dz, r] of [[0.14, 0.1, 0.19, 0.11], [-0.17, 0.02, 0.17, 0.09], [0.02, -0.14, 0.21, 0.08], [-0.05, 0.19, 0.14, 0.07], [0.22, -0.06, 0.08, 0.07]] as const) {
    b.sphere(r, '#7ba05b', dx, cy + dy, dz, { sz: 0.55, ry: Math.atan2(dx, dz), rx: -dy * 2, seg: 10 });
  }
  b.cyl(0.03, 0.03, 0.04, '#c9a13b', -0.12, cy + 0.28, 0, { rz: 0.4, seg: 8 });
};

export const easel: PropBuild = ({ b, c, rng }) => {
  b.box(0.05, 1.75, 0.04, c.wood, -0.34, 0, 0.14, { rz: -0.17, rx: -0.09 });
  b.box(0.05, 1.75, 0.04, c.wood, 0.34, 0, 0.14, { rz: 0.17, rx: -0.09 });
  b.box(0.05, 1.68, 0.04, c.wood, 0, 0, -0.34, { rx: 0.24 });
  b.box(0.05, 0.04, 0.46, c.woodDark, 0, 0.6, -0.1);
  b.box(0.66, 0.035, 0.05, c.wood, 0, 1.6, 0.03);
  b.box(0.96, 0.04, 0.14, c.wood, 0, 0.72, 0.17);
  b.box(0.9, 0.05, 0.02, c.woodDark, 0, 0.76, 0.235);
  b.box(0.82, 0.86, 0.025, c.woodLight, 0, 0.76, 0.12);
  b.box(0.78, 0.82, 0.008, c.cream, 0, 0.78, 0.136);
  b.box(0.78, 0.3, 0.006, c.accentSoft, 0, 0.78, 0.143);
  b.sphere(0.12, pick(rng, ['#ffd166', '#ff8a5c']), 0.17, 1.36, 0.142, { sz: 0.05, seg: 14 });
  b.box(0.42, 0.14, 0.006, c.accent, -0.12, 1.03, 0.146, { rz: 0.1 });
  b.box(0.3, 0.1, 0.006, c.accentDark, 0.12, 0.88, 0.149, { rz: -0.12 });
  b.cyl(0.1, 0.1, 0.012, c.woodLight, -0.26, 0.76, 0.17, { seg: 12, sz: 0.5 });
  for (const [dx, color] of [[-0.05, '#e8604c'], [0, '#6cc6ff'], [0.05, '#ffd166']] as const) b.sphere(0.012, color, -0.26 + dx, 0.775, 0.17, { seg: 6 });
  for (let i = 0; i < 3; i++) b.cyl(0.008, 0.008, 0.26, c.woodDark, 0.2 + i * 0.05, 0.76, 0.17, { rz: Math.PI / 2 + range(rng, -0.1, 0.1), seg: 5 });
};

export const planter: PropBuild = ({ b, c, rng }) => {
  b.box(1.5, 0.05, 0.4, c.woodDark, 0, 0, 0);
  for (const z of [-0.19, 0.19]) for (let i = 0; i < 3; i++) b.box(1.5, 0.12, 0.02, c.wood, 0, 0.06 + i * 0.13, z);
  for (const x of [-0.74, 0.74]) b.box(0.02, 0.38, 0.38, c.wood, x, 0.05, 0);
  for (const x of [-0.7, 0, 0.7]) for (const z of [-0.2, 0.2]) b.box(0.05, 0.45, 0.03, c.woodDark, x, 0, z);
  b.box(1.42, 0.02, 0.34, '#3b2a20', 0, 0.42, 0);
  for (let i = 0; i < 9; i++) {
    const x = -0.62 + i * 0.155;
    const z = range(rng, -0.1, 0.1);
    const h = 0.16 + rng() * 0.2;
    b.blob(0.1 + rng() * 0.05, i % 2 ? c.leaf : c.leafDark, x, 0.53 + rng() * 0.05, z);
    if (i % 2 === 0) {
      const color = pick(rng, ['#ff6fa8', '#ffd166', '#ffffff', '#b48cff', '#ff8a5c']);
      b.cyl(0.008, 0.009, h + 0.12, c.leafDark, x, 0.44, z + 0.02, { seg: 5 });
      b.sphere(0.018, '#ffd166', x, 0.56 + h, z + 0.02, { seg: 6 });
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        b.sphere(0.024, color, x + Math.cos(a) * 0.03, 0.56 + h, z + 0.02 + Math.sin(a) * 0.03, { sy: 0.45, seg: 6 });
      }
    }
  }
};

export const pictureFrame: PropBuild = ({ b, c, rng }) => {
  const w = 0.62 + rng() * 0.36;
  const h = 0.48 + rng() * 0.12;
  const y = 0.56;
  b.box(w, h, 0.03, pick(rng, [c.woodDark, c.dark, c.woodLight]), 0, y, 0, { r: 0.006 });
  b.box(w - 0.06, h - 0.06, 0.008, c.cream, 0, y + 0.03, 0.016);
  const iw = w - 0.2;
  const ih = h - 0.2;
  const iy = y + 0.1;
  b.box(iw, ih, 0.006, c.accentSoft, 0, iy, 0.02);
  b.box(iw - 0.004, ih * 0.38, 0.007, c.accent, 0, iy + 0.002, 0.021);
  b.sphere(Math.min(iw, ih) * 0.17, pick(rng, ['#ffd166', '#ff8a5c', '#ffffff']), iw * 0.22, iy + ih * 0.68, 0.022, { sz: 0.05, seg: 12 });
  b.box(iw * 0.45, ih * 0.22, 0.008, c.accentDark, -iw * 0.15, iy + ih * 0.22, 0.022, { rz: 0.2 });
};

export const wallClock: PropBuild = ({ b, c, fx }) => {
  b.box(0.54, 0.34, 0.34, c.woodDark, 0, 0, 0, { r: 0.012 });
  b.box(0.42, 0.9, 0.26, c.wood, 0, 0.34, 0, { r: 0.01 });
  b.box(0.28, 0.72, 0.012, '#3a2c20', 0, 0.42, 0.13);
  b.cyl(0.008, 0.008, 0.46, '#c9a13b', 0, 0.56, 0.138, { seg: 6 });
  b.cyl(0.05, 0.05, 0.012, '#c9a13b', 0, 0.52, 0.14, { rx: Math.PI / 2, seg: 14 });
  for (const x of [-0.08, 0.08]) b.cyl(0.018, 0.018, 0.18, c.metal, x, 0.82, 0.136, { seg: 8 });
  b.box(0.54, 0.46, 0.32, c.woodDark, 0, 1.24, 0, { r: 0.015 });
  b.box(0.58, 0.05, 0.36, c.wood, 0, 1.7, 0, { r: 0.012 });
  b.lathe([[0, 0], [0.06, 0], [0.012, 0.09]], '#c9a13b', 0, 1.75, 0, { seg: 8 });
  b.cyl(0.2, 0.2, 0.02, '#c9a13b', 0, 1.36, 0.16, { rx: Math.PI / 2, seg: 22 });
  b.cyl(0.18, 0.18, 0.022, c.cream, 0, 1.36, 0.163, { rx: Math.PI / 2, seg: 22 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.box(0.01, 0.024, 0.004, c.dark, Math.sin(a) * 0.15, 1.46 + 0.0 + Math.cos(a) * 0.15 - 0.012, 0.176, { rz: -a });
  }
  clockHands(b, fx, 0, 1.47, 0.178, 0.15);
};

export const coatRack: PropBuild = ({ b, c, rng }) => {
  for (const a of [0.2, 2.3, 4.4]) b.box(0.32, 0.03, 0.05, c.woodDark, Math.cos(a) * 0.15, 0.015, Math.sin(a) * 0.15, { ry: -a, r: 0.012 });
  b.lathe([[0.05, 0], [0.03, 0.05], [0.024, 0.2], [0.02, 1.6], [0.03, 1.66], [0.016, 1.72], [0, 1.74]], c.wood, 0, 0.03, 0, { seg: 10 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.capsule(0.009, 0.12, c.woodDark, Math.cos(a) * 0.06, 1.55, Math.sin(a) * 0.06, { rz: -Math.cos(a) * 1.0, rx: Math.sin(a) * 1.0, seg: 6 });
  }
  const coat = pick(rng, [c.fabric, '#3f6c8f', '#6b4a35', '#5a6470']);
  const cx = 0.17;
  b.box(0.3, 0.46, 0.13, coat, cx, 0.98, 0.04, { r: 0.05, soft: true });
  b.box(0.34, 0.48, 0.11, coat, cx, 0.54, 0.04, { r: 0.04, soft: true });
  b.sphere(0.13, coat, cx, 1.4, 0.04, { sy: 0.42, sz: 0.5, seg: 10 });
  for (const side of [-1, 1]) b.capsule(0.042, 0.56, coat, cx + side * 0.19, 1.02, 0.04, { rz: side * 0.1, seg: 8 });
  b.box(0.11, 0.09, 0.09, c.accentSoft, cx, 1.42, 0.066, { r: 0.03 });
  b.box(0.018, 0.8, 0.012, c.dark, cx, 0.56, 0.11);
  b.box(0.1, 0.09, 0.008, c.dark, cx + 0.09, 0.62, 0.104);
  b.box(0.1, 0.52, 0.03, c.accent, -0.11, 1.02, -0.03, { r: 0.012, rz: 0.08 });
  for (let i = 0; i < 4; i++) b.box(0.012, 0.04, 0.012, c.accent, -0.15 + i * 0.03, 0.98, -0.03);
  b.lathe([[0.14, 0], [0.1, 0.01], [0.085, 0.09], [0, 0.11]], c.woodDark, 0, 1.76, 0, { seg: 14 });
};
