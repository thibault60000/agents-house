import { pick, range, type Rng } from '@shared/random';
import type { GeoBuilder } from '../../builder';
import { blend } from './fx';
import type { PropBuild } from './types';

function slatCrate(b: GeoBuilder, color: string, dark: string, x: number, y: number, z: number, w: number, h: number, d: number, ry = 0): void {
  b.at(x, z, ry, () => {
    b.box(w - 0.02, 0.018, d - 0.02, dark, 0, 0.004, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(0.035, h, 0.035, dark, (sx * (w - 0.035)) / 2, 0, (sz * (d - 0.035)) / 2);
    const slats = Math.max(2, Math.floor(h / 0.09));
    for (let i = 0; i < slats; i++) {
      const sy = 0.03 + i * ((h - 0.05) / slats);
      const sh = ((h - 0.05) / slats) * 0.72;
      for (const side of [-1, 1]) {
        b.box(w + 0.008, sh, 0.012, color, 0, sy, (side * d) / 2);
        b.box(0.012, sh, d + 0.008, color, (side * w) / 2, sy, 0);
      }
    }
  }, y);
}

export const workbench: PropBuild = ({ b, c, rng }) => {
  const boardTone = blend(c.woodLight, c.wood, 0.35);
  for (let i = 0; i < 6; i++) b.box(2.2 / 6, 0.08, 0.8, i % 2 ? boardTone : c.woodLight, -1.1 + (i + 0.5) * (2.2 / 6), 0.84, 0);
  for (const x of [-1.0, 1.0]) {
    for (const z of [-0.33, 0.33]) b.box(0.09, 0.84, 0.09, c.woodDark, x, 0, z);
    b.box(0.06, 0.06, 0.58, c.woodDark, x, 0.24, 0);
  }
  b.box(1.96, 0.06, 0.05, c.woodDark, 0, 0.72, -0.33);
  b.box(1.96, 0.035, 0.62, c.wood, 0, 0.27, 0);
  for (const x of [0.32, 0.72]) {
    b.box(0.38, 0.16, 0.5, c.woodDark, x, 0.68, 0.1);
    b.box(0.36, 0.14, 0.012, c.woodLight, x, 0.69, 0.356);
    b.box(0.1, 0.018, 0.018, c.metal, x, 0.75, 0.368);
  }
  b.box(0.52, 0.2, 0.26, '#c44536', -0.5, 0.305, 0, { r: 0.012 });
  b.box(0.53, 0.05, 0.27, '#a83a2d', -0.5, 0.5, 0, { r: 0.012 });
  b.box(0.24, 0.02, 0.03, c.dark, -0.5, 0.56, 0);
  for (const x of [-0.7, -0.3]) b.box(0.05, 0.05, 0.012, c.metal, x, 0.44, 0.135);
  b.box(0.2, 0.06, 0.16, '#3f6c8f', -0.92, 0.92, 0.28, { r: 0.008 });
  b.box(0.2, 0.11, 0.05, '#3f6c8f', -0.92, 0.98, 0.34);
  b.box(0.2, 0.11, 0.05, '#3f6c8f', -0.92, 0.98, 0.22);
  b.cyl(0.012, 0.012, 0.14, c.metal, -0.92, 0.97, 0.38, { rx: Math.PI / 2, seg: 6 });
  const ry = range(rng, -0.5, 0.5);
  b.at(0.1, 0.12, ry, () => {
    b.cyl(0.015, 0.018, 0.34, c.woodDark, 0, 0.775, 0, { rx: Math.PI / 2, seg: 8 });
    b.box(0.13, 0.05, 0.05, c.metal, 0, 0.92, -0.17, { r: 0.008 });
  });
  b.cyl(0.05, 0.05, 0.07, c.metal, 0.62, 0.92, -0.18, { seg: 10 });
  b.cyl(0.04, 0.04, 0.09, c.accentSoft, 0.76, 0.92, -0.2, { seg: 10 });
  b.cyl(0.08, 0.1, 0.02, c.dark, -0.15, 0.92, -0.28, { seg: 10 });
  b.cyl(0.01, 0.01, 0.42, c.dark, -0.15, 0.94, -0.28, { seg: 6, rz: 0.12 });
  b.lathe([[0.1, 0], [0.04, 0.09], [0.02, 0.1]], '#e9b44c', -0.2, 1.3, -0.28, { seg: 12, rz: 0.5 });
  b.sphere(0.022, c.dark, -0.2, 1.36, -0.28, { seg: 8 });
};

export const pegboard: PropBuild = ({ b, c }) => {
  for (const x of [-0.76, 0.76]) b.box(0.05, 1.62, 0.04, c.woodDark, x, 0, -0.02);
  b.box(1.6, 1.0, 0.025, c.woodLight, 0, 0.6, 0);
  for (let i = 0; i < 14; i++) for (let j = 0; j < 9; j++) b.box(0.012, 0.012, 0.004, c.woodDark, -0.72 + i * 0.11, 0.66 + j * 0.11, 0.014);
  b.box(0.03, 0.42, 0.018, c.wood, -0.6, 0.86, 0.022);
  b.box(0.16, 0.06, 0.03, c.dark, -0.6, 1.27, 0.022, { r: 0.01 });
  b.box(0.028, 0.34, 0.014, c.metal, -0.36, 0.95, 0.022);
  b.ring(0.035, 0.014, c.metal, -0.36, 1.31, 0.024, { rx: 0, seg: 10 });
  b.box(0.016, 0.22, 0.016, c.metal, -0.16, 1.04, 0.024);
  b.capsule(0.022, 0.12, '#c44536', -0.16, 1.32, 0.024, { seg: 8 });
  b.capsule(0.014, 0.12, c.dark, 0.0, 1.04, 0.022, { rz: 0.16, seg: 6 });
  b.capsule(0.014, 0.12, c.dark, 0.05, 1.04, 0.022, { rz: -0.16, seg: 6 });
  b.box(0.05, 0.1, 0.014, c.metal, 0.03, 1.17, 0.022);
  b.box(0.36, 0.09, 0.008, c.metal, 0.38, 1.262, 0.022);
  b.box(0.1, 0.11, 0.022, c.wood, 0.17, 1.25, 0.024, { r: 0.012 });
  b.cyl(0.055, 0.055, 0.035, '#e9b44c', 0.56, 0.86, 0.03, { rx: Math.PI / 2, seg: 12 });
  b.box(0.3, 0.12, 0.08, c.woodDark, 0.26, 0.72, 0.05);
};

export const crates: PropBuild = ({ b, c, rng }) => {
  const count = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const s = 0.5 + rng() * 0.12;
    const x = i === 2 ? 0 : (i - 0.5) * 0.62;
    const y = i === 2 ? 0.52 : 0;
    slatCrate(b, c.woodLight, c.wood, x, y, 0, s, s * 0.84, s, range(rng, -0.12, 0.12));
    b.box(s * 0.6, 0.012, s * 0.5, '#d9c493', x, y + s * 0.5, 0);
  }
};

export const barrel: PropBuild = ({ b, c }) => {
  const profile: [number, number][] = [[0.27, 0], [0.31, 0.12], [0.35, 0.28], [0.37, 0.4], [0.35, 0.52], [0.31, 0.68], [0.27, 0.8]];
  b.lathe([[0, 0], ...profile, [0.25, 0.8], [0.25, 0.77], [0, 0.77]], c.wood, 0, 0, 0, { seg: 18 });
  const jointTone = blend(c.wood, c.woodDark, 0.55);
  for (let i = 0; i < 12; i++) {
    b.at(0, 0, (i / 12) * Math.PI * 2, () => {
      b.box(0.016, 0.125, 0.012, jointTone, 0, 0.2775, 0.362, { rx: 0.165 });
      b.box(0.016, 0.125, 0.012, jointTone, 0, 0.3975, 0.362, { rx: -0.165 });
    });
  }
  for (const [y, r] of [[0.1, 0.3], [0.24, 0.345], [0.56, 0.345], [0.7, 0.3]] as const) b.ring(r, 0.012, c.dark, 0, y, 0, { seg: 22 });
  b.cyl(0.03, 0.03, 0.05, c.metal, 0, 0.18, 0.32, { rx: Math.PI / 2, seg: 8 });
  b.box(0.05, 0.03, 0.012, c.metal, 0, 0.21, 0.35);
};

export const jerrycans: PropBuild = ({ b, c }) => {
  for (const [x, color] of [[-0.21, '#c44536'], [0.21, '#3f7d5a']] as const) {
    b.box(0.36, 0.46, 0.17, color, x, 0, 0, { r: 0.03 });
    for (const rz of [0.65, -0.65]) b.box(0.42, 0.018, 0.008, color, x, 0.21, 0.088, { rz });
    b.box(0.3, 0.04, 0.05, color, x, 0.5, 0);
    for (const dx of [-0.1, 0, 0.1]) b.box(0.02, 0.08, 0.05, color, x + dx, 0.46, 0);
    b.cyl(0.032, 0.036, 0.05, c.metal, x + 0.13, 0.46, 0, { seg: 8, rz: -0.5 });
  }
};

export const car: PropBuild = ({ b, c }) => {
  const wheelRadius = 0.31;
  const wheelWidth = 0.24;
  const tire = '#1d1e22';
  const glass = '#25303a';

  b.box(3.7, 0.12, 1.62, tire, 0, 0.16, 0, { r: 0.04 });
  b.box(3.95, 0.5, 1.74, c.accent, 0, 0.24, 0, { r: 0.16 });
  b.box(0.022, 0.004, 1.5, c.accentDark, 0.95, 0.74, 0);
  b.box(0.022, 0.004, 1.5, c.accentDark, -1.4, 0.74, 0);

  b.box(2.08, 0.34, 1.58, glass, -0.2, 0.72, 0, { r: 0.08 });
  b.box(2.14, 0.13, 1.54, c.accent, -0.2, 1.04, 0, { r: 0.06 });
  for (const x of [-1.12, -0.2, 0.72]) for (const z of [-0.79, 0.79]) b.box(0.08, 0.335, 0.03, c.accent, x, 0.72, z);
  b.box(1.4, 0.015, 1.1, c.accentDark, -0.2, 1.165, 0, { r: 0.006 });
  for (const z of [-0.6, 0.6]) b.box(1.5, 0.025, 0.03, c.dark, -0.2, 1.18, z);
  for (const z of [-0.91, 0.91]) b.box(0.1, 0.07, 0.1, c.accent, 0.72, 0.72, z, { r: 0.02 });

  for (const x of [-1.22, 1.22]) {
    for (const z of [-0.82, 0.82]) {
      const outer = Math.sign(z);
      b.cyl(0.355, 0.355, 0.02, tire, x, 0.35, outer * 0.875, { rx: Math.PI / 2, seg: 20 });
      b.cyl(wheelRadius, wheelRadius, wheelWidth, tire, x, wheelRadius - wheelWidth / 2, z, { rx: Math.PI / 2, seg: 20 });
      b.cyl(0.17, 0.17, 0.02, '#c9ccd1', x, wheelRadius - 0.01, z + outer * (wheelWidth / 2 + 0.005), { rx: Math.PI / 2, seg: 16 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.box(0.03, 0.005, 0.012, '#8d9299', x + Math.cos(a) * 0.09, wheelRadius + Math.sin(a) * 0.09, z + outer * (wheelWidth / 2 + 0.018), { rz: a + Math.PI / 2 });
      }
      b.cyl(0.05, 0.05, 0.02, tire, x, wheelRadius - 0.01, z + outer * (wheelWidth / 2 + 0.015), { rx: Math.PI / 2, seg: 10 });
    }
  }

  for (const x of [-1.98, 1.98]) b.box(0.08, 0.13, 1.5, tire, x, 0.24, 0, { r: 0.03 });
  for (const z of [-0.62, 0.62]) {
    b.box(0.03, 0.12, 0.3, '#fff3c4', 1.985, 0.52, z, { glow: true, r: 0.01 });
    b.box(0.03, 0.1, 0.32, '#d8413a', -1.985, 0.54, z, { r: 0.01 });
  }
  b.box(0.03, 0.1, 0.64, tire, 1.985, 0.42, 0, { r: 0.01 });
  b.box(0.012, 0.06, 0.26, c.cream, 2.0, 0.27, 0);
  b.box(0.012, 0.06, 0.26, c.cream, -2.03, 0.27, 0);
  for (const z of [-0.875, 0.875]) {
    b.box(1.9, 0.018, 0.006, c.accentDark, -0.2, 0.44, z);
    b.box(0.018, 0.42, 0.006, c.accentDark, -0.2, 0.27, z);
    for (const x of [-0.72, 0.28]) b.box(0.16, 0.03, 0.012, c.cream, x, 0.56, z);
  }
};

function veg(b: GeoBuilder, rng: Rng, x: number, y: number, z: number): void {
  const kind = Math.floor(rng() * 4);
  if (kind === 0) b.sphere(0.08, '#d0402c', x, y, z, { seg: 10 });
  else if (kind === 1) b.sphere(0.075, '#7fae48', x, y, z, { seg: 10 });
  else if (kind === 2) {
    b.sphere(0.085, '#e8c04c', x, y, z, { sy: 0.85, seg: 10 });
  } else {
    b.capsule(0.03, 0.14, '#e8853b', x, y, z, { rz: Math.PI / 2 - 0.3, seg: 8 });
    b.blob(0.03, '#5f9150', x + 0.1, y + 0.03, z);
  }
}

export const vegCrate: PropBuild = ({ b, c, rng }) => {
  slatCrate(b, c.woodLight, c.wood, 0, 0, 0, 0.74, 0.3, 0.5);
  b.box(0.68, 0.02, 0.44, '#c9b98c', 0, 0.18, 0);
  for (let i = 0; i < 12; i++) veg(b, rng, range(rng, -0.27, 0.27), 0.27 + (i % 3) * 0.03, range(rng, -0.16, 0.16));
};

export const arcade: PropBuild = ({ b, c, rng }) => {
  const body = c.accentDark;
  for (const x of [-0.37, 0.37]) {
    b.box(0.04, 0.84, 0.7, c.dark, x, 0, -0.02);
    b.box(0.04, 0.5, 0.5, c.dark, x, 0.84, -0.12);
    b.box(0.04, 0.42, 0.52, c.dark, x, 1.34, -0.1);
    b.box(0.042, 0.5, 0.012, body, x, 0.2, 0.28);
  }
  b.box(0.7, 1.78, 0.34, body, 0, 0, -0.17);
  b.box(0.7, 0.72, 0.03, body, 0, 0.06, 0.32);
  b.box(0.76, 0.05, 0.34, '#22242c', 0, 0.87, 0.21, { rx: 0.2 });
  b.sphere(0.03, '#ff4d6d', -0.18, 0.99, 0.2, { seg: 10 });
  b.cyl(0.01, 0.01, 0.07, c.metal, -0.18, 0.92, 0.2, { seg: 6 });
  for (const [x, z, color] of [[0.02, 0.18, '#ffd166'], [0.13, 0.17, '#6cc6ff'], [0.24, 0.16, '#7fe0a0'], [0.05, 0.28, '#ff8a5c'], [0.16, 0.27, '#b48cff']] as const) {
    b.cyl(0.024, 0.024, 0.016, color, x, 0.92, z, { rx: 0.2, seg: 10 });
  }
  b.box(0.68, 0.56, 0.03, '#17181d', 0, 1.0, 0.03, { rx: -0.16 });
  b.box(0.58, 0.46, 0.01, '#1b6fa8', 0, 1.05, 0.058, { rx: -0.16, glow: true });
  for (let i = 0; i < 7; i++) {
    const color = pick(rng, ['#ffd166', '#ff6fa8', '#7fe0a0', '#ffffff']);
    b.box(0.05, 0.05, 0.006, color, -0.22 + i * 0.075, 1.12 + (i % 3) * 0.1, 0.05 + (i % 3) * -0.016, { rx: -0.16, glow: true });
  }
  b.box(0.7, 0.2, 0.05, '#ffd166', 0, 1.58, 0.1, { glow: true });
  b.box(0.42, 0.06, 0.008, '#c8553d', 0, 1.65, 0.128, { glow: true });
  b.box(0.76, 0.05, 0.52, c.dark, 0, 1.76, -0.1);
  b.box(0.3, 0.26, 0.012, '#2a2c33', 0, 0.3, 0.338);
  for (const x of [-0.06, 0.06]) {
    b.box(0.05, 0.1, 0.012, '#d8413a', x, 0.42, 0.344, { glow: true });
  }
  for (const y of [0.76, 0.79, 0.82]) b.box(0.24, 0.018, 0.004, '#17181d', 0, y, 0.337);
};

export const pingpong: PropBuild = ({ b, c }) => {
  const green = '#2f7a5f';
  const white = '#f4f4ef';
  b.box(2.4, 0.04, 1.3, green, 0, 0.72, 0);
  b.box(2.36, 0.05, 1.26, c.dark, 0, 0.67, 0);
  for (const z of [-0.64, 0.64]) b.box(2.4, 0.003, 0.02, white, 0, 0.76, z);
  for (const x of [-1.19, 1.19]) b.box(0.02, 0.003, 1.3, white, x, 0.76, 0);
  b.box(2.36, 0.003, 0.018, white, 0, 0.76, 0);
  for (const z of [-0.68, 0.68]) b.box(0.02, 0.17, 0.02, c.metal, 0, 0.76, z);
  b.box(0.008, 0.14, 1.36, '#d6d6d0', 0, 0.78, 0);
  b.box(0.01, 0.015, 1.36, white, 0, 0.92, 0);
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.5, 0.5]) b.box(0.05, 0.67, 0.05, c.metal, x, 0, z);
    b.box(0.04, 0.04, 1.0, c.metal, x, 0.2, 0);
  }
  b.box(1.8, 0.04, 0.04, c.metal, 0, 0.5, 0);
  for (const [x, z, color] of [[-0.74, 0.28, '#c44536'], [0.82, -0.3, '#2b4a7a']] as const) {
    b.cyl(0.08, 0.08, 0.012, color, x, 0.762, z, { seg: 14, sz: 1.15 });
    b.box(0.03, 0.012, 0.11, c.woodLight, x, 0.762, z + 0.13);
  }
  b.sphere(0.022, '#ffffff', 0.34, 0.782, 0.2, { seg: 8 });
};

export const oldBoxes: PropBuild = ({ b, c, rng }) => {
  const kraft = '#b89468';
  const tape = '#a58258';
  b.box(0.7, 0.42, 0.55, kraft, 0, 0, 0);
  b.box(0.71, 0.003, 0.1, tape, 0, 0.42, 0);
  b.box(0.1, 0.42, 0.003, tape, 0, 0, 0.277);
  b.box(0.2, 0.09, 0.004, c.cream, 0.18, 0.26, 0.278);
  const top = range(rng, -0.25, 0.25);
  b.at(0.02, 0.01, top, () => {
    b.box(0.5, 0.26, 0.4, kraft, 0, 0.42, 0);
    b.box(0.46, 0.012, 0.36, '#6f5234', 0, 0.68, 0);
    b.box(0.5, 0.008, 0.16, tape, 0, 0.7, 0.26, { rx: 0.5 });
    b.box(0.5, 0.008, 0.16, tape, 0, 0.7, -0.26, { rx: -0.5 });
    b.box(0.2, 0.05, 0.14, c.accentSoft, -0.1, 0.69, 0.02, { ry: 0.3 });
    b.box(0.03, 0.2, 0.15, c.cream, 0.14, 0.62, 0.0, { rz: -0.25 });
  });
};
