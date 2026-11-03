import { pick, range } from '@shared/random';
import { blade } from './decor';
import type { PropBuild } from './types';

export const tree: PropBuild = ({ b, rng }) => {
  const height = 1.5 + rng() * 0.9;
  const leaf = pick(rng, ['#7ea653', '#8cae55', '#6f9a4c', '#9bb45a']);
  const dark = pick(rng, ['#5f8a45', '#6f8f42']);
  const bark = '#7a5236';
  b.lathe([[0.1, 0], [0.065, 0.1], [0.05, 0.5], [0.035, height]], bark, 0, 0, 0, { seg: 8 });
  for (const [dx, dz, h] of [[0.22, 0.08, 0.62], [-0.2, -0.1, 0.72], [0.04, 0.2, 0.8]] as const) {
    b.cyl(0.012, 0.024, 0.5, bark, dx * 0.55, height * h, dz * 0.55, { rz: -dx * 1.9, rx: dz * 1.9, seg: 6 });
  }
  b.blob(0.5 + rng() * 0.14, leaf, 0, height + 0.2, 0, { sy: 0.88 });
  b.blob(0.32 + rng() * 0.08, dark, 0.34, height - 0.02, 0.12);
  b.blob(0.3 + rng() * 0.08, leaf, -0.3, height + 0.02, -0.14);
  b.blob(0.24, dark, 0.04, height + 0.05, 0.34);
};

export const cactus: PropBuild = ({ b, rng }) => {
  const count = 1 + Math.floor(rng() * 3);
  const colors = ['#3f6f49', '#4a7a4c', '#37633f'];
  b.cyl(0.26, 0.3, 0.03, '#b9ad98', 0, 0, 0, { seg: 12 });
  for (let i = 0; i < count; i++) {
    const h = 0.42 + rng() * 0.5;
    const r = 0.065 + rng() * 0.03;
    const x = i === 0 ? 0 : range(rng, -0.17, 0.17);
    const z = i === 0 ? 0 : range(rng, -0.17, 0.17);
    const color = pick(rng, colors);
    b.capsule(r, h, color, x, h / 2 + r + 0.02, z, { seg: 8 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      b.box(0.016, h, 0.016, '#2d5a38', x + Math.cos(a) * r, r + 0.02, z + Math.sin(a) * r);
    }
    if (h > 0.62) {
      b.capsule(r * 0.55, 0.08, color, x + r * 1.5, h * 0.55, z, { rz: Math.PI / 2, seg: 6 });
      b.capsule(r * 0.55, 0.14, color, x + r * 2.3, h * 0.68, z, { seg: 6 });
    }
    if (rng() > 0.6) b.sphere(0.02, '#ff6fa8', x, h + r * 1.45, z, { seg: 6 });
  }
};

export const pottedOutdoor: PropBuild = ({ b, rng }) => {
  const pot = rng() > 0.4 ? '#2b2b2e' : '#f4efe7';
  b.lathe([[0, 0], [0.11, 0], [0.17, 0.26], [0.18, 0.28], [0.16, 0.28], [0, 0.26]], pot, 0, 0, 0, { seg: 12 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng();
    blade(b, i % 2 ? '#6f9a4c' : '#4f7d3f', Math.sin(a) * 0.03, 0.27, Math.cos(a) * 0.03, a, 0.42 + rng() * 0.2, 0.09, 0.2 + rng() * 0.45);
  }
};

export const shrub: PropBuild = ({ b, rng }) => {
  const color = pick(rng, ['#6f9a4c', '#5f9150', '#88a84f']);
  const dark = '#4f7d3f';
  b.blob(0.26 + rng() * 0.1, color, 0, 0.3, 0, { sy: 0.8 });
  b.blob(0.18 + rng() * 0.06, dark, 0.2, 0.2, 0.07, { sy: 0.8 });
  b.blob(0.16 + rng() * 0.05, color, -0.17, 0.18, -0.08, { sy: 0.8 });
  for (let i = 0; i < 5; i++) b.sphere(0.02, pick(rng, ['#ff6fa8', '#ffffff', '#ffd166']), range(rng, -0.22, 0.26), 0.34 + rng() * 0.12, range(rng, -0.12, 0.2), { seg: 6 });
};

export const gardenBench: PropBuild = ({ b }) => {
  const wood = '#c58248';
  const iron = '#2f3136';
  for (const z of [-0.14, -0.05, 0.04, 0.13]) b.box(1.46, 0.03, 0.075, wood, 0, 0.36, z, { r: 0.008 });
  for (const y of [0.52, 0.63, 0.74]) b.box(1.46, 0.07, 0.022, wood, 0, y, -0.25, { r: 0.008, rx: -0.14 });
  for (const x of [-0.62, 0.62]) {
    b.box(0.04, 0.36, 0.04, iron, x, 0, 0.14);
    b.box(0.04, 0.84, 0.04, iron, x, 0, -0.22, { rx: -0.08 });
    b.box(0.04, 0.04, 0.42, iron, x, 0.32, -0.04);
    b.box(0.04, 0.03, 0.34, iron, x, 0.58, -0.04);
    b.box(0.04, 0.26, 0.04, iron, x, 0.34, 0.12);
  }
};

export const mailbox: PropBuild = ({ b }) => {
  b.box(0.08, 0.86, 0.08, '#26282e', 0, 0, 0);
  b.cyl(0.11, 0.13, 0.03, '#26282e', 0, 0, 0, { seg: 10 });
  b.box(0.3, 0.2, 0.46, '#d9673f', 0, 0.86, 0, { r: 0.02 });
  b.cyl(0.15, 0.15, 0.46, '#d9673f', 0, 1.06 - 0.23, 0, { rx: Math.PI / 2, seg: 14 });
  b.box(0.26, 0.2, 0.012, '#bd5230', 0, 0.87, 0.232);
  b.sphere(0.014, '#ece7dd', 0, 0.97, 0.244, { seg: 6 });
  b.box(0.018, 0.2, 0.018, '#ffd166', 0.16, 0.95, -0.08);
  b.box(0.012, 0.09, 0.12, '#ffd166', 0.16, 1.1, -0.03);
  b.box(0.1, 0.05, 0.004, '#ffffff', 0, 0.92, 0.238);
};
