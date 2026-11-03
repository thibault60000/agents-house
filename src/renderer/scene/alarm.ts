import { AdditiveBlending, CanvasTexture, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace } from 'three';

export type AlarmLevel = 0 | 1 | 2;

const ALARM_COLORS = { 1: 0xff7a14, 2: 0xff1f24 } as const;
const ALARM_SPEED = { 1: 3.4, 2: 5.2 } as const;

function haloTexture(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d') as CanvasRenderingContext2D;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class AlarmBeacons {
  readonly group = new Group();
  readonly color = new Color();
  private level: AlarmLevel = 0;
  private built: unknown = null;
  private domeMaterial = new MeshBasicMaterial({ toneMapped: false });
  private haloMaterial = new SpriteMaterial({ map: haloTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true });
  private capMaterial = new MeshBasicMaterial({ color: 0x24262c });
  private domeGeometry = new SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  private capGeometry = new CylinderGeometry(0.16, 0.16, 0.05, 14);

  constructor() {
    this.group.visible = false;
    this.group.userData.noAO = true;
  }

  get active(): boolean {
    return this.level > 0;
  }

  setLevel(level: AlarmLevel): void {
    this.level = level;
    this.group.visible = level > 0;
    if (level > 0) this.color.setHex(ALARM_COLORS[level as 1 | 2]);
  }

  place(owner: unknown, points: { x: number; y: number; z: number }[]): void {
    if (owner === this.built) return;
    this.built = owner;
    this.group.clear();
    for (const point of points) {
      const cap = new Mesh(this.capGeometry, this.capMaterial);
      cap.position.set(point.x, point.y + 0.06, point.z);
      const dome = new Mesh(this.domeGeometry, this.domeMaterial);
      dome.rotation.x = Math.PI;
      dome.position.set(point.x, point.y + 0.04, point.z);
      const halo = new Sprite(this.haloMaterial);
      halo.position.set(point.x, point.y - 0.02, point.z);
      halo.scale.setScalar(2.2);
      for (const part of [cap, dome, halo]) part.userData.noAO = true;
      this.group.add(cap, dome, halo);
    }
  }

  update(time: number, motion: boolean): number {
    if (this.level === 0) return 0;
    const pulse = motion ? Math.max(0, Math.sin(time * ALARM_SPEED[this.level as 1 | 2])) ** 2 : 0.75;
    this.domeMaterial.color.copy(this.color).multiplyScalar(0.8 + pulse * 1.6);
    this.haloMaterial.color.copy(this.color);
    this.haloMaterial.opacity = 0.08 + pulse * 0.5;
    return pulse;
  }

  dispose(): void {
    this.group.clear();
    this.haloMaterial.map?.dispose();
    this.haloMaterial.dispose();
    this.domeMaterial.dispose();
    this.capMaterial.dispose();
    this.domeGeometry.dispose();
    this.capGeometry.dispose();
  }
}
