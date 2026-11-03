import { CanvasTexture, Color, DirectionalLight, HemisphereLight, MathUtils, SRGBColorSpace, Vector3 } from 'three';
import type { DayCycleMode } from '@shared/types';

export interface DayState {
  day: number;
  sun: Vector3;
  hour: number;
}

export function hourFor(mode: DayCycleMode, elapsed: number, now: Date): number {
  switch (mode) {
    case 'day':
      return 11;
    case 'night':
      return 23;
    case 'fast':
      return (8 + elapsed / 5) % 24;
    case 'real':
      return now.getHours() + now.getMinutes() / 60;
  }
}

const SUN_BASE = new Vector3(-0.55, 0.68, 0.48).normalize();
const Y_AXIS = new Vector3(0, 1, 0);

export function dayStateAt(hour: number): DayState {
  const t = MathUtils.clamp((hour - 6) / 15, 0, 1);
  const swing = MathUtils.degToRad(MathUtils.lerp(-18, 18, t));
  const sun = SUN_BASE.clone().applyAxisAngle(Y_AXIS, swing);
  const day = MathUtils.smoothstep(hour, 5.5, 7.5) * (1 - MathUtils.smoothstep(hour, 19.5, 21.5));
  return { day, sun, hour };
}

const BG_DAY_CENTER = new Color('#f8dfce');
const BG_DAY_EDGE = new Color('#efc3ab');
const BG_NIGHT_CENTER = new Color('#3b3247');
const BG_NIGHT_EDGE = new Color('#211c2c');
const SKY_DAY = new Color('#fffaf5');
const SKY_NIGHT = new Color('#5c6498');
const GROUND_DAY = new Color('#f4dfd2');
const GROUND_NIGHT = new Color('#2d2a45');
const SUN_DAY = new Color('#fff6ea');
const MOON = new Color('#9fb2ff');

export class Environment {
  readonly hemi = new HemisphereLight(0xffffff, 0x444444, 1);
  readonly sunLight = new DirectionalLight(0xffffff, 2);
  readonly background: CanvasTexture;
  state: DayState = dayStateAt(12);

  private canvas = document.createElement('canvas');
  private paintedDay = -1;
  private center = new Color();
  private edge = new Color();

  constructor() {
    this.canvas.width = this.canvas.height = 256;
    this.background = new CanvasTexture(this.canvas);
    this.background.colorSpace = SRGBColorSpace;
    this.sunLight.castShadow = true;
  }

  private paintBackground(day: number): void {
    if (Math.abs(day - this.paintedDay) < 0.015) return;
    this.paintedDay = day;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.center.copy(BG_NIGHT_CENTER).lerp(BG_DAY_CENTER, day);
    this.edge.copy(BG_NIGHT_EDGE).lerp(BG_DAY_EDGE, day);
    const gradient = ctx.createRadialGradient(128, 110, 10, 128, 128, 190);
    gradient.addColorStop(0, this.center.getStyle());
    gradient.addColorStop(1, this.edge.getStyle());
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    this.background.needsUpdate = true;
  }

  update(time: number, mode: DayCycleMode): DayState {
    const state = dayStateAt(hourFor(mode, time, new Date()));
    this.state = state;
    const { day } = state;
    this.paintBackground(day);

    this.hemi.color.copy(SKY_NIGHT).lerp(SKY_DAY, day);
    this.hemi.groundColor.copy(GROUND_NIGHT).lerp(GROUND_DAY, day);
    this.hemi.intensity = MathUtils.lerp(0.72, 2.6, day);

    this.sunLight.color.copy(MOON).lerp(SUN_DAY, day);
    this.sunLight.intensity = MathUtils.lerp(0.42, 2.35, day);
    this.sunLight.position.copy(state.sun);
    return state;
  }
}
