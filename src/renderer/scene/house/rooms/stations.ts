import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, type Group } from 'three';
import { range, type Rng } from '@shared/random';
import type { RoomType } from '@shared/types';
import { GeoBuilder } from '../../builder';
import type { Palette } from '../palette';

export type StationKind = 'logistics' | 'usage';

export interface ScreenData {
  title: string;
  count: string;
  caption: string;
  lines: string[];
}

const WIDTH = 1024;
const HEIGHT = 576;

export class StationScreen {
  readonly mesh: Mesh;
  private canvas = document.createElement('canvas');
  private texture: CanvasTexture;

  constructor(
    width: number,
    height: number,
    private accent: string,
  ) {
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.mesh = new Mesh(new PlaneGeometry(width, height), new MeshBasicMaterial({ map: this.texture }));
    this.draw({ title: 'Chargement', count: '…', caption: '', lines: [] });
  }

  draw(data: ScreenData): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#161a22';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = this.accent;
    ctx.fillRect(0, 0, WIDTH, 14);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 70px "Fredoka Variable", system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText(data.title, 44, 40);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.accent;
    ctx.font = '700 128px "Fredoka Variable", system-ui, sans-serif';
    ctx.fillText(data.count, WIDTH - 44, 28);
    ctx.fillStyle = '#9aa3b2';
    ctx.font = '500 32px "Inter Variable", system-ui, sans-serif';
    ctx.fillText(data.caption, WIDTH - 44, 158);

    ctx.textAlign = 'left';
    ctx.font = '500 44px "Inter Variable", system-ui, sans-serif';
    data.lines.slice(0, 4).forEach((line, index) => {
      const y = 214 + index * 88;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(36, y - 6, WIDTH - 72, 76);
      ctx.fillStyle = this.accent;
      ctx.fillRect(36, y - 6, 10, 76);
      ctx.fillStyle = '#eef1f6';
      ctx.fillText(fit(ctx, line, WIDTH - 120), 66, y + 8);
    });
    if (data.lines.length === 0) {
      ctx.fillStyle = '#9aa3b2';
      ctx.fillText('Rien pour le moment', 44, 240);
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  const width = (value: string) => ctx.measureText?.(value)?.width ?? 0;
  if (width(text) <= max) return text;
  let cut = text;
  while (cut.length > 1 && width(`${cut}…`) > max) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export interface BuiltStation {
  object: Group;
  screen: StationScreen;
}

export interface Station {
  kind: StationKind;
  w: number;
  d: number;
  accent: string;
  build(c: Palette, rng: Rng, accent: string): BuiltStation;
}

function buildWallScreen(c: Palette, rng: Rng, accent: string): BuiltStation {
  const b = new GeoBuilder();
  const w = 3.3;
  const h = w * (HEIGHT / WIDTH);
  b.box(w + 0.1, 0.5, 0.46, c.wood, 0, 0.03, -0.02, { r: 0.02 });
  for (let i = 0; i < 3; i++) {
    b.box((w - 0.1) / 3 - 0.04, 0.38, 0.012, c.woodLight, -w / 3 + (i * w) / 3, 0.09, 0.215);
  }
  b.box(0.3, 0.06, 0.2, accent, range(rng, -1.1, -0.5), 0.53, 0, { r: 0.02 });
  b.cyl(0.07, 0.09, 0.16, c.ceramic, range(rng, 0.7, 1.3), 0.53, 0);
  b.box(w + 0.14, h + 0.14, 0.1, '#20232b', 0, 0.62, -0.16, { r: 0.02 });
  const object = b.build();
  const screen = new StationScreen(w, h, accent);
  screen.mesh.position.set(0, 0.69 + h / 2, -0.105);
  object.add(screen.mesh);
  return { object, screen };
}

function buildDashboard(c: Palette, _rng: Rng, accent: string): BuiltStation {
  const b = new GeoBuilder();
  b.box(1.9, 0.8, 0.5, '#c8553d', 0, 0.06, 0, { r: 0.02 });
  for (const y of [0.3, 0.56]) b.box(1.8, 0.015, 0.02, c.dark, 0, y, 0.255);
  b.box(1.8, 0.05, 0.54, c.dark, 0, 0.86, 0);
  b.box(1.86, 1.1, 0.08, '#20232b', 0, 0.92, -0.17, { r: 0.02 });
  const object = b.build();
  const screen = new StationScreen(1.76, 0.99, accent);
  screen.mesh.position.set(0, 1.47, -0.125);
  object.add(screen.mesh);
  return { object, screen };
}

export const STATIONS: Partial<Record<RoomType, Station>> = {
  logistique: { kind: 'logistics', w: 3.5, d: 0.5, accent: '#ff8a5c', build: buildWallScreen },
  garage: { kind: 'usage', w: 1.95, d: 0.58, accent: '#ff8a5c', build: buildDashboard },
};
