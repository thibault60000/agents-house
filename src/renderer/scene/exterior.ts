import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry, ShadowMaterial, SRGBColorSpace } from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { createRng, range } from '@shared/random';
import { disposeTree, GeoBuilder, solidMaterial } from './builder';
import { createGrass, type Grass, type GrassMask } from './grass';
import { CELL, type Layout } from './house/layout';
import { makePalette } from './house/palette';
import * as P from './house/props';

const MARGIN = 2.6;
const ENTRY_MARGIN = 4.6;
const PLINTH_HEIGHT = 1.1;
const TOP_Y = -0.12;

export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Exterior {
  group: Group;
  grass: Grass | null;
  bounds: Rect;
  update(time: number, dt: number, light: Color): void;
  dispose(): void;
}

const windMaterial = solidMaterial.clone();
windMaterial.userData.shared = true;
const windTime = { value: 0 };
windMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uWindTime = windTime;
  shader.vertexShader = `uniform float uWindTime;\n${shader.vertexShader}`.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     float swayH = max(0.0, position.y - 0.7);
     float swayP = uWindTime * 1.2 + (modelMatrix[3].x + position.x) * 0.3 + (modelMatrix[3].z + position.z) * 0.2;
     transformed.x += sin(swayP) * swayH * 0.02;
     transformed.z += cos(swayP * 0.8) * swayH * 0.015;`,
  );
};

function nameplate(name: string): CSS2DObject {
  const element = document.createElement('div');
  element.className = 'room-tag';
  element.textContent = name;
  return new CSS2DObject(element);
}

function softShadow(width: number, depth: number): Mesh {
  const canvas = document.createElement('canvas');
  const scale = 512 / Math.max(width, depth);
  const pad = 80;
  canvas.width = Math.ceil(width * scale) + pad * 2;
  canvas.height = Math.ceil(depth * scale) + pad * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponible');
  ctx.filter = 'blur(30px)';
  ctx.fillStyle = 'rgba(112, 66, 46, 1)';
  ctx.fillRect(pad, pad, width * scale, depth * scale);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.42, depthWrite: false });
  const mesh = new Mesh(new PlaneGeometry(canvas.width / scale, canvas.height / scale), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function buildExterior(options: { layout: Layout; rootName: string; grassCount: number; seed: number }): Exterior {
  const { layout, rootName, grassCount, seed } = options;
  const rng = createRng(seed ^ 0xbeef);
  const group = new Group();
  const { bounds, entrance } = layout;

  const plinth: Rect = {
    minX: bounds.minX - ENTRY_MARGIN,
    maxX: bounds.maxX + MARGIN,
    minZ: bounds.minZ - MARGIN,
    maxZ: bounds.maxZ + MARGIN,
  };
  const cx = (plinth.minX + plinth.maxX) / 2;
  const cz = (plinth.minZ + plinth.maxZ) / 2;
  const width = plinth.maxX - plinth.minX;
  const depth = plinth.maxZ - plinth.minZ;
  const rim = 0.32;
  const lawn: Rect = { minX: plinth.minX + rim, maxX: plinth.maxX - rim, minZ: plinth.minZ + rim, maxZ: plinth.maxZ - rim };

  const base = new GeoBuilder();
  base.box(width, PLINTH_HEIGHT, depth, '#ffffff', cx, TOP_Y - PLINTH_HEIGHT, cz, { r: 0.1 });
  base.box(lawn.maxX - lawn.minX, 0.05, lawn.maxZ - lawn.minZ, '#8fb05f', cx, TOP_Y, cz, { r: 0.02 });

  const ground = [...layout.rooms, ...layout.corridors].filter((area) => area.floor === 0);
  const deckWidth = 0.85;
  const deckRects: Rect[] = ground.map((area) => ({
    minX: area.x * CELL - deckWidth,
    maxX: (area.x + area.w) * CELL + deckWidth,
    minZ: area.z * CELL - deckWidth,
    maxZ: (area.z + area.d) * CELL + deckWidth,
  }));
  for (const rect of deckRects) {
    base.box(rect.maxX - rect.minX, 0.075, rect.maxZ - rect.minZ, '#b98d68', (rect.minX + rect.maxX) / 2, TOP_Y + 0.005, (rect.minZ + rect.maxZ) / 2);
  }

  const stepsX = entrance.x - deckWidth;
  base.box(0.5, 0.06, 2.0, '#fbf8f3', stepsX - 0.2, TOP_Y + 0.05, entrance.z, { r: 0.015 });
  for (let x = stepsX - 0.95, i = 0; x > plinth.minX + 0.6; x -= 0.9, i++) {
    base.box(0.66, 0.04, 1.15, '#f1ebe1', x, TOP_Y + 0.045, entrance.z + (i % 2 ? 0.08 : -0.08), { r: 0.012 });
  }
  const pathMask: Rect = { minX: plinth.minX, maxX: entrance.x, minZ: entrance.z - 1.1, maxZ: entrance.z + 1.1 };

  const palette = makePalette(rng, null, 'veranda');
  const mailbox = { x: plinth.minX + 1.1, z: entrance.z - 1.7 };
  base.at(mailbox.x, mailbox.z, Math.PI / 2, () => P.mailbox({ b: base, c: palette, rng, fx: [] }), TOP_Y + 0.05);
  const plate = nameplate(rootName);
  plate.position.set(mailbox.x, 1.45, mailbox.z);
  group.add(plate);

  const used: { x: number; z: number; r: number }[] = [{ x: mailbox.x, z: mailbox.z, r: 0.6 }];
  const freeSpot = (radius: number): { x: number; z: number } | null => {
    for (let i = 0; i < 40; i++) {
      const x = range(rng, lawn.minX + radius, lawn.maxX - radius);
      const z = range(rng, lawn.minZ + radius, lawn.maxZ - radius);
      const touches = (m: Rect) => x > m.minX - radius && x < m.maxX + radius && z > m.minZ - radius && z < m.maxZ + radius;
      if (deckRects.some(touches) || touches(pathMask)) continue;
      if (used.some((u) => Math.hypot(u.x - x, u.z - z) < u.r + radius)) continue;
      used.push({ x, z, r: radius });
      return { x, z };
    }
    return null;
  };

  const area = width * depth;
  const trees = new GeoBuilder();
  for (let i = 0; i < Math.max(2, Math.round(area / 170)); i++) {
    const spot = freeSpot(0.75);
    if (spot) trees.at(spot.x, spot.z, rng() * Math.PI * 2, () => P.tree({ b: trees, c: palette, rng, fx: [] }), TOP_Y + 0.05);
  }
  const treeGroup = trees.build();
  treeGroup.traverse((node) => {
    if ((node as Mesh).isMesh) (node as Mesh).material = windMaterial;
  });
  group.add(treeGroup);

  const decor = new GeoBuilder();
  for (let i = 0; i < Math.max(3, Math.round(area / 70)); i++) {
    const spot = freeSpot(0.4);
    if (!spot) continue;
    const roll = rng();
    const build = roll < 0.45 ? P.cactus : roll < 0.75 ? P.shrub : P.pottedOutdoor;
    decor.at(spot.x, spot.z, rng() * Math.PI * 2, () => build({ b: decor, c: palette, rng, fx: [] }), TOP_Y + 0.05);
  }
  const padSpot = freeSpot(1.3);
  if (padSpot) {
    decor.box(2.2, 0.03, 1.4, '#d8d2c8', padSpot.x, TOP_Y + 0.05, padSpot.z, { r: 0.012 });
    decor.at(padSpot.x, padSpot.z, 0, () => P.gardenBench({ b: decor, c: palette, rng, fx: [] }), TOP_Y + 0.08);
  }
  group.add(base.build());
  if (!decor.isEmpty()) group.add(decor.build());

  const floor = new Mesh(new PlaneGeometry(1600, 1600), new ShadowMaterial({ color: 0x7c4a36, opacity: 0.32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = TOP_Y - PLINTH_HEIGHT;
  floor.receiveShadow = true;
  floor.userData.noAO = true;
  group.add(floor);
  const drop = softShadow(width, depth);
  drop.userData.noAO = true;
  drop.position.set(cx + 2.4, TOP_Y - PLINTH_HEIGHT + 0.01, cz - 1.4);
  group.add(drop);

  let grass: Grass | null = null;
  if (grassCount > 0) {
    grass = createGrass({ count: grassCount, lawn, masks: [...deckRects, pathMask] as GrassMask[], y: TOP_Y + 0.05 });
    group.add(grass.mesh);
  }

  return {
    group,
    grass,
    bounds: plinth,
    update(time, _dt, light) {
      windTime.value = time;
      if (grass) {
        grass.material.uniforms.uTime!.value = time;
        (grass.material.uniforms.uLight!.value as Color).copy(light);
      }
    },
    dispose() {
      plate.element.remove();
      disposeTree(group);
    },
  };
}
