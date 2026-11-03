import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, Sprite, SpriteMaterial } from 'three';
import type { GeoBuilder } from '../../builder';

export type Updater = (time: number, dt: number) => void;

export function blend(from: string, to: string, amount: number): string {
  return `#${new Color(from).lerp(new Color(to), amount).getHexString()}`;
}

let puffTexture: CanvasTexture | null = null;

function puff(): CanvasTexture {
  if (puffTexture) return puffTexture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  gradient.addColorStop(0, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  puffTexture = new CanvasTexture(canvas);
  puffTexture.colorSpace = SRGBColorSpace;
  return puffTexture;
}

export function steam(b: GeoBuilder, updaters: Updater[], x: number, y: number, z: number): void {
  const group = new Group();
  const puffs = [0, 1, 2].map((i) => {
    const sprite = new Sprite(new SpriteMaterial({ map: puff(), transparent: true, depthWrite: false, opacity: 0 }));
    sprite.scale.setScalar(0.14);
    sprite.userData.phase = i / 3;
    group.add(sprite);
    return sprite;
  });
  b.attach(group, x, y, z);
  updaters.push((time) => {
    for (const sprite of puffs) {
      const p = (time * 0.35 + (sprite.userData.phase as number)) % 1;
      sprite.position.set(Math.sin(p * 6 + (sprite.userData.phase as number) * 9) * 0.03, p * 0.42, 0);
      sprite.material.opacity = Math.sin(p * Math.PI) * 0.45;
      sprite.scale.setScalar(0.1 + p * 0.16);
    }
  });
}

export function clockHands(b: GeoBuilder, updaters: Updater[], x: number, y: number, z: number, radius: number): void {
  const material = new MeshBasicMaterial({ color: 0x20222e });
  const hourGeometry = new PlaneGeometry(radius * 0.09, radius * 0.55);
  hourGeometry.translate(0, radius * 0.27, 0);
  const minuteGeometry = new PlaneGeometry(radius * 0.06, radius * 0.82);
  minuteGeometry.translate(0, radius * 0.41, 0);
  const hour = new Mesh(hourGeometry, material);
  const minute = new Mesh(minuteGeometry, material);
  const group = new Group();
  group.add(hour, minute);
  b.attach(group, x, y, z);
  updaters.push(() => {
    const now = new Date();
    minute.rotation.z = -((now.getMinutes() + now.getSeconds() / 60) / 60) * Math.PI * 2;
    hour.rotation.z = -(((now.getHours() % 12) + now.getMinutes() / 60) / 12) * Math.PI * 2;
  });
}
