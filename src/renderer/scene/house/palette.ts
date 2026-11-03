import { Color } from 'three';
import { pick, type Rng } from '@shared/random';
import type { RoomType } from '@shared/types';

export interface Palette {
  accent: string;
  accentDark: string;
  accentSoft: string;
  wall: string;
  wood: string;
  woodDark: string;
  woodLight: string;
  metal: string;
  dark: string;
  cream: string;
  fabric: string;
  fabricAlt: string;
  ceramic: string;
  leaf: string;
  leafDark: string;
  terracotta: string;
}

const WOODS = [
  ['#d8b68f', '#a17f5c', '#ecd6b8'],
  ['#8a5f42', '#5b3d2b', '#b58a68'],
  ['#ece6da', '#c2b8a8', '#f6f2ea'],
  ['#3d3d43', '#29292e', '#5c5c63'],
] as const;

const FLOOR_WOODS = ['#c98a5e', '#bb7c53', '#d29668', '#c0835c'];

const NEUTRAL_ACCENTS = ['#d9673f', '#6f8f5a', '#c9a15a', '#5f7f8f'];

function shade(color: string, lightness: number, saturation = 0): string {
  return `#${new Color(color).offsetHSL(0, saturation, lightness).getHexString()}`;
}

function mix(a: string, b: string, t: number): string {
  return `#${new Color(a).lerp(new Color(b), t).getHexString()}`;
}

export function makePalette(rng: Rng, projectColor: string | null, type: RoomType): Palette {
  const accent = projectColor ?? pick(rng, NEUTRAL_ACCENTS);
  const wood = pick(rng, WOODS);
  const wallBase = pick(rng, ['#fffdf9', '#fdfaf5', '#fbf8f2']);
  const tint = projectColor ? 0.02 + rng() * 0.05 : rng() * 0.02;
  return {
    accent,
    accentDark: shade(accent, -0.14),
    accentSoft: mix(accent, '#faf4ea', 0.6),
    wall: mix(wallBase, accent, tint),
    wood: wood[0],
    woodDark: wood[1],
    woodLight: wood[2],
    metal: '#a4a7ab',
    dark: '#2a2c33',
    cream: '#f7f1e6',
    fabric: pick(rng, ['#e7e2da', '#d9d5cf', '#cfcac4', mix('#e7e2da', accent, 0.25)]),
    fabricAlt: mix('#f7f1e6', accent, 0.32 + rng() * 0.24),
    ceramic: '#f7f6f3',
    leaf: pick(rng, ['#6f9a4c', '#7ea653', '#5f9150', '#88a84f']),
    leafDark: pick(rng, ['#4f7d3f', '#42703f', '#5c8238']),
    terracotta: pick(rng, ['#2b2b2e', '#2b2b2e', '#f4efe7', '#c0683f']),
  };
}

export type FloorKind = 'parquet' | 'tile' | 'concrete' | 'carpet';

const FLOOR_BY_TYPE: Record<RoomType, FloorKind[]> = {
  bureau: ['parquet'],
  salon: ['parquet'],
  cuisine: ['parquet', 'tile'],
  'salle-a-manger': ['parquet'],
  chambre: ['parquet'],
  atelier: ['concrete', 'parquet'],
  bibliotheque: ['parquet'],
  cellier: ['concrete', 'tile'],
  garage: ['concrete'],
  veranda: ['tile', 'parquet'],
  grenier: ['parquet'],
  'salle-de-jeux': ['parquet'],
  couloir: ['parquet'],
  entree: ['parquet', 'tile'],
  'salle-de-bain': ['tile'],
  wc: ['tile'],
  buanderie: ['tile', 'concrete'],
  logistique: ['parquet'],
};

export function chooseFloor(rng: Rng, type: RoomType): FloorKind {
  return pick(rng, FLOOR_BY_TYPE[type]);
}

export function floorTint(rng: Rng, kind: FloorKind, palette: Palette): string {
  switch (kind) {
    case 'parquet':
      return pick(rng, FLOOR_WOODS);
    case 'tile':
      return mix('#f4f0e8', palette.accent, rng() * 0.05);
    case 'concrete':
      return mix('#cfc8bf', '#e0d4c6', rng());
    case 'carpet':
      return mix('#ece6da', palette.accent, 0.2 + rng() * 0.2);
  }
}
