import { BufferAttribute, BufferGeometry, Color, DoubleSide, InstancedBufferAttribute, InstancedMesh, Object3D, ShaderMaterial } from 'three';
import { createRng } from '@shared/random';

const VERTEX = `
  uniform float uTime;
  attribute float aShade;
  varying float vHeight;
  varying float vShade;
  void main() {
    vHeight = position.y;
    vShade = aShade;
    vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float gust = sin(uTime * 1.7 + world.x * 0.35 + world.z * 0.27) + 0.5 * sin(uTime * 3.1 + world.x * 0.9);
    float bend = position.y * position.y;
    world.x += gust * bend * 0.08;
    world.z += gust * bend * 0.04;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAGMENT = `
  uniform vec3 uBase;
  uniform vec3 uTip;
  uniform vec3 uLight;
  varying float vHeight;
  varying float vShade;
  void main() {
    vec3 color = mix(uBase, uTip, vHeight) * (0.9 + vShade * 0.2);
    gl_FragColor = vec4(color * uLight, 1.0);
  }
`;

export interface GrassMask {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Grass {
  mesh: InstancedMesh;
  material: ShaderMaterial;
}

function bladeGeometry(): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const blades = [
    [-0.05, 0.0, 0.03, 1.0],
    [0.02, 0.05, -0.05, 0.8],
    [0.05, -0.05, 0.06, 0.65],
  ] as const;
  blades.forEach(([x, z, lean, h], i) => {
    const base = i * 3;
    const w = 0.035;
    positions.push(x - w, 0, z, x + w, 0, z, x + lean, h, z);
    indices.push(base, base + 1, base + 2);
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createGrass(options: { count: number; lawn: GrassMask; masks: GrassMask[]; y: number }): Grass {
  const { count, lawn, masks, y } = options;
  const rng = createRng(90210);
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBase: { value: new Color('#94b76a') },
      uTip: { value: new Color('#c4dc8c') },
      uLight: { value: new Color(1, 1, 1) },
    },
  });
  const mesh = new InstancedMesh(bladeGeometry(), material, count);
  const shades = new Float32Array(count);
  const dummy = new Object3D();
  const clusters = Array.from({ length: Math.max(4, Math.round(count / 30)) }, () => ({
    x: lawn.minX + rng() * (lawn.maxX - lawn.minX),
    z: lawn.minZ + rng() * (lawn.maxZ - lawn.minZ),
  }));
  let placed = 0;
  for (let attempt = 0; attempt < count * 6 && placed < count; attempt++) {
    const cluster = clusters[Math.floor(rng() * clusters.length)] as { x: number; z: number };
    const angle = rng() * Math.PI * 2;
    const radius = rng() * rng() * 0.9;
    const x = cluster.x + Math.cos(angle) * radius;
    const z = cluster.z + Math.sin(angle) * radius;
    if (x < lawn.minX || x > lawn.maxX || z < lawn.minZ || z > lawn.maxZ) continue;
    if (masks.some((m) => x > m.minX && x < m.maxX && z > m.minZ && z < m.maxZ)) continue;
    dummy.position.set(x, y, z);
    dummy.rotation.y = rng() * Math.PI;
    const size = 0.13 + rng() * 0.14;
    dummy.scale.set(1 + rng() * 0.5, size, 1 + rng() * 0.5);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    shades[placed] = rng();
    placed++;
  }
  mesh.count = placed;
  mesh.geometry.setAttribute('aShade', new InstancedBufferAttribute(shades, 1));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.userData.noAO = true;
  return { mesh, material };
}
