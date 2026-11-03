import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, type Object3D } from 'three';
import { createRng, range, shuffled, type Rng } from '@shared/random';
import type { Project } from '@shared/types';
import { GeoBuilder } from '../../builder';
import { RoomGrid } from '../../agents/roomgrid';
import { FLOOR_TEXTURE_METERS, floorTexture } from '../floors';
import { CELL, FLOOR_HEIGHT, type Door, type Room } from '../layout';
import { chooseFloor, floorTint, makePalette, type Palette } from '../palette';
import * as P from '../props';
import type { Updater } from '../props/fx';
import { CORRIDOR_PROPS, KITS, type PropSpec } from './kits';
import { STATIONS, type StationKind, type StationScreen } from './stations';

export const INTERACTIVE_LAYER = 1;

export type InteractiveKind = 'docs' | 'pc' | 'chest' | 'board' | 'agent' | StationKind;

export interface Interactive {
  kind: InteractiveKind;
  projectId: string;
  roomId: string;
  floor: number;
  object: Group;
  color: string;
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

type WallSide = 'n' | 's' | 'e' | 'w';

const WALL_MARGIN = 0.24;
const FURNITURE_GAP = 0.22;
const AGENT_CLEARANCE = 0.3;
const WALL_RY: Record<WallSide, number> = { n: 0, s: Math.PI, w: Math.PI / 2, e: -Math.PI / 2 };

export interface Seat {
  x: number;
  y: number;
  z: number;
  ry: number;
}

export interface BuiltRoom {
  room: Room;
  group: Group;
  palette: Palette;
  grid: RoomGrid;
  pois: { x: number; z: number }[];
  doorInner: { x: number; z: number };
  seat: Seat | null;
  seatStand: { x: number; z: number } | null;
  interactives: Interactive[];
  updaters: Updater[];
  screen: ShaderMaterial | null;
  station: { kind: StationKind; screen: StationScreen } | null;
  floorMaterial: MeshStandardMaterial;
  light: { x: number; y: number; z: number };
  center: { x: number; z: number };
}

const SCREEN_VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SCREEN_FRAGMENT = `
  uniform float uTime;
  uniform float uActive;
  uniform vec3 uColor;
  varying vec2 vUv;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec3 base = mix(uColor * 0.32, vec3(0.05, 0.06, 0.1), uActive);
    float rows = 13.0;
    float scroll = uTime * mix(0.0, 1.4, uActive);
    float y = vUv.y * rows + scroll;
    float row = floor(y);
    float band = step(0.3, fract(y)) * step(fract(y), 0.75);
    float len = 0.25 + hash(row * 1.7) * 0.65;
    float indent = 0.06 + floor(hash(row * 3.1) * 4.0) * 0.06;
    float text = band * step(indent, vUv.x) * step(vUv.x, indent + len);
    vec3 ink = mix(uColor, vec3(1.0), hash(row) * 0.4);
    vec3 color = base + text * ink * mix(0.28, 1.5, uActive);
    gl_FragColor = vec4(color, 1.0);
  }
`;

class Placer {
  occupied: Rect[] = [];
  constructor(
    readonly w: number,
    readonly d: number,
    readonly keepouts: Rect[],
  ) {}

  free(rect: Rect): boolean {
    if (rect.minX < WALL_MARGIN - 0.001 || rect.minZ < WALL_MARGIN - 0.001) return false;
    if (rect.maxX > this.w - WALL_MARGIN + 0.001 || rect.maxZ > this.d - WALL_MARGIN + 0.001) return false;
    const hits = (gap: number) => (other: Rect) =>
      rect.minX - gap < other.maxX && other.minX - gap < rect.maxX && rect.minZ - gap < other.maxZ && other.minZ - gap < rect.maxZ;
    return !this.occupied.some(hits(FURNITURE_GAP)) && !this.keepouts.some(hits(0));
  }

  wallCandidate(spec: { w: number; d: number }, side: WallSide, along: number): { x: number; z: number; ry: number; rect: Rect } {
    const horizontal = side === 'n' || side === 's';
    const halfAlong = spec.w / 2;
    const halfDepth = spec.d / 2;
    let x: number;
    let z: number;
    if (horizontal) {
      x = along;
      z = side === 'n' ? WALL_MARGIN + halfDepth : this.d - WALL_MARGIN - halfDepth;
    } else {
      z = along;
      x = side === 'w' ? WALL_MARGIN + halfDepth : this.w - WALL_MARGIN - halfDepth;
    }
    const rect = horizontal
      ? { minX: x - halfAlong, maxX: x + halfAlong, minZ: z - halfDepth, maxZ: z + halfDepth }
      : { minX: x - halfDepth, maxX: x + halfDepth, minZ: z - halfAlong, maxZ: z + halfAlong };
    return { x, z, ry: WALL_RY[side], rect };
  }

  placeOnWall(spec: { w: number; d: number }, rng: Rng, sides: WallSide[], clearance = 0): { x: number; z: number; ry: number; rect: Rect } | null {
    for (const side of sides) {
      const length = side === 'n' || side === 's' ? this.w : this.d;
      const min = WALL_MARGIN + spec.w / 2;
      const max = length - WALL_MARGIN - spec.w / 2;
      if (max < min) continue;
      for (let i = 0; i < 14; i++) {
        const candidate = this.wallCandidate(spec, side, range(rng, min, max));
        if (candidate.rect.maxX > this.w - clearance || candidate.rect.maxZ > this.d - clearance) continue;
        if (this.free(candidate.rect)) return candidate;
      }
    }
    return null;
  }

  placeInCorner(spec: { w: number; d: number }, rng: Rng): { x: number; z: number; ry: number; rect: Rect } | null {
    const corners: [WallSide, number][] = [
      ['n', WALL_MARGIN + spec.w / 2],
      ['n', this.w - WALL_MARGIN - spec.w / 2],
      ['s', WALL_MARGIN + spec.w / 2],
      ['s', this.w - WALL_MARGIN - spec.w / 2],
    ];
    for (const [side, along] of shuffled(rng, corners)) {
      const candidate = this.wallCandidate(spec, side, along);
      if (this.free(candidate.rect)) return candidate;
    }
    return this.placeOnWall(spec, rng, shuffled(rng, ['n', 's', 'w', 'e'] as WallSide[]));
  }

  placeInCenter(spec: { w: number; d: number }, rng: Rng): { x: number; z: number; ry: number; rect: Rect } | null {
    const margin = 1.0;
    for (let i = 0; i < 24; i++) {
      const quarter = Math.floor(rng() * 4);
      const swapped = quarter % 2 === 1;
      const hw = (swapped ? spec.d : spec.w) / 2;
      const hd = (swapped ? spec.w : spec.d) / 2;
      if (this.w - 2 * (margin + hw) < 0 || this.d - 2 * (margin + hd) < 0) continue;
      const x = range(rng, margin + hw, this.w - margin - hw);
      const z = range(rng, margin + hd, this.d - margin - hd);
      const rect = { minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd };
      if (this.free(rect)) return { x, z, ry: (quarter * Math.PI) / 2, rect };
    }
    return null;
  }
}

function floorMesh(room: { w: number; d: number; x: number; z: number }, kind: ReturnType<typeof chooseFloor>, tint: string): Mesh {
  const width = room.w * CELL;
  const depth = room.d * CELL;
  const geometry = new PlaneGeometry(width, depth);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * width) / FLOOR_TEXTURE_METERS, (uv.getY(i) * depth) / FLOOR_TEXTURE_METERS);
  }
  geometry.rotateX(-Math.PI / 2);
  const texture = floorTexture(kind);
  const material = new MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: 0xffffff, emissiveIntensity: 0, color: tint, roughness: kind === 'tile' ? 0.35 : 0.85 });
  const mesh = new Mesh(geometry, material);
  mesh.position.set(width / 2, 0, depth / 2);
  mesh.receiveShadow = true;
  return mesh;
}

function setInteractiveLayer(object: Object3D): void {
  object.traverse((node) => node.layers.enable(INTERACTIVE_LAYER));
}

function buildWith(build: P.PropBuild, c: Palette, rng: Rng): Group {
  const b = new GeoBuilder();
  build({ b, c, rng, fx: [] });
  return b.build();
}

function buildPc(c: Palette, rng: Rng): { group: Group; screen: ShaderMaterial } {
  const group = buildWith(P.desk, c, rng);
  const screen = new ShaderMaterial({
    vertexShader: SCREEN_VERTEX,
    fragmentShader: SCREEN_FRAGMENT,
    uniforms: { uTime: { value: 0 }, uActive: { value: 0 }, uColor: { value: null } },
  });
  screen.uniforms.uColor!.value = new MeshStandardMaterial({ color: c.accent }).color;
  const plane = new Mesh(new PlaneGeometry(0.94, 0.54), screen);
  plane.position.set(0, 1.31, -0.715);
  group.add(plane);
  return { group, screen };
}

const FRONT_OFFSET = 0.6;

function worldFront(room: Room, placed: { x: number; z: number; ry: number }, distance: number): { x: number; z: number } {
  return {
    x: room.x * CELL + placed.x + Math.sin(placed.ry) * distance,
    z: room.z * CELL + placed.z + Math.cos(placed.ry) * distance,
  };
}

export function doorInnerPoint(room: Room, door: Door): { x: number; z: number } {
  const inside = 0.9;
  if (door.axis === 'x') {
    return { x: door.x, z: door.z + (room.doorSide === 's' ? -inside : inside) };
  }
  return { x: door.x - inside, z: door.z };
}

export function buildRoom(room: Room, doors: Door[], project: Project | null): BuiltRoom {
  const rng = createRng(room.seed);
  const palette = makePalette(rng, project?.color ?? null, room.type);
  const width = room.w * CELL;
  const depth = room.d * CELL;
  const originX = room.x * CELL;
  const originZ = room.z * CELL;

  const group = new Group();
  group.position.set(originX, 0, originZ);

  const floorKind = chooseFloor(rng, room.type);
  const floor = floorMesh(room, floorKind, floorTint(rng, floorKind, palette));
  group.add(floor);

  const ownDoors = doors.filter((d) => d.a === room.id);
  const keepouts: Rect[] = ownDoors.map((door) => {
    const lx = door.x - originX;
    const lz = door.z - originZ;
    if (door.axis === 'x') return { minX: lx - 1.15, maxX: lx + 1.15, minZ: lz - 1.6, maxZ: lz + 1.6 };
    return { minX: lx - 1.6, maxX: lx + 1.6, minZ: lz - 1.15, maxZ: lz + 1.15 };
  });
  const placer = new Placer(width, depth, keepouts);

  const grid = new RoomGrid(originX, originZ, width, depth);
  grid.block(originX, originZ, originX + width, originZ + 0.5);
  grid.block(originX, originZ + depth - 0.5, originX + width, originZ + depth);
  grid.block(originX, originZ, originX + 0.5, originZ + depth);
  grid.block(originX + width - 0.5, originZ, originX + width, originZ + depth);

  const roomDoor = ownDoors.find((d) => d.b !== null) ?? ownDoors[0];
  const doorInner = roomDoor ? doorInnerPoint(room, roomDoor) : { x: originX + width / 2, z: originZ + depth / 2 };
  const interactives: Interactive[] = [];
  const pois: { x: number; z: number }[] = [];
  const updaters: Updater[] = [];
  const mustReach: { x: number; z: number }[] = [];
  let seat: Seat | null = null;
  let seatStand: { x: number; z: number } | null = null;
  let screen: ShaderMaterial | null = null;

  const blockRect = (rect: Rect) =>
    grid.block(
      originX + rect.minX - AGENT_CLEARANCE,
      originZ + rect.minZ - AGENT_CLEARANCE,
      originX + rect.maxX + AGENT_CLEARANCE,
      originZ + rect.maxZ + AGENT_CLEARANCE,
    );

  const commit = (rect: Rect): boolean => {
    const undo = blockRect(rect);
    const ok = mustReach.every((point) => grid.connected(doorInner.x, doorInner.z, point.x, point.z));
    if (!ok) {
      undo();
      return false;
    }
    placer.occupied.push(rect);
    return true;
  };

  const backFirst: WallSide[] = ['n', 'w', 'e', 's'];
  const addInteractive = (kind: InteractiveKind, object: Group, w: number, d: number, sides: WallSide[], clearance = 0) => {
    const placed =
      placer.placeOnWall({ w, d }, rng, sides, clearance) ?? placer.placeOnWall({ w, d }, rng, sides) ?? placer.placeOnWall({ w, d }, rng, ['n', 's', 'w', 'e']);
    if (!placed) return null;
    blockRect(placed.rect);
    placer.occupied.push(placed.rect);
    object.position.set(placed.x, 0, placed.z);
    object.rotation.y = placed.ry;
    setInteractiveLayer(object);
    group.add(object);
    const stand = worldFront(room, placed, d / 2 + FRONT_OFFSET);
    mustReach.push(stand);
    pois.push(stand);
    interactives.push({ kind, projectId: project?.id ?? '', roomId: room.id, floor: room.floor, object, color: project?.color ?? palette.accent });
    return { placed, stand };
  };

  const stationSpec = STATIONS[room.type];
  let station: BuiltRoom['station'] = null;
  if (stationSpec) {
    const built = stationSpec.build(palette, rng, stationSpec.accent);
    if (addInteractive(stationSpec.kind, built.object, stationSpec.w, stationSpec.d, backFirst)) {
      station = { kind: stationSpec.kind, screen: built.screen };
    }
  }

  if (project) {
    const pc = buildPc(palette, rng);
    const pcPlaced = addInteractive('pc', pc.group, 2.0, 1.9, backFirst.slice(0, 2));
    screen = pc.screen;
    if (pcPlaced) {
      const seatWorld = worldFront(room, pcPlaced.placed, P.DESK_SEAT_OFFSET);
      seat = { x: seatWorld.x, y: 0.49, z: seatWorld.z, ry: pcPlaced.placed.ry + Math.PI };
      seatStand = pcPlaced.stand;
      updaters.push((time) => {
        pc.screen.uniforms.uTime!.value = time;
      });
    }
    addInteractive('docs', buildWith(P.docCabinet, palette, rng), 1.66, 0.8, backFirst);
    addInteractive('chest', buildWith(P.treasureChest, palette, rng), 1.34, 0.82, backFirst, 1.3);
    addInteractive('board', buildWith(P.corkBoard, palette, rng), 1.5, 0.42, backFirst);
  }

  const b = new GeoBuilder();
  const ctx: P.PropContext = { b, c: palette, rng, fx: updaters };

  const kit = KITS[room.type];
  const order = [...kit].sort((p, q) => weight(p) - weight(q));
  let budget = Math.max(2, Math.floor((width * depth) / (project ? 9 : 6)));
  for (const spec of order) {
    if (spec.chance !== undefined && rng() > spec.chance) continue;
    const free = spec.place === 'floor' || spec.place === 'ceiling';
    if (!free && budget <= 0) continue;
    const done = placeProp(spec, placer, rng, b, ctx, width, depth, commit, (placed) => {
      if (spec.poi) pois.push(worldFront(room, placed, Math.max(spec.d / 2, 0.3) + FRONT_OFFSET));
    });
    if (done && !free) budget--;
  }

  const decor = b.isEmpty() ? null : b.build();
  if (decor) group.add(decor);

  const reachablePois = pois.filter((poi) => grid.connected(doorInner.x, doorInner.z, poi.x, poi.z));
  if (reachablePois.length === 0) reachablePois.push(doorInner);

  return {
    room,
    group,
    palette,
    grid,
    pois: reachablePois,
    doorInner,
    seat,
    seatStand,
    interactives,
    updaters,
    screen,
    station,
    floorMaterial: floor.material as MeshStandardMaterial,
    light: { x: originX + width / 2, y: room.floor * FLOOR_HEIGHT + 2.5, z: originZ + depth / 2 },
    center: { x: originX + width / 2, z: originZ + depth / 2 },
  };
}

function weight(spec: PropSpec): number {
  if (spec.place === 'floor' || spec.place === 'ceiling') return 0;
  return spec.w * spec.d > 1.5 ? 1 : 2;
}

function placeProp(
  spec: PropSpec,
  placer: Placer,
  rng: Rng,
  b: GeoBuilder,
  ctx: P.PropContext,
  width: number,
  depth: number,
  commit: (rect: Rect) => boolean,
  onPlaced: (placed: { x: number; z: number; ry: number }) => void,
): boolean {
  if (spec.place === 'floor') {
    if (spec.w > width - 0.8 || spec.d > depth - 0.8) return false;
    b.at(width / 2 + range(rng, -0.4, 0.4), depth / 2 + range(rng, -0.4, 0.4), 0, () => spec.build(ctx));
    return true;
  }
  if (spec.place === 'ceiling') {
    b.at(width / 2, depth / 2, 0, () => spec.build(ctx));
    return true;
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    let placed: ReturnType<Placer['placeOnWall']>;
    if (spec.place === 'wall') placed = placer.placeOnWall(spec, rng, [...shuffled(rng, ['n', 'w'] as WallSide[]), ...shuffled(rng, ['e', 's'] as WallSide[])]);
    else if (spec.place === 'corner') placed = placer.placeInCorner(spec, rng);
    else placed = placer.placeInCenter(spec, rng);
    if (!placed) return false;
    if (!commit(placed.rect)) continue;
    const { x, z, ry } = placed;
    b.at(x, z, ry, () => spec.build(ctx));
    onPlaced(placed);
    return true;
  }
  return false;
}

export function buildCorridor(corridor: { x: number; z: number; w: number; d: number; floor: number }, doors: Door[], seed: number): { group: Group; updaters: Updater[] } {
  const rng = createRng(seed);
  const palette = makePalette(rng, null, 'couloir');
  const width = corridor.w * CELL;
  const depth = corridor.d * CELL;
  const group = new Group();
  const originX = corridor.x * CELL;
  const originZ = corridor.z * CELL;
  group.position.set(originX, 0, originZ);

  const kind = chooseFloor(rng, 'couloir');
  group.add(floorMesh(corridor, kind, floorTint(rng, kind, palette)));

  const b = new GeoBuilder();
  const updaters: Updater[] = [];
  const ctx: P.PropContext = { b, c: palette, rng, fx: updaters };
  const horizontal = width >= depth;
  if (horizontal) b.box(width - 1.2, 0.025, 1.05, palette.accentSoft, width / 2, 0, depth / 2);
  else b.box(1.05, 0.025, depth - 1.2, palette.accentSoft, width / 2, 0, depth / 2);

  if (horizontal) {
    const nearDoor = (x: number, z: number) =>
      doors.some((door) => door.axis === 'x' && Math.abs(door.z - (originZ + z)) < 0.1 && Math.abs(door.x - (originX + x)) < 1.5);

    let x = 1.5;
    while (x < width - 1) {
      const north = rng() > 0.5;
      const wallZ = north ? 0 : depth;
      const spec = CORRIDOR_PROPS[Math.floor(rng() * CORRIDOR_PROPS.length)] as PropSpec;
      const halfSpan = spec.w / 2 + 0.5;
      if (!nearDoor(x - halfSpan + 0.5, wallZ) && !nearDoor(x + halfSpan - 0.5, wallZ) && !nearDoor(x, wallZ)) {
        const z = north ? 0.24 + spec.d / 2 : depth - 0.24 - spec.d / 2;
        b.at(x, z, north ? 0 : Math.PI, () => spec.build(ctx));
      }
      x += 2.2 + rng() * 2.2;
    }
  }
  group.add(b.build());
  return { group, updaters };
}
