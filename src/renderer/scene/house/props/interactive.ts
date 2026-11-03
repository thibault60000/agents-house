import { pick, range } from '@shared/random';
import { blend } from './fx';
import type { PropBuild } from './types';

export const DESK_SEAT_OFFSET = 0.5;

export const desk: PropBuild = ({ b, c, rng }) => {
  b.box(2.0, 0.05, 0.9, c.wood, 0, 0.76, -0.5, { r: 0.018 });
  for (const x of [-0.9, 0.9]) {
    for (const z of [-0.88, -0.12]) b.box(0.05, 0.76, 0.05, c.woodDark, x, 0, z);
    b.box(0.04, 0.05, 0.72, c.woodDark, x, 0.7, -0.5);
  }
  b.box(1.76, 0.06, 0.03, c.woodDark, 0, 0.7, -0.88);
  b.box(0.46, 0.58, 0.72, c.woodDark, 0.6, 0.12, -0.5, { r: 0.008 });
  for (const [y, h] of [[0.16, 0.2], [0.38, 0.14], [0.54, 0.14]] as const) {
    b.box(0.42, h, 0.012, c.woodLight, 0.6, y, -0.135);
    b.box(0.12, 0.014, 0.018, c.metal, 0.6, y + h - 0.05, -0.124);
  }
  for (const x of [0.42, 0.78]) b.sphere(0.022, c.dark, x, 0.022, -0.2, { seg: 6 });
  b.box(0.3, 0.02, 0.2, c.dark, 0, 0.81, -0.72, { r: 0.006 });
  b.box(0.05, 0.2, 0.04, c.dark, 0, 0.83, -0.74);
  b.box(1.02, 0.62, 0.04, c.dark, 0, 1.0, -0.74, { r: 0.012 });
  b.box(0.62, 0.012, 0.3, '#3a3d48', 0.08, 0.81, -0.36);
  b.box(0.44, 0.016, 0.15, '#dcdce2', -0.02, 0.822, -0.36, { r: 0.005 });
  for (let row = 0; row < 3; row++) for (let i = 0; i < 12; i++) b.box(0.028, 0.006, 0.03, '#f5f5f8', -0.2 + i * 0.036, 0.838, -0.41 + row * 0.042);
  b.box(0.07, 0.024, 0.11, '#dcdce2', 0.3, 0.822, -0.36, { r: 0.012 });
  b.lathe([[0, 0], [0.036, 0], [0.042, 0.008], [0.042, 0.09], [0.034, 0.09], [0.032, 0.02], [0, 0.02]], c.accent, -0.66, 0.81, -0.28, { seg: 10 });
  b.ring(0.024, 0.006, c.accent, -0.62 + 0.012, 0.86, -0.28, { rx: 0, seg: 8 });
  b.box(0.22, 0.022, 0.3, c.accentSoft, -0.72, 0.81, -0.66, { ry: 0.14 });
  b.box(0.016, 0.016, 0.16, c.dark, -0.66, 0.835, -0.64, { ry: 0.4 });
  b.lathe([[0, 0], [0.04, 0], [0.055, 0.08]], pick(rng, [c.ceramic, c.terracotta]), 0.76, 0.81, -0.74, { seg: 10 });
  b.blob(0.075, c.leaf, 0.76, 0.96, -0.74);
  b.box(0.1, 0.16, 0.1, c.dark, -0.42, 0.81, -0.8, { r: 0.012 });
  b.cyl(0.03, 0.03, 0.006, '#4a4d58', -0.42, 0.92, -0.75, { rx: Math.PI / 2, seg: 10 });
  b.lathe([[0, 0], [0.26, 0], [0.3, 0.03], [0.29, 0.06], [0.2, 0.08], [0, 0.08]], c.fabric, 0, 0.41, DESK_SEAT_OFFSET, { seg: 18 });
  b.cyl(0.03, 0.04, 0.34, c.dark, 0, 0.07, DESK_SEAT_OFFSET, { seg: 10 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.box(0.3, 0.025, 0.05, c.dark, Math.cos(a) * 0.15, 0.05, DESK_SEAT_OFFSET + Math.sin(a) * 0.15, { ry: -a });
    b.sphere(0.028, c.dark, Math.cos(a) * 0.29, 0.03, DESK_SEAT_OFFSET + Math.sin(a) * 0.29, { seg: 8 });
  }
};

export const docCabinet: PropBuild = ({ b, c, rng }) => {
  b.box(1.6, 0.05, 0.6, c.dark, 0, 0, 0);
  b.box(1.6, 1.8, 0.6, c.woodDark, 0, 0.05, 0, { r: 0.015 });
  b.box(1.5, 1.68, 0.02, c.wood, 0, 0.11, 0.305);
  for (const [i, y] of [0.15, 0.68, 1.21].entries()) {
    b.box(1.496, 0.04, 0.05, c.woodDark, 0, y, 0.33);
    let x = -0.68;
    while (x < 0.6) {
      const binder = i === 1 && rng() > 0.4;
      const t = binder ? 0.09 : 0.05 + rng() * 0.05;
      const h = binder ? 0.42 : 0.28 + rng() * 0.16;
      const color = pick(rng, [c.accent, c.accentSoft, '#e9c46a', '#2a9d8f', '#e76f51', c.cream, '#3f6c8f']);
      b.box(t, h, 0.1, color, x + t / 2, y + 0.04, 0.355);
      if (binder) {
        b.box(t * 0.7, 0.1, 0.004, c.cream, x + t / 2, y + 0.26, 0.407);
        b.cyl(0.012, 0.012, 0.004, c.dark, x + t / 2, y + 0.12, 0.407, { rx: Math.PI / 2, seg: 8 });
      }
      x += t + 0.012;
    }
  }
  b.box(1.66, 0.07, 0.66, c.wood, 0, 1.85, 0, { r: 0.018 });
  for (const [x, color] of [[-0.42, c.accentSoft], [0.1, c.cream]] as const) {
    b.box(0.44, 0.22, 0.32, color, x, 1.92, 0, { r: 0.008 });
    b.box(0.18, 0.06, 0.004, c.dark, x, 2.0, 0.162);
  }
};

export const treasureChest: PropBuild = ({ b, c }) => {
  const iron = '#c9a13b';
  const lidY = 0.6;
  const plankTone = blend(c.wood, c.woodDark, 0.28);
  b.box(1.22, 0.03, 0.74, c.woodDark, 0, 0, 0);
  for (let i = 0; i < 4; i++) b.box(1.2, 0.135, 0.72, i % 2 ? plankTone : c.wood, 0, 0.03 + i * 0.135, 0);
  b.box(1.24, 0.06, 0.76, c.woodDark, 0, 0.56, 0);
  b.cyl(0.34, 0.34, 1.16, c.wood, 0, lidY - 0.58, 0, { rz: Math.PI / 2, sx: 0.55, seg: 20 });
  for (const x of [-0.44, 0.44]) {
    b.box(0.08, 0.53, 0.77, iron, x, 0.03, 0, { r: 0.006 });
    b.cyl(0.365, 0.365, 0.08, iron, x, lidY - 0.04, 0, { rz: Math.PI / 2, sx: 0.55, seg: 20 });
    for (const y of [0.12, 0.3, 0.48]) for (const z of [-0.388, 0.388]) b.sphere(0.016, '#8a6f22', x, y, z, { seg: 6 });
  }
  b.box(0.2, 0.2, 0.03, iron, 0, 0.35, 0.372, { r: 0.012 });
  b.cyl(0.024, 0.024, 0.012, c.dark, 0, 0.42, 0.388, { rx: Math.PI / 2, seg: 8 });
  b.box(0.05, 0.016, 0.07, iron, 0, 0.624, 0.365);
  b.box(0.05, 0.14, 0.016, iron, 0, 0.5, 0.392);
  for (const x of [-0.61, 0.61]) b.ring(0.05, 0.012, c.dark, x, 0.34, 0, { rx: 0, ry: Math.PI / 2, seg: 10 });
};

export const corkBoard: PropBuild = ({ b, c, rng }) => {
  for (const x of [-0.68, 0.68]) {
    b.box(0.06, 1.85, 0.05, c.woodDark, x, 0, 0);
    b.box(0.06, 0.04, 0.42, c.woodDark, x, 0, 0);
  }
  b.box(1.5, 1.05, 0.05, c.woodDark, 0, 0.8, 0, { r: 0.01 });
  b.box(1.38, 0.93, 0.012, '#c79a68', 0, 0.86, 0.028);
  for (let i = 0; i < 26; i++) b.box(0.012, 0.012, 0.002, '#a87f50', range(rng, -0.66, 0.66), range(rng, 0.9, 1.75), 0.035);
  const colors = ['#ffd166', '#ff8a5c', '#7fe0a0', '#6cc6ff', '#ff6fa8'];
  const pins: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.46 + (i % 3) * 0.46 + range(rng, -0.05, 0.05);
    const y = 1.03 + (i < 3 ? 0.44 : 0) + range(rng, -0.03, 0.03);
    b.box(0.28, 0.28, 0.006, colors[i % colors.length] as string, x, y - 0.1, 0.038, { rz: range(rng, -0.09, 0.09) });
    for (const dy of [0.0, 0.05, 0.1]) b.box(0.2, 0.016, 0.002, '#5a5140', x, y - 0.04 + dy, 0.042);
    b.sphere(0.016, '#d0394a', x, y + 0.14, 0.05, { seg: 6 });
    pins.push([x, y + 0.14]);
  }
  const [a, d] = [pins[0] as [number, number], pins[4] as [number, number]];
  const len = Math.hypot(d[0] - a[0], d[1] - a[1]);
  b.box(len, 0.016, 0.004, '#d0394a', (a[0] + d[0]) / 2, (a[1] + d[1]) / 2 - 0.003, 0.05, { rz: Math.atan2(d[1] - a[1], d[0] - a[0]) });
  b.box(1.4, 0.03, 0.08, c.woodDark, 0, 0.78, 0.04);
  b.cyl(0.012, 0.012, 0.12, '#3f6c8f', -0.4, 0.81, 0.05, { rz: Math.PI / 2, seg: 6 });
};
