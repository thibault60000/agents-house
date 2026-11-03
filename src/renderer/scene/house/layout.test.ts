import { describe, expect, it } from 'vitest';
import { findPath, indexGraph } from '../agents/nav';
import { CELL, DOOR_WIDTH, generateLayout, type Layout, type LayoutProject, type Room } from './layout';

function projects(count: number): LayoutProject[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, path: `/projets/projet-${i}` }));
}

function overlap(a: { x: number; z: number; w: number; d: number }, b: { x: number; z: number; w: number; d: number }): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;
}

function areas(layout: Layout, floor: number) {
  return [...layout.rooms.filter((r) => r.floor === floor), ...layout.corridors.filter((c) => c.floor === floor)];
}

function crossesWall(layout: Layout, floor: number, ax: number, az: number, bx: number, bz: number): boolean {
  const doors = layout.doors.filter((d) => d.floor === floor);
  for (const wall of layout.walls.filter((w) => w.floor === floor)) {
    if (wall.axis === 'x') {
      const z = wall.z1;
      if ((az - z) * (bz - z) >= 0) continue;
      const t = (z - az) / (bz - az);
      const x = ax + (bx - ax) * t;
      if (x <= wall.x1 || x >= wall.x2) continue;
      const open = doors.some((d) => d.axis === 'x' && d.z === z && Math.abs(d.x - x) < DOOR_WIDTH / 2);
      if (!open) return true;
    } else {
      const x = wall.x1;
      if ((ax - x) * (bx - x) >= 0) continue;
      const t = (x - ax) / (bx - ax);
      const z = az + (bz - az) * t;
      if (z <= wall.z1 || z >= wall.z2) continue;
      const open = doors.some((d) => d.axis === 'z' && d.x === x && Math.abs(d.z - z) < DOOR_WIDTH / 2);
      if (!open) return true;
    }
  }
  return false;
}

describe.each([1, 3, 8, 15, 25, 40])('generateLayout avec %i projets', (count) => {
  const layout = generateLayout(projects(count), 42);

  it('donne une pièce à chaque projet', () => {
    const ids = layout.rooms.flatMap((r) => (r.projectId ? [r.projectId] : []));
    expect(ids.sort()).toEqual(projects(count).map((p) => p.id).sort());
  });

  it("ne fait se chevaucher aucune pièce, à aucun étage", () => {
    for (let floor = 0; floor < layout.floors; floor++) {
      const list = areas(layout, floor);
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          expect(overlap(list[i]!, list[j]!), `${list[i]!.id} / ${list[j]!.id}`).toBe(false);
        }
      }
    }
  });

  it('donne au moins une porte à chaque pièce', () => {
    for (const room of layout.rooms) {
      expect(layout.doors.some((d) => d.a === room.id), room.id).toBe(true);
    }
  });

  it('place chaque porte sur un mur qui sépare bien ses deux espaces', () => {
    for (const door of layout.doors) {
      const wall = layout.walls.find((w) => {
        if (w.floor !== door.floor || w.axis !== door.axis) return false;
        if (w.axis === 'x') return w.z1 === door.z && door.x - DOOR_WIDTH / 2 >= w.x1 && door.x + DOOR_WIDTH / 2 <= w.x2;
        return w.x1 === door.x && door.z - DOOR_WIDTH / 2 >= w.z1 && door.z + DOOR_WIDTH / 2 <= w.z2;
      });
      expect(wall, door.id).toBeDefined();
      expect([wall!.low, wall!.high].sort()).toEqual([door.a, door.b].sort());
    }
  });

  it('rend toutes les pièces accessibles depuis le hall', () => {
    const index = indexGraph(layout.navGraph);
    for (const room of layout.rooms) {
      expect(findPath(index, 'room:hall', `room:${room.id}`), room.id).not.toBeNull();
    }
  });

  it('ne fait traverser aucun mur au graphe de navigation', () => {
    const index = indexGraph(layout.navGraph);
    for (const edge of layout.navGraph.edges) {
      const a = index.nodes.get(edge.a)!;
      const b = index.nodes.get(edge.b)!;
      if (a.floor !== b.floor) continue;
      expect(crossesWall(layout, a.floor, a.x, a.z, b.x, b.z), `${edge.a} → ${edge.b}`).toBe(false);
    }
  });

  it('garde des salles d\'eau proportionnelles au nombre de projets', () => {
    const baths = layout.rooms.filter((r) => r.type === 'salle-de-bain').length;
    const wcs = layout.rooms.filter((r) => r.type === 'wc').length;
    expect(baths).toBe(wcs);
    expect(baths).toBeGreaterThanOrEqual(Math.max(1, Math.floor(count / 6)));
    expect(baths).toBeLessThanOrEqual(Math.ceil(count / 6) + layout.floors);
  });

  it('respecte les contraintes de type', () => {
    for (let floor = 0; floor < layout.floors; floor++) {
      const rooms = layout.rooms.filter((r) => r.floor === floor);
      expect(rooms.filter((r) => r.type === 'cuisine').length).toBeLessThanOrEqual(1);
    }
    expect(layout.rooms.filter((r) => r.type === 'garage')).toHaveLength(1);
    expect(layout.rooms.filter((r) => r.type === 'logistique')).toHaveLength(1);
  });

  it('est déterministe', () => {
    expect(generateLayout(projects(count), 42)).toEqual(layout);
  });
});

describe('types de pièces', () => {
  it('garde une emprise raisonnable', () => {
    const layout = generateLayout(projects(12), 1);
    const room = (r: Room) => r.w * CELL * r.d * CELL;
    expect(Math.max(...layout.rooms.map(room))).toBeLessThanOrEqual(12 * 12);
  });

  it('respecte le type forcé par l\'utilisateur', () => {
    const list = projects(3);
    list[1]!.roomType = 'veranda';
    const layout = generateLayout(list, 7);
    expect(layout.rooms.find((r) => r.projectId === 'p1')?.type).toBe('veranda');
  });

  it('oriente le type selon la catégorie du projet', () => {
    const layout = generateLayout(
      [
        { id: 'jeu', path: '/a', category: 'game' },
        { id: 'data', path: '/b', category: 'data' },
      ],
      3,
    );
    expect(layout.rooms.find((r) => r.projectId === 'jeu')?.type).toBe('salle-de-jeux');
    expect(layout.rooms.find((r) => r.projectId === 'data')?.type).toBe('bibliotheque');
  });

  it('varie le type selon le chemin du projet', () => {
    const types = new Set(generateLayout(projects(12), 1).rooms.filter((r) => r.projectId).map((r) => r.type));
    expect(types.size).toBeGreaterThan(5);
  });
});
