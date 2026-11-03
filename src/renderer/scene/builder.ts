import {
  BoxGeometry,
  BufferGeometry,
  Color,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type ColorRepresentation,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const solidMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 });

export const glowMaterial = new MeshBasicMaterial({ vertexColors: true });

export const glassMaterial = new MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.3,
  metalness: 0.1,
  emissive: 0xffc98a,
  emissiveIntensity: 0,
});

export function setNightLevel(night: number): void {
  glowMaterial.color.setScalar(0.9 + night * 0.5);
  glassMaterial.emissiveIntensity = night * 0.45;
}

export interface PrimitiveOptions {
  r?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
  glow?: boolean;
  glass?: boolean;
  seg?: number;
  soft?: boolean;
}

const tmpColor = new Color();
const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();

export class GeoBuilder {
  private solid: BufferGeometry[] = [];
  private glow: BufferGeometry[] = [];
  private glass: BufferGeometry[] = [];
  private attachments: Object3D[] = [];
  private transform = new Matrix4();

  at(x: number, z: number, ry: number, fn: () => void, y = 0): void {
    const saved = this.transform.clone();
    const local = new Matrix4().compose(
      tmpPosition.set(x, y, z),
      tmpQuaternion.setFromEuler(tmpEuler.set(0, ry, 0)),
      tmpScale.set(1, 1, 1),
    );
    this.transform.multiply(local);
    fn();
    this.transform.copy(saved);
  }

  private add(geometry: BufferGeometry, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions): void {
    const local = new Matrix4().compose(
      tmpPosition.set(x, y, z),
      tmpQuaternion.setFromEuler(tmpEuler.set(options.rx ?? 0, options.ry ?? 0, options.rz ?? 0)),
      tmpScale.set(options.sx ?? 1, options.sy ?? 1, options.sz ?? 1),
    );
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.deleteAttribute('uv');
    flat.applyMatrix4(this.transform.clone().multiply(local));
    tmpColor.set(color);
    const count = flat.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    flat.setAttribute('color', new Float32BufferAttribute(colors, 3));
    (options.glass ? this.glass : options.glow ? this.glow : this.solid).push(flat);
  }

  box(w: number, h: number, d: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    const radius = options.r ?? 0;
    const geometry = radius > 0
      ? new RoundedBoxGeometry(w, h, d, options.soft ? 3 : 1, Math.min(radius, Math.min(w, h, d) / 2 - 0.001))
      : new BoxGeometry(w, h, d);
    this.add(geometry, color, x, y + h / 2, z, options);
  }

  cyl(radiusTop: number, radiusBottom: number, h: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new CylinderGeometry(radiusTop, radiusBottom, h, options.seg ?? 12), color, x, y + h / 2, z, options);
  }

  cone(radius: number, h: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new ConeGeometry(radius, h, 12), color, x, y + h / 2, z, options);
  }

  sphere(radius: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new SphereGeometry(radius, options.seg ?? 12, Math.max(6, Math.round((options.seg ?? 12) * 0.7))), color, x, y, z, options);
  }

  lathe(profile: [number, number][], color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    const points = profile.map(([radius, height]) => new Vector2(radius, height));
    this.add(new LatheGeometry(points, options.seg ?? 14), color, x, y, z, options);
  }

  ring(radius: number, tube: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new TorusGeometry(radius, tube, 8, options.seg ?? 20), color, x, y, z, { rx: Math.PI / 2, ...options });
  }

  capsule(radius: number, length: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new CapsuleGeometry(radius, length, 4, options.seg ?? 10), color, x, y, z, options);
  }

  blob(radius: number, color: ColorRepresentation, x: number, y: number, z: number, options: PrimitiveOptions = {}): void {
    this.add(new IcosahedronGeometry(radius, 1), color, x, y, z, options);
  }

  attach(object: Object3D, x = 0, y = 0, z = 0): void {
    object.position.set(x, y, z);
    object.updateMatrix();
    object.applyMatrix4(this.transform);
    this.attachments.push(object);
  }

  isEmpty(): boolean {
    return this.solid.length === 0 && this.glow.length === 0 && this.glass.length === 0 && this.attachments.length === 0;
  }

  build(options: { castShadow?: boolean; receiveShadow?: boolean } = {}): Group {
    const group = new Group();
    if (this.solid.length > 0) {
      const merged = mergeGeometries(this.solid, false);
      const mesh = new Mesh(merged, solidMaterial);
      mesh.castShadow = options.castShadow ?? true;
      mesh.receiveShadow = options.receiveShadow ?? true;
      group.add(mesh);
    }
    if (this.glow.length > 0) {
      group.add(new Mesh(mergeGeometries(this.glow, false), glowMaterial));
    }
    if (this.glass.length > 0) {
      const mesh = new Mesh(mergeGeometries(this.glass, false), glassMaterial);
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    for (const geometry of [...this.solid, ...this.glow, ...this.glass]) geometry.dispose();
    this.solid = [];
    this.glow = [];
    this.glass = [];
    if (this.attachments.length > 0) group.add(...this.attachments);
    this.attachments = [];
    return group;
  }
}

export function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | undefined;
    if (!material) return;
    for (const item of Array.isArray(material) ? material : [material]) {
      if (item !== solidMaterial && item !== glassMaterial && (item as unknown) !== glowMaterial && !item.userData.shared) item.dispose();
    }
  });
}
