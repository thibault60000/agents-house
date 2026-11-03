import { Group } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { ROOM_LABELS, type Project } from '@shared/types';
import { disposeTree, GeoBuilder } from '../builder';
import { CELL, DOOR_WIDTH, generateLayout, type Layout, type Wall } from './layout';
import type { Updater } from './props/fx';
import { buildCorridor, buildRoom, type BuiltRoom, type Interactive } from './rooms/room';
import type { ScreenData, StationKind } from './rooms/stations';

const EXTERIOR_THICKNESS = 0.38;
const INTERIOR_THICKNESS = 0.14;
const FACADE = '#fbf8f2';
const FRAME = '#26282e';
export const HEIGHT_FULL = 3.0;
export const HEIGHT_MID = 1.25;
export const HEIGHT_LOW = 0.5;

type Normal = 'n' | 's' | 'e' | 'w';
const NORMALS: Record<Normal, [number, number]> = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

interface Facade {
  walls: Group;
  decor: Group;
}

interface FloorParts {
  index: number;
  group: Group;
  interior: Group;
  facades: Record<Normal, Facade>;
  tags: CSS2DObject[];
}

export interface BuiltHouse {
  group: Group;
  layout: Layout;
  rooms: Map<string, BuiltRoom>;
  roomByProject: Map<string, BuiltRoom>;
  interactives: Interactive[];
  update(time: number, dt: number): void;
  setView(azimuth: number, activeFloor: number): void;
  setScreen(kind: StationKind, data: ScreenData): void;
  dispose(): void;
}

interface WallSegment {
  start: number;
  end: number;
  startsAtDoor: boolean;
  endsAtDoor: boolean;
}

function wallSegments(wall: Wall, layout: Layout): WallSegment[] {
  const horizontal = wall.axis === 'x';
  const start = horizontal ? wall.x1 : wall.z1;
  const end = horizontal ? wall.x2 : wall.z2;
  const line = horizontal ? wall.z1 : wall.x1;
  const openings = layout.doors
    .filter((d) => d.floor === wall.floor && d.axis === wall.axis && (horizontal ? d.z === line : d.x === line))
    .map((d) => (horizontal ? d.x : d.z))
    .filter((p) => p > start && p < end)
    .sort((a, b) => a - b);
  const segments: WallSegment[] = [];
  let cursor = start;
  let afterDoor = false;
  for (const opening of openings) {
    segments.push({ start: cursor, end: opening - DOOR_WIDTH / 2, startsAtDoor: afterDoor, endsAtDoor: true });
    cursor = opening + DOOR_WIDTH / 2;
    afterDoor = true;
  }
  segments.push({ start: cursor, end, startsAtDoor: afterDoor, endsAtDoor: false });
  return segments.filter((s) => s.end - s.start > 0.01);
}

function isInterior(wall: Wall): boolean {
  return wall.low !== null && wall.high !== null;
}

function junctionOffset(wall: Wall, position: number, layout: Layout): number {
  const horizontal = wall.axis === 'x';
  const line = horizontal ? wall.z1 : wall.x1;
  const crossing = layout.walls.filter((other) => {
    if (other.floor !== wall.floor || other.axis === wall.axis) return false;
    if (horizontal) return other.x1 === position && other.z1 <= line && other.z2 >= line;
    return other.z1 === position && other.x1 <= line && other.x2 >= line;
  });
  if (crossing.length === 0) return 0;
  const exteriorCross = crossing.some((other) => !isInterior(other));
  const half = (exteriorCross ? EXTERIOR_THICKNESS : INTERIOR_THICKNESS) / 2;
  const mineExterior = !isInterior(wall);
  if (mineExterior !== exteriorCross) return mineExterior ? 0 : -half;
  return horizontal ? half : -half;
}

function normalOf(wall: Wall): Normal {
  if (wall.axis === 'x') return wall.low === null ? 'n' : 's';
  return wall.low === null ? 'w' : 'e';
}

export interface HouseOptions {
  projects: Project[];
  rootName: string;
  seed: number;
}

export function buildHouse({ projects, seed }: HouseOptions): BuiltHouse {
  const layout = generateLayout(
    projects.map((p) => ({ id: p.id, path: p.path, seed: p.seed, category: p.category, ...(p.roomType ? { roomType: p.roomType } : {}) })),
    seed,
  );
  const byId = new Map(projects.map((p) => [p.id, p]));

  const group = new Group();
  const rooms = new Map<string, BuiltRoom>();
  const roomByProject = new Map<string, BuiltRoom>();
  const interactives: Interactive[] = [];
  const updaters: Updater[] = [];
  const floors: FloorParts[] = [];

  for (let index = 0; index < layout.floors; index++) {
    const floorGroup = new Group();
    const interior = new Group();
    floorGroup.add(interior);
    const makeFacade = (): Facade => {
      const facade: Facade = { walls: new Group(), decor: new Group() };
      floorGroup.add(facade.walls, facade.decor);
      return facade;
    };
    floors.push({ index, group: floorGroup, interior, tags: [], facades: { n: makeFacade(), s: makeFacade(), e: makeFacade(), w: makeFacade() } });
    group.add(floorGroup);
  }

  for (const room of layout.rooms) {
    const parts = floors[room.floor] as FloorParts;
    const project = room.projectId ? (byId.get(room.projectId) ?? null) : null;
    const built = buildRoom(room, layout.doors, project);
    rooms.set(room.id, built);
    if (room.projectId) roomByProject.set(room.projectId, built);
    interactives.push(...built.interactives);
    updaters.push(...built.updaters);
    parts.interior.add(built.group);

    const labelled = project ?? (built.interactives.length > 0 ? { name: ROOM_LABELS[room.type], color: built.palette.accent } : null);
    if (labelled) {
      const element = document.createElement('div');
      element.className = 'room-tag';
      const dot = document.createElement('span');
      dot.className = 'room-tag-dot';
      dot.style.background = labelled.color;
      element.append(dot, document.createTextNode(labelled.name));
      const tag = new CSS2DObject(element);
      tag.position.set(room.x * CELL + 1.4, HEIGHT_MID + 0.5, room.z * CELL + 0.6);
      tag.center.set(0, 1);
      parts.interior.add(tag);
      parts.tags.push(tag);
    }
  }

  for (const [index, corridor] of layout.corridors.entries()) {
    const parts = floors[corridor.floor] as FloorParts;
    const built = buildCorridor(corridor, layout.doors, (seed ^ ((index + 1) * 7919)) >>> 0);
    parts.interior.add(built.group);
    updaters.push(...built.updaters);
  }

  const paletteOf = (id: string | null): string | null => (id ? (rooms.get(id)?.palette.wall ?? '#f4ecdf') : null);

  for (const parts of floors) {
    const interiorWalls = new GeoBuilder();
    const frames = new GeoBuilder();
    const facadeWalls: Record<Normal, GeoBuilder> = { n: new GeoBuilder(), s: new GeoBuilder(), e: new GeoBuilder(), w: new GeoBuilder() };
    const facadeDecor: Record<Normal, GeoBuilder> = { n: new GeoBuilder(), s: new GeoBuilder(), e: new GeoBuilder(), w: new GeoBuilder() };

    for (const wall of layout.walls.filter((w) => w.floor === parts.index)) {
      const interiorWall = wall.low !== null && wall.high !== null;
      const normal = interiorWall ? null : normalOf(wall);
      const target = normal ? facadeWalls[normal] : interiorWalls;
      const lowColor = paletteOf(wall.low) ?? FACADE;
      const highColor = paletteOf(wall.high) ?? FACADE;
      const thickness = interiorWall ? INTERIOR_THICKNESS : EXTERIOR_THICKNESS;
      const half = thickness / 2;
      const line = wall.axis === 'x' ? wall.z1 : wall.x1;

      for (const segment of wallSegments(wall, layout)) {
        const from = segment.start - (segment.startsAtDoor ? 0 : junctionOffset(wall, segment.start, layout));
        const to = segment.end + (segment.endsAtDoor ? 0 : junctionOffset(wall, segment.end, layout));
        const length = to - from;
        const mid = (from + to) / 2;
        if (wall.axis === 'x') {
          target.box(length, 1, half, lowColor, mid, 0, line - half / 2);
          target.box(length, 1, half, highColor, mid, 0, line + half / 2);
        } else {
          target.box(half, 1, length, lowColor, line - half / 2, 0, mid);
          target.box(half, 1, length, highColor, line + half / 2, 0, mid);
        }
        if (normal) addWindows(facadeDecor[normal], segment.start, segment.end, line, wall.axis);
      }
    }

    for (const door of layout.doors.filter((d) => d.floor === parts.index)) {
      const exterior = door.b === null;
      const height = exterior ? 2.3 : HEIGHT_MID + 0.04;
      const offset = DOOR_WIDTH / 2 + 0.02;
      const depth = (exterior ? EXTERIOR_THICKNESS : INTERIOR_THICKNESS) + 0.05;
      if (door.axis === 'x') {
        for (const sign of [-1, 1]) frames.box(0.07, height, depth, FRAME, door.x + sign * offset, 0, door.z);
        frames.box(DOOR_WIDTH, 0.035, depth, '#9c6a45', door.x, 0, door.z);
      } else {
        for (const sign of [-1, 1]) frames.box(depth, height, 0.07, FRAME, door.x, 0, door.z + sign * offset);
        frames.box(depth, 0.035, DOOR_WIDTH, '#9c6a45', door.x, 0, door.z);
      }
      if (exterior) {
        facadeDecor.w.box(depth, 0.1, DOOR_WIDTH + 0.14, FRAME, door.x, 2.3, door.z);
        facadeDecor.w.box(EXTERIOR_THICKNESS, HEIGHT_FULL - 2.4, DOOR_WIDTH, FACADE, door.x, 2.4, door.z);
        frames.box(DOOR_WIDTH - 0.08, 2.2, 0.05, FRAME, door.x + DOOR_WIDTH / 2, 0.04, door.z - DOOR_WIDTH / 2 + 0.03);
        frames.box(DOOR_WIDTH - 0.3, 1.9, 0.06, '#8fa8b0', door.x + DOOR_WIDTH / 2, 0.18, door.z - DOOR_WIDTH / 2 + 0.03, { glass: true });
      }
    }

    const interiorMesh = interiorWalls.build();
    interiorMesh.scale.y = HEIGHT_MID;
    parts.interior.add(interiorMesh);
    parts.interior.add(frames.build());
    for (const normal of Object.keys(NORMALS) as Normal[]) {
      const facade = parts.facades[normal];
      if (!facadeWalls[normal].isEmpty()) facade.walls.add(facadeWalls[normal].build());
      if (!facadeDecor[normal].isEmpty()) facade.decor.add(facadeDecor[normal].build());
    }
  }

  return {
    group,
    layout,
    rooms,
    roomByProject,
    interactives,
    update(time, dt) {
      for (const update of updaters) update(time, dt);
    },
    setView(azimuth, activeFloor) {
      const camX = Math.sin(azimuth);
      const camZ = Math.cos(azimuth);
      for (const parts of floors) {
        const isActive = parts.index === activeFloor;
        parts.group.visible = isActive;
        for (const tag of parts.tags) tag.visible = isActive;
        for (const normal of Object.keys(NORMALS) as Normal[]) {
          const [nx, nz] = NORMALS[normal];
          const facing = nx * camX + nz * camZ;
          const t = Math.min(1, Math.max(0, (0.25 - facing) / 0.5));
          const height = HEIGHT_LOW + (HEIGHT_FULL - HEIGHT_LOW) * t * t * (3 - 2 * t);
          const facade = parts.facades[normal];
          facade.walls.scale.y = height;
          facade.decor.visible = height > 2.5;
        }
      }
    },
    setScreen(kind, data) {
      for (const room of rooms.values()) {
        if (room.station?.kind === kind) room.station.screen.draw(data);
      }
    },
    dispose() {
      for (const room of rooms.values()) room.station?.screen.dispose();
      for (const parts of floors) {
        for (const tag of parts.tags) tag.element.remove();
      }
      disposeTree(group);
    },
  };
}

function addWindows(b: GeoBuilder, start: number, end: number, line: number, axis: 'x' | 'z'): void {
  const length = end - start;
  const count = Math.floor(length / 3);
  if (count < 1) return;
  const spacing = length / count;
  const width = Math.min(2.3, spacing - 0.5);
  const bottom = 0.5;
  const height = 2.0;
  const depth = EXTERIOR_THICKNESS + 0.04;
  const bar = 0.08;
  const place = (along: number, y: number, w: number, h: number, d: number, color: string, glass = false) => {
    if (axis === 'x') b.box(w, h, d, color, along, y, line, { glass });
    else b.box(d, h, w, color, line, y, along, { glass });
  };
  for (let i = 0; i < count; i++) {
    const p = start + (i + 0.5) * spacing;
    place(p, bottom, width - bar, height - bar, depth - 0.02, '#8fa8b0', true);
    place(p - width * 0.2, bottom + height * 0.45, width * 0.22, height * 0.5, depth - 0.01, '#b9ccd2', true);
    place(p - width / 2, bottom, bar, height, depth, FRAME);
    place(p + width / 2, bottom, bar, height, depth, FRAME);
    place(p, bottom - bar / 2, width + bar, bar, depth, FRAME);
    place(p, bottom + height - bar / 2, width + bar, bar, depth, FRAME);
    place(p, bottom, bar * 0.7, height, depth + 0.01, FRAME);
  }
}
