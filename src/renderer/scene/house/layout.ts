import { createRng, hashString, shuffled, type Rng } from '@shared/random';
import type { ProjectCategory, ProjectRoomType, RoomType, ServiceRoomType } from '@shared/types';
import { PROJECT_ROOM_TYPES } from '@shared/types';

export const CELL = 3;
export const FLOOR_HEIGHT = 3.4;
export const DOOR_WIDTH = 1.5;

const COLUMN_WIDTH = 3;
const SPINE_WIDTH = 1;
const ROW_DEPTH = 2;
const WING_DEPTH = ROW_DEPTH * 2 + 1;
const MIN_ROW_LENGTH = 6;
const LOGISTICS_DEPTH = 2;
const HALL_DEPTH = 3;
const GARAGE_DEPTH = 2;

const SERVICE_EVERY = 6;

export interface LayoutProject {
  id: string;
  path: string;
  seed?: number;
  roomType?: ProjectRoomType;
  category?: ProjectCategory;
}

export type Side = 'n' | 's' | 'e' | 'w';

export interface Room {
  id: string;
  type: RoomType;
  projectId: string | null;
  floor: number;
  x: number;
  z: number;
  w: number;
  d: number;
  doorSide: Side;
  seed: number;
}

export interface Corridor {
  id: string;
  floor: number;
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface Door {
  id: string;
  floor: number;
  x: number;
  z: number;
  axis: 'x' | 'z';
  a: string;
  b: string | null;
}

export interface Wall {
  floor: number;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  axis: 'x' | 'z';
  low: string | null;
  high: string | null;
}

export type NavNodeKind = 'room' | 'door' | 'corridor';

export interface NavNode {
  id: string;
  kind: NavNodeKind;
  floor: number;
  x: number;
  z: number;
  roomId: string | null;
}

export interface NavEdge {
  a: string;
  b: string;
  cost: number;
}

export interface NavGraph {
  nodes: NavNode[];
  edges: NavEdge[];
}

export interface Layout {
  rooms: Room[];
  corridors: Corridor[];
  doors: Door[];
  walls: Wall[];
  navGraph: NavGraph;
  floors: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  entrance: { x: number; z: number };
}

const ROOM_WIDTHS: Record<RoomType, number> = {
  bureau: 2,
  salon: 3,
  cuisine: 3,
  'salle-a-manger': 3,
  chambre: 2,
  atelier: 2,
  bibliotheque: 2,
  cellier: 2,
  garage: 3,
  logistique: 3,
  veranda: 3,
  grenier: 3,
  'salle-de-jeux': 3,
  couloir: 1,
  entree: 3,
  'salle-de-bain': 1,
  wc: 1,
  buanderie: 2,
};

const COMPACT_ROOMS = new Set<RoomType>(['salle-de-bain', 'wc']);

const CATEGORY_PREFERENCE: Record<ProjectCategory, ProjectRoomType[]> = {
  game: ['salle-de-jeux', 'salon', 'atelier'],
  data: ['bibliotheque', 'bureau', 'cellier'],
  web: ['bureau', 'salon', 'veranda'],
  infra: ['atelier', 'cellier', 'bureau'],
  docs: ['bibliotheque', 'chambre', 'grenier'],
  generic: [],
};

const MAX_PER_FLOOR: Partial<Record<ProjectRoomType, number>> = {
  cuisine: 1,
  'salle-a-manger': 1,
  veranda: 1,
  salon: 1,
  'salle-de-jeux': 1,
  grenier: 1,
};

function allowed(type: ProjectRoomType, counts: Map<RoomType, number>): boolean {
  if (type === 'grenier') return false;
  const count = counts.get(type) ?? 0;
  const max = MAX_PER_FLOOR[type] ?? 2;
  return count < max;
}

function chooseType(project: LayoutProject, rng: Rng, counts: Map<RoomType, number>): ProjectRoomType {
  if (project.roomType && PROJECT_ROOM_TYPES.includes(project.roomType)) return project.roomType;
  const preferred = CATEGORY_PREFERENCE[project.category ?? 'generic'];
  const order = [...preferred, ...shuffled(rng, PROJECT_ROOM_TYPES)];
  for (const type of order) {
    if (allowed(type, counts)) return type;
  }
  return 'bureau';
}

function projectSeed(project: LayoutProject, seed: number): number {
  return ((project.seed ?? hashString(project.path)) ^ seed) >>> 0;
}

interface RoomDraft {
  type: RoomType;
  projectId: string | null;
  seed: number;
  width: number;
}

class Builder {
  rooms: Room[] = [];
  corridors: Corridor[] = [];
  private roomIndex = 0;

  add(draft: RoomDraft, floor: number, x: number, z: number, w: number, d: number, doorSide: Side): Room {
    const room: Room = { id: `r${this.roomIndex++}`, type: draft.type, projectId: draft.projectId, floor, x, z, w, d, doorSide, seed: draft.seed };
    this.rooms.push(room);
    return room;
  }
}

function chooseWings(totalWidth: number, columnFill: (wings: number) => number): number {
  let best = 1;
  let bestScore = Infinity;
  for (let wings = 1; wings <= 12; wings++) {
    const remaining = Math.max(0, totalWidth - columnFill(wings));
    const length = Math.max(MIN_ROW_LENGTH, Math.ceil(remaining / (2 * wings)));
    const width = COLUMN_WIDTH + SPINE_WIDTH + length;
    const depth = WING_DEPTH * wings;
    const score = Math.abs(Math.log(width / depth));
    if (score < bestScore) {
      best = wings;
      bestScore = score;
    }
  }
  return best;
}

function fillRows(drafts: RoomDraft[], rows: number): RoomDraft[][] {
  const total = drafts.reduce((sum, draft) => sum + draft.width, 0);
  const out: RoomDraft[][] = Array.from({ length: rows }, () => []);
  let cumulative = 0;
  let row = 0;
  drafts.forEach((draft, index) => {
    const remainingDrafts = drafts.length - index;
    const remainingRows = rows - row - 1;
    const target = ((row + 1) * total) / rows;
    const current = out[row] as RoomDraft[];
    const overshoots = cumulative + draft.width / 2 > target;
    if (current.length > 0 && remainingRows > 0 && (overshoots || remainingDrafts <= remainingRows)) row++;
    (out[row] as RoomDraft[]).push(draft);
    cumulative += draft.width;
  });
  return out;
}

function stretchRow(row: RoomDraft[], length: number): number[] {
  const widths = row.map((draft) => draft.width);
  let extra = length - widths.reduce((sum, width) => sum + width, 0);
  const candidates = row.flatMap((draft, index) => (COMPACT_ROOMS.has(draft.type) ? [] : [index]));
  const stretchable = candidates.length > 0 ? candidates : row.map((_, index) => index);
  while (extra > 0 && stretchable.length > 0) {
    let narrowest = stretchable[0] as number;
    for (const index of stretchable) {
      if ((widths[index] as number) < (widths[narrowest] as number)) narrowest = index;
    }
    widths[narrowest] = (widths[narrowest] as number) + 1;
    extra--;
  }
  return widths;
}

function layWings(builder: Builder, floor: number, rows: RoomDraft[][], wings: number, minimumLength: number): void {
  const originX = COLUMN_WIDTH + SPINE_WIDTH;
  const longest = rows.reduce((max, row) => Math.max(max, row.reduce((sum, draft) => sum + draft.width, 0)), 0);
  const length = Math.max(minimumLength, longest);
  for (let wing = 0; wing < wings; wing++) {
    const top = wing * WING_DEPTH;
    const corridorZ = top + ROW_DEPTH;
    builder.corridors.push({ id: `c${floor}`, floor, x: originX, z: corridorZ, w: length, d: 1 });
    for (const side of ['n', 's'] as const) {
      const row = rows[wing * 2 + (side === 'n' ? 0 : 1)] ?? [];
      const widths = stretchRow(row, length);
      let x = originX;
      row.forEach((draft, index) => {
        const w = widths[index] as number;
        builder.add(draft, floor, x, side === 'n' ? top : corridorZ + 1, w, ROW_DEPTH, side === 'n' ? 's' : 'n');
        x += w;
      });
    }
  }
  builder.corridors.push({ id: `c${floor}`, floor, x: COLUMN_WIDTH, z: 0, w: SPINE_WIDTH, d: wings * WING_DEPTH });
}

export function generateLayout(projects: readonly LayoutProject[], seed = 1): Layout {
  const builder = new Builder();

  const counts = new Map<RoomType, number>();
  const drafts: RoomDraft[] = [];
  let total = 0;
  for (const project of projects) {
    const pSeed = projectSeed(project, seed);
    const type = chooseType(project, createRng(pSeed), counts);
    counts.set(type, (counts.get(type) ?? 0) + 1);
    drafts.push({ type, projectId: project.id, seed: pSeed, width: ROOM_WIDTHS[type] });
    total++;
    if (total % SERVICE_EVERY === 0) drafts.push(...serviceBlock(seed, total));
  }
  if (total < SERVICE_EVERY) drafts.push(...serviceBlock(seed, total + 1));

  const fixedDepth = LOGISTICS_DEPTH + HALL_DEPTH + GARAGE_DEPTH;
  const totalWidth = drafts.reduce((sum, draft) => sum + draft.width, 0);

  const columnFill = (wings: number) => (Math.max(0, wings * WING_DEPTH - fixedDepth) / ROW_DEPTH) * 2.5;
  const wings = chooseWings(totalWidth, columnFill);
  const height = wings * WING_DEPTH;

  const logistics: RoomDraft = { type: 'logistique', projectId: null, seed: (seed ^ 0x106157) >>> 0, width: COLUMN_WIDTH };
  builder.add(logistics, 0, 0, 0, COLUMN_WIDTH, LOGISTICS_DEPTH, 'e');
  const hall: Room = {
    id: 'hall',
    type: 'entree',
    projectId: null,
    floor: 0,
    x: 0,
    z: LOGISTICS_DEPTH,
    w: COLUMN_WIDTH,
    d: HALL_DEPTH,
    doorSide: 'e',
    seed: (seed ^ 0x51ed) >>> 0,
  };
  builder.rooms.push(hall);
  const garage: RoomDraft = { type: 'garage', projectId: null, seed: (seed ^ 0x6a4a6e) >>> 0, width: COLUMN_WIDTH };
  let cursorZ = LOGISTICS_DEPTH + HALL_DEPTH;
  const garageDepth = height - cursorZ - GARAGE_DEPTH === 1 ? GARAGE_DEPTH + 1 : GARAGE_DEPTH;
  builder.add(garage, 0, 0, cursorZ, COLUMN_WIDTH, garageDepth, 'e');
  cursorZ += garageDepth;

  const remaining = [...drafts];
  while (height - cursorZ >= ROW_DEPTH) {
    const index = remaining.findIndex((draft) => draft.projectId !== null);
    const draft = index >= 0 ? (remaining.splice(index, 1)[0] as RoomDraft) : null;
    const left = height - cursorZ;
    const depth = left === ROW_DEPTH + 1 ? left : ROW_DEPTH;
    builder.add(draft ?? { type: 'buanderie', projectId: null, seed: (seed ^ (cursorZ * 131)) >>> 0, width: COLUMN_WIDTH }, 0, 0, cursorZ, COLUMN_WIDTH, depth, 'e');
    cursorZ += depth;
  }

  const rows = fillRows(remaining, wings * 2);
  rows.forEach((row, index) => {
    if (row.length === 0) row.push({ type: 'buanderie', projectId: null, seed: (seed ^ ((index + 1) * 257)) >>> 0, width: ROOM_WIDTHS.buanderie });
  });
  layWings(builder, 0, rows, wings, MIN_ROW_LENGTH);

  const walls = computeWalls(builder.rooms, builder.corridors, 1);
  const doors = computeDoors(builder.rooms, builder.corridors, hall);
  const navGraph = computeNavGraph(builder.rooms, builder.corridors, doors);
  const entrance = { x: 0, z: (hall.z + hall.d / 2) * CELL };

  const areas = [...builder.rooms, ...builder.corridors];
  const bounds = {
    minX: Math.min(...areas.map((r) => r.x)) * CELL,
    maxX: Math.max(...areas.map((r) => r.x + r.w)) * CELL,
    minZ: Math.min(...areas.map((r) => r.z)) * CELL,
    maxZ: Math.max(...areas.map((r) => r.z + r.d)) * CELL,
  };

  return { rooms: builder.rooms, corridors: builder.corridors, doors, walls, navGraph, floors: 1, bounds, entrance };
}

function serviceBlock(seed: number, salt: number): RoomDraft[] {
  const baseSeed = (seed ^ hashString(`service-${salt}`)) >>> 0;
  const types: ServiceRoomType[] = ['salle-de-bain', 'wc'];
  if (salt % (SERVICE_EVERY * 2) === 0) types.push('buanderie');
  return types.map((type, index) => ({ type, projectId: null, seed: (baseSeed + index * 13) >>> 0, width: ROOM_WIDTHS[type] }));
}

function doorOffset(room: Room, span: number): number {
  const rng = createRng(room.seed ^ 0xd00);
  const margin = Math.min(1.4, span / 2 - DOOR_WIDTH / 2);
  return margin + rng() * Math.max(0, span - margin * 2);
}

function computeDoors(rooms: Room[], corridors: Corridor[], hall: Room): Door[] {
  const doors: Door[] = [];
  for (const room of rooms) {
    const corridor = corridorId(corridors, room.floor);
    if (room === hall) continue;
    if (room.doorSide === 'e') {
      doors.push({ id: `d-${room.id}`, floor: room.floor, x: (room.x + room.w) * CELL, z: room.z * CELL + doorOffset(room, room.d * CELL), axis: 'z', a: room.id, b: corridor });
    } else {
      const z = room.doorSide === 's' ? (room.z + room.d) * CELL : room.z * CELL;
      doors.push({ id: `d-${room.id}`, floor: room.floor, x: room.x * CELL + doorOffset(room, room.w * CELL), z, axis: 'x', a: room.id, b: corridor });
    }
  }
  const hallZ = (hall.z + hall.d / 2) * CELL;
  doors.push({ id: 'd-hall', floor: 0, x: (hall.x + hall.w) * CELL, z: hallZ, axis: 'z', a: hall.id, b: corridorId(corridors, 0) });
  doors.push({ id: 'd-entrance', floor: 0, x: hall.x * CELL, z: hallZ, axis: 'z', a: hall.id, b: null });
  return doors;
}

function corridorId(corridors: Corridor[], floor: number): string {
  const corridor = corridors.find((c) => c.floor === floor);
  if (!corridor) throw new Error(`Pas de couloir à l'étage ${floor}`);
  return corridor.id;
}

function computeWalls(rooms: Room[], corridors: Corridor[], floors: number): Wall[] {
  const walls: Wall[] = [];
  for (let floor = 0; floor < floors; floor++) {
    const grid = new Map<string, string>();
    const key = (x: number, z: number) => `${x},${z}`;
    for (const area of [...rooms.filter((r) => r.floor === floor), ...corridors.filter((c) => c.floor === floor)]) {
      for (let x = area.x; x < area.x + area.w; x++) {
        for (let z = area.z; z < area.z + area.d; z++) grid.set(key(x, z), area.id);
      }
    }
    const cells = [...grid.keys()].map((k) => k.split(',').map(Number) as [number, number]);
    const minX = Math.min(...cells.map((c) => c[0]));
    const maxX = Math.max(...cells.map((c) => c[0])) + 1;
    const minZ = Math.min(...cells.map((c) => c[1]));
    const maxZ = Math.max(...cells.map((c) => c[1])) + 1;

    for (let z = minZ; z <= maxZ; z++) {
      let open: Wall | null = null;
      for (let x = minX; x <= maxX; x++) {
        const low = grid.get(key(x, z - 1)) ?? null;
        const high = grid.get(key(x, z)) ?? null;
        if (low !== high && x < maxX) {
          if (open && open.low === low && open.high === high) open.x2 = (x + 1) * CELL;
          else {
            if (open) walls.push(open);
            open = { floor, axis: 'x', x1: x * CELL, x2: (x + 1) * CELL, z1: z * CELL, z2: z * CELL, low, high };
          }
        } else if (open) {
          walls.push(open);
          open = null;
        }
      }
      if (open) walls.push(open);
    }
    for (let x = minX; x <= maxX; x++) {
      let open: Wall | null = null;
      for (let z = minZ; z <= maxZ; z++) {
        const low = grid.get(key(x - 1, z)) ?? null;
        const high = grid.get(key(x, z)) ?? null;
        if (low !== high && z < maxZ) {
          if (open && open.low === low && open.high === high) open.z2 = (z + 1) * CELL;
          else {
            if (open) walls.push(open);
            open = { floor, axis: 'z', x1: x * CELL, x2: x * CELL, z1: z * CELL, z2: (z + 1) * CELL, low, high };
          }
        } else if (open) {
          walls.push(open);
          open = null;
        }
      }
      if (open) walls.push(open);
    }
  }
  return walls;
}

function computeNavGraph(rooms: Room[], corridors: Corridor[], doors: Door[]): NavGraph {
  const nodes: NavNode[] = [];
  const edges: NavEdge[] = [];
  const byId = new Map<string, NavNode>();
  const add = (node: NavNode) => {
    nodes.push(node);
    byId.set(node.id, node);
    return node;
  };
  const link = (a: NavNode, b: NavNode) => {
    edges.push({ a: a.id, b: b.id, cost: Math.hypot(a.x - b.x, a.z - b.z) });
  };
  const addDoor = (door: Door, corridorNode: NavNode) => {
    const node = add({ id: `door:${door.id}`, kind: 'door', floor: door.floor, x: door.x, z: door.z, roomId: null });
    const roomNode = byId.get(`room:${door.a}`);
    if (roomNode) link(node, roomNode);
    link(node, corridorNode);
  };

  for (const room of rooms) {
    const x = (room.x + room.w / 2) * CELL;
    const z = (room.z + room.d / 2) * CELL;
    add({ id: `room:${room.id}`, kind: 'room', floor: room.floor, x, z, roomId: room.id });
  }

  const floorsWithCorridors = [...new Set(corridors.map((c) => c.floor))];
  for (const floor of floorsWithCorridors) {
    const pieces = corridors.filter((c) => c.floor === floor);
    const spine = pieces.find((c) => c.d > c.w);
    const wings = pieces.filter((c) => c !== spine);
    if (!spine) continue;
    const floorDoors = doors.filter((d) => d.floor === floor && d.b !== null);
    const spineX = (spine.x + spine.w / 2) * CELL;
    const wingZ = (wing: Corridor) => (wing.z + wing.d / 2) * CELL;

    const spineDoors = floorDoors.filter((d) => d.axis === 'z');
    const stops = new Set<number>([...wings.map(wingZ), ...spineDoors.map((d) => d.z)]);
    const spineNodes = [...stops].sort((a, b) => a - b).map((z, index) =>
      add({ id: `cor:${floor}:spine:${index}`, kind: 'corridor', floor, x: spineX, z, roomId: spine.id }),
    );
    spineNodes.forEach((node, index) => {
      const next = spineNodes[index + 1];
      if (next) link(node, next);
    });
    for (const door of spineDoors) {
      const stop = spineNodes.find((node) => node.z === door.z);
      if (stop) addDoor(door, stop);
    }

    wings.forEach((wing, wingIndex) => {
      const z = wingZ(wing);
      const wingDoors = floorDoors.filter((d) => d.axis === 'x' && d.x >= wing.x * CELL && d.x <= (wing.x + wing.w) * CELL && (d.z === wing.z * CELL || d.z === (wing.z + wing.d) * CELL));
      const xs = [...new Set(wingDoors.map((d) => d.x))].sort((a, b) => a - b);
      const points = xs.map((x, index) => add({ id: `cor:${floor}:${wingIndex}:${index}`, kind: 'corridor', floor, x, z, roomId: wing.id }));
      const junction = spineNodes.find((node) => node.z === z);
      const first = points[0];
      if (junction && first) link(junction, first);
      points.forEach((point, index) => {
        const next = points[index + 1];
        if (next) link(point, next);
      });
      for (const door of wingDoors) {
        const point = points.find((candidate) => candidate.x === door.x);
        if (point) addDoor(door, point);
      }
    });
  }

  return { nodes, edges };
}

export function roomRect(room: Pick<Room, 'x' | 'z' | 'w' | 'd'>): { minX: number; maxX: number; minZ: number; maxZ: number } {
  return {
    minX: room.x * CELL,
    maxX: (room.x + room.w) * CELL,
    minZ: room.z * CELL,
    maxZ: (room.z + room.d) * CELL,
  };
}
