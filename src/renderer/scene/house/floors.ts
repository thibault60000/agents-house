import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { createRng } from '@shared/random';
import type { FloorKind } from './palette';

const SIZE = 512;
export const FLOOR_TEXTURE_METERS = 4;

const cache = new Map<FloorKind, CanvasTexture>();

function grain(ctx: CanvasRenderingContext2D, rng: () => number, count: number, alpha: number): void {
  for (let i = 0; i < count; i++) {
    const v = rng() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${v},${v},${v},${alpha * rng()})`;
    ctx.fillRect(rng() * SIZE, rng() * SIZE, 1 + rng() * 2, 1 + rng() * 2);
  }
}

function drawParquet(ctx: CanvasRenderingContext2D): void {
  const rng = createRng(11);
  const plank = SIZE / 8;
  for (let row = 0; row < 8; row++) {
    let x = -rng() * SIZE * 0.5;
    while (x < SIZE) {
      const length = SIZE * (0.35 + rng() * 0.3);
      const v = 205 + rng() * 40;
      ctx.fillStyle = `rgb(${v},${v - 6},${v - 14})`;
      ctx.fillRect(x, row * plank, length, plank);
      ctx.fillRect(x + SIZE, row * plank, length, plank);
      ctx.fillStyle = 'rgba(40,24,10,0.35)';
      ctx.fillRect(x, row * plank, 2, plank);
      ctx.fillRect(x + SIZE, row * plank, 2, plank);
      x += length;
    }
    ctx.fillStyle = 'rgba(40,24,10,0.3)';
    ctx.fillRect(0, row * plank, SIZE, 2);
  }
  grain(ctx, rng, 2600, 0.05);
}

function drawTile(ctx: CanvasRenderingContext2D): void {
  const rng = createRng(23);
  const tile = SIZE / 4;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 228 + rng() * 22;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  ctx.fillStyle = 'rgba(70,70,80,0.4)';
  for (let i = 0; i <= 4; i++) {
    ctx.fillRect(i * tile - 2, 0, 4, SIZE);
    ctx.fillRect(0, i * tile - 2, SIZE, 4);
  }
  grain(ctx, rng, 900, 0.03);
}

function drawConcrete(ctx: CanvasRenderingContext2D): void {
  const rng = createRng(37);
  ctx.fillStyle = 'rgb(235,235,232)';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 90; i++) {
    const v = rng() > 0.5 ? 255 : 90;
    ctx.fillStyle = `rgba(${v},${v},${v},${0.02 + rng() * 0.03})`;
    ctx.beginPath();
    ctx.arc(rng() * SIZE, rng() * SIZE, 12 + rng() * 60, 0, Math.PI * 2);
    ctx.fill();
  }
  grain(ctx, rng, 6000, 0.05);
}

function drawCarpet(ctx: CanvasRenderingContext2D): void {
  const rng = createRng(53);
  ctx.fillStyle = 'rgb(238,238,238)';
  ctx.fillRect(0, 0, SIZE, SIZE);
  grain(ctx, rng, 26000, 0.09);
}

const DRAW: Record<FloorKind, (ctx: CanvasRenderingContext2D) => void> = {
  parquet: drawParquet,
  tile: drawTile,
  concrete: drawConcrete,
  carpet: drawCarpet,
};

export function floorTexture(kind: FloorKind): CanvasTexture {
  const cached = cache.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  DRAW[kind](ctx);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  cache.set(kind, texture);
  return texture;
}
