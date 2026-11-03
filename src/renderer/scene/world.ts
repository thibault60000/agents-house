import {
  Color,
  DataTexture,
  Group,
  HalfFloatType,
  type Line,
  MathUtils,
  NeutralToneMapping,
  type Object3D,
  OrthographicCamera,
  PCFShadowMap,
  PointLight,
  type Points,
  Raycaster,
  Scene,
  type Sprite,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { hashString } from '@shared/random';
import type { AgentTask, Project, Settings } from '@shared/types';
import type { AgentBadge } from './agents/bubble';
import { AgentManager } from './agents/manager';
import { AlarmBeacons, type AlarmLevel } from './alarm';
import { setNightLevel } from './builder';
import { buildExterior, type Exterior } from './exterior';
import { buildHouse, type BuiltHouse } from './house/house';
import { CELL, FLOOR_HEIGHT, type Room } from './house/layout';
import { INTERACTIVE_LAYER, type BuiltRoom, type Interactive, type InteractiveKind } from './house/rooms/room';
import type { ScreenData, StationKind } from './house/rooms/stations';
import { Environment } from './sky';

const ELEVATION = Math.atan(1 / Math.SQRT2);
const AO_SCALE = 0.75;

class StudioGtaoPass extends GTAOPass {
  private hidden: Object3D[] = [];

  _overrideVisibility(): void {
    (this as unknown as { scene: Scene }).scene.traverse((node) => {
      const excluded = (node as Sprite).isSprite || (node as Points).isPoints || (node as Line).isLine || node.userData.noAO;
      if (excluded && node.visible) {
        node.visible = false;
        this.hidden.push(node);
      }
    });
  }

  override setSize(width: number, height: number): void {
    super.setSize(Math.ceil(width * AO_SCALE), Math.ceil(height * AO_SCALE));
  }

  _restoreVisibility(): void {
    for (const node of this.hidden) node.visible = true;
    this.hidden = [];
  }
}
const LIGHT_POOL = 8;
const GRASS_BY_QUALITY: Record<Settings['quality'], number> = { low: 0, medium: 160, high: 300 };
const SHADOW_BY_QUALITY: Record<Settings['quality'], number> = { low: 1024, medium: 2048, high: 4096 };

export interface PickEvent {
  kind: InteractiveKind;
  projectId: string;
}

export interface WorldCallbacks {
  onPick(event: PickEvent): void;
  onBubbleClick(projectId: string, taskId: string | null): void;
  labelFor(kind: InteractiveKind, projectId: string): string;
  onFloorsChanged(floors: number, active: number): void;
  onNightChanged(isNight: boolean): void;
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export class World {
  private renderer: WebGLRenderer;
  private labelRenderer: CSS2DRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 100, 600);
  private environment = new Environment();
  private composer: EffectComposer;
  private outline: OutlinePass;
  private bloom: UnrealBloomPass;
  private smaa: SMAAPass;
  private ao: GTAOPass;

  private target = new Vector3(0, 0, 0);
  private targetGoal = new Vector3(0, 0, 0);
  private zoom = 22;
  private zoomGoal = 22;
  private azimuth = Math.PI / 4;
  private azimuthGoal = Math.PI / 4;
  private insetGoal = 0;
  private inset = 0;
  private appliedView = { azimuth: NaN, floor: -1 };

  private house: BuiltHouse | null = null;
  private exterior: Exterior | null = null;
  private agents: AgentManager | null = null;
  private root = new Group();
  private lights: PointLight[] = [];
  private lightsRetarget = 0;

  private settings: Settings | null = null;
  private projects: Project[] = [];
  private rootName = 'maison';
  private buildKey = '';
  private exteriorKey = '';
  private activeFloor = 0;
  private selectedRoom: BuiltRoom | null = null;

  private raycaster = new Raycaster();
  private pointer = new Vector2();
  private pointerDirty = false;
  private pointerInside = false;
  private hovered: Interactive | null = null;
  private keyboardIndex = -1;
  private label: CSS2DObject;
  private labelElement = document.createElement('div');
  private drag: { x: number; y: number; moved: number; id: number } | null = null;

  private time = 0;
  private lastFrame = 0;
  private frameBudget = 0;
  private frameId = 0;
  private needsRender = true;
  private focused = true;
  private activeTasks = 0;
  private reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private wasNight: boolean | null = null;
  private shadowClock = 0;
  private lastSun = new Vector3();
  private cameraMoving = false;
  private bloomAllowed = true;
  private alarm = new AlarmBeacons();
  private shadowDistance = 60;
  private lightScale = new Color(1, 1, 1);
  private tasks = new Map<string, AgentTask | null>();
  private badges = new Map<string, AgentBadge>();
  private screens = new Map<StationKind, ScreenData>();
  private externalWork = new Set<string>();
  private warmColor = new Color('#ffcf9a');
  private coolColor = new Color('#7f94d6');
  private disposers: (() => void)[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private callbacks: WorldCallbacks,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;

    this.labelRenderer = new CSS2DRenderer({ element: overlay });
    this.overlay.classList.add('scene-overlay');

    this.scene.add(this.root);
    this.scene.add(this.environment.hemi);
    this.scene.add(this.environment.sunLight);
    this.scene.add(this.environment.sunLight.target);
    for (let i = 0; i < LIGHT_POOL; i++) {
      const light = new PointLight(0xffd9a0, 0, 10, 1.2);
      this.lights.push(light);
      this.scene.add(light);
    }

    this.raycaster.layers.set(INTERACTIVE_LAYER);

    const size = new Vector2(window.innerWidth, window.innerHeight);
    const renderTarget = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: 2 });
    this.composer = new EffectComposer(this.renderer, renderTarget);
    this.scene.background = this.environment.background;
    const scenePass = new RenderPass(this.scene, this.camera);
    this.ao = new StudioGtaoPass(this.scene, this.camera, Math.ceil(size.x * AO_SCALE), Math.ceil(size.y * AO_SCALE));
    this.ao.blendIntensity = 0.85;
    this.ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.2, thickness: 1, scale: 1.1, samples: 8, distanceFallOff: 1, screenSpaceRadius: false });
    this.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
    const fixedKernel = new DataTexture(new Uint8Array([32, 32, 32, 32]), 1, 1);
    fixedKernel.needsUpdate = true;
    this.ao.pdMaterial.uniforms.tNoise!.value = fixedKernel;
    this.outline = new OutlinePass(size, this.scene, this.camera);
    this.outline.edgeStrength = 5;
    this.outline.edgeThickness = 1.4;
    this.outline.edgeGlow = 0.35;
    this.outline.enabled = false;
    this.bloom = new UnrealBloomPass(size, 0.18, 0.4, 1.5);
    this.smaa = new SMAAPass();
    this.composer.addPass(scenePass);
    this.composer.addPass(this.ao);
    this.composer.addPass(this.outline);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.smaa);

    this.scene.add(this.alarm.group);

    this.labelElement.className = 'hover-label';
    this.label = new CSS2DObject(this.labelElement);
    this.label.visible = false;
    this.scene.add(this.label);

    this.bindInput();
    this.resize();
    this.frameId = requestAnimationFrame(this.frame);
  }

  private bindInput(): void {
    const { canvas } = this;
    const listen = <K extends keyof WindowEventMap>(target: EventTarget, type: K | string, handler: (event: never) => void, options?: AddEventListenerOptions) => {
      target.addEventListener(type, handler as EventListener, options);
      this.disposers.push(() => target.removeEventListener(type, handler as EventListener));
    };

    const onResize = () => this.resize();
    listen(window, 'resize', onResize);
    listen(window, 'focus', () => {
      this.focused = true;
      this.invalidate();
    });
    listen(window, 'blur', () => {
      this.focused = false;
    });

    listen(canvas, 'pointermove', (event: PointerEvent) => {
      this.pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
      this.pointerDirty = true;
      this.pointerInside = true;
      this.keyboardIndex = -1;
      if (this.drag && event.pointerId === this.drag.id) {
        const dx = event.clientX - this.drag.x;
        const dy = event.clientY - this.drag.y;
        this.drag.moved += Math.abs(dx) + Math.abs(dy);
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
        if (this.drag.moved > 5) this.pan(dx, dy);
      }
      this.invalidate();
    });
    listen(canvas, 'pointerleave', () => {
      this.pointerInside = false;
      this.setHover(null);
    });
    listen(canvas, 'pointerdown', (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 1) return;
      this.drag = { x: event.clientX, y: event.clientY, moved: 0, id: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
      canvas.focus({ preventScroll: true });
    });
    listen(canvas, 'pointerup', (event: PointerEvent) => {
      const drag = this.drag;
      this.drag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (drag && drag.moved <= 5 && event.button === 0) this.click();
    });
    listen(canvas, 'dblclick', () => {
      const room = this.roomUnderPointer();
      if (room) this.focusRoom(room);
    });
    listen(
      canvas,
      'wheel',
      (event: WheelEvent) => {
        event.preventDefault();
        const previous = this.zoomGoal;
        const next = MathUtils.clamp(previous * (1 + Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 120) * 0.0014), 4, this.maxZoom());
        const aspect = window.innerWidth / window.innerHeight;
        const right = this.rightVector();
        const forward = this.forwardVector();
        this.targetGoal.addScaledVector(right, this.pointer.x * aspect * (previous - next));
        this.targetGoal.addScaledVector(forward, (this.pointer.y * (previous - next)) / Math.sin(ELEVATION));
        this.clampTarget();
        this.zoomGoal = next;
        this.invalidate();
      },
      { passive: false },
    );
    listen(window, 'keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    const element = document.activeElement;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element?.closest('[data-panel]')) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'q') this.rotate(-1);
    else if (key === 'e') this.rotate(1);
    else if (key === 'f') this.overview();
    else if (event.key === 'Tab') {
      const items = this.keyboardItems();
      if (items.length === 0) return;
      event.preventDefault();
      this.keyboardIndex = (this.keyboardIndex + (event.shiftKey ? -1 : 1) + items.length) % items.length;
      this.setHover(items[this.keyboardIndex] ?? null);
    } else if (event.key === 'Enter' && this.hovered && this.keyboardIndex >= 0) {
      this.activate(this.hovered);
    } else return;
    this.invalidate();
  }

  private keyboardItems(): Interactive[] {
    const room = this.selectedRoom;
    if (room) return room.interactives;
    return this.house?.interactives.filter((item) => item.floor === this.activeFloor) ?? [];
  }

  private rightVector(): Vector3 {
    return new Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
  }

  private forwardVector(): Vector3 {
    return new Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
  }

  private pan(dx: number, dy: number): void {
    const worldPerPixel = (this.zoom * 2) / window.innerHeight;
    this.targetGoal.addScaledVector(this.rightVector(), -dx * worldPerPixel);
    this.targetGoal.addScaledVector(this.forwardVector(), (dy * worldPerPixel) / Math.sin(ELEVATION));
    this.clampTarget();
    if (this.reduceMotion.matches) this.target.copy(this.targetGoal);
  }

  private clampTarget(): void {
    if (!this.exterior) return;
    const { bounds } = this.exterior;
    const margin = 3;
    this.targetGoal.x = MathUtils.clamp(this.targetGoal.x, bounds.minX - margin, bounds.maxX + margin);
    this.targetGoal.z = MathUtils.clamp(this.targetGoal.z, bounds.minZ - margin, bounds.maxZ + margin);
  }

  private maxZoom(): number {
    return Math.max(14, this.fitZoom() * 1.35);
  }

  private fitZoom(): number {
    const bounds = this.exterior?.bounds;
    if (!bounds) return 22;
    const right = new Vector3(Math.cos(this.azimuthGoal), 0, -Math.sin(this.azimuthGoal));
    const forward = new Vector3(-Math.sin(this.azimuthGoal), 0, -Math.cos(this.azimuthGoal));
    let minR = Infinity;
    let maxR = -Infinity;
    let minU = Infinity;
    let maxU = -Infinity;
    for (const x of [bounds.minX, bounds.maxX]) {
      for (const z of [bounds.minZ, bounds.maxZ]) {
        const r = x * right.x + z * right.z;
        const u = (x * forward.x + z * forward.z) * Math.sin(ELEVATION);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minU = Math.min(minU, u - 1.2 * Math.cos(ELEVATION));
        maxU = Math.max(maxU, u + 3 * Math.cos(ELEVATION));
      }
    }
    const aspect = window.innerWidth / window.innerHeight;
    return Math.max((maxR - minR) / (2 * aspect), (maxU - minU) / 2) * 1.1 + 0.6;
  }

  setPanelInset(pixels: number): void {
    this.insetGoal = pixels;
    this.invalidate();
  }

  rotate(direction: number): void {
    this.azimuthGoal += (direction * Math.PI) / 2;
    this.invalidate();
  }

  overview(): void {
    if (!this.house) return;
    const bounds = this.exterior?.bounds ?? this.house.layout.bounds;
    this.selectedRoom = null;
    this.targetGoal.set((bounds.minX + bounds.maxX) / 2, this.activeFloor * FLOOR_HEIGHT, (bounds.minZ + bounds.maxZ) / 2);
    this.zoomGoal = this.fitZoom();
    this.invalidate();
  }

  focusRoom(room: BuiltRoom): void {
    this.selectedRoom = room;
    this.setActiveFloor(room.room.floor);
    this.targetGoal.set(room.center.x, room.room.floor * FLOOR_HEIGHT, room.center.z);
    this.zoomGoal = Math.max(room.room.w, room.room.d) * CELL * 0.72 + 2.2;
    this.invalidate();
  }

  focusStation(kind: InteractiveKind): void {
    const item = this.house?.interactives.find((candidate) => candidate.kind === kind);
    const room = item && this.house?.rooms.get(item.roomId);
    if (room) this.focusRoom(room);
  }

  focusProject(projectId: string): void {
    const room = this.house?.roomByProject.get(projectId);
    if (room) this.focusRoom(room);
  }

  focusAgent(projectId: string): void {
    const position = this.agents?.positionOf(projectId);
    const floor = this.agents?.floorOf(projectId);
    if (!position || floor === null || floor === undefined) return;
    this.setActiveFloor(floor);
    this.targetGoal.copy(position);
    this.zoomGoal = Math.min(this.zoomGoal, 12);
    this.invalidate();
  }

  setActiveFloor(floor: number): void {
    if (!this.house) return;
    const clamped = MathUtils.clamp(floor, 0, this.house.layout.floors - 1);
    if (clamped === this.activeFloor && this.appliedView.floor === clamped) return;
    this.activeFloor = clamped;
    this.targetGoal.y = clamped * FLOOR_HEIGHT;
    this.setHover(null);
    this.agents?.setActiveFloor(clamped);
    this.callbacks.onFloorsChanged(this.house.layout.floors, clamped);
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  private currentInteractives(): Interactive[] {
    const items = this.house?.interactives.filter((item) => item.floor === this.activeFloor) ?? [];
    return [...items, ...(this.agents?.interactives ?? [])];
  }

  private updateHover(): void {
    if (!this.pointerDirty || !this.pointerInside) return;
    this.pointerDirty = false;
    if (this.drag && this.drag.moved > 5) return;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const items = this.currentInteractives();
    const hits = this.raycaster.intersectObjects(items.map((item) => item.object), true);
    let found: Interactive | null = null;
    const first = hits[0];
    if (first) {
      let node: typeof first.object | null = first.object;
      while (node && !found) {
        found = items.find((item) => item.object === node) ?? null;
        node = node.parent;
      }
    }
    this.setHover(found);
  }

  private setHover(item: Interactive | null): void {
    if (item === this.hovered) return;
    if (this.hovered) this.hovered.object.scale.setScalar(1);
    this.hovered = item;
    this.canvas.style.cursor = item ? 'pointer' : '';
    if (!item) {
      this.outline.enabled = false;
      this.outline.selectedObjects = [];
      this.label.visible = false;
      this.labelElement.style.display = 'none';
      return;
    }
    this.outline.selectedObjects = [item.object];
    this.outline.visibleEdgeColor.set(item.color);
    this.outline.hiddenEdgeColor.set(item.color).multiplyScalar(0.4);
    this.outline.enabled = true;
    if (!this.reduceMotion.matches) item.object.scale.setScalar(1.04);
    this.labelElement.textContent = this.callbacks.labelFor(item.kind, item.projectId);
    this.labelElement.style.removeProperty('display');
    this.label.visible = true;
    item.object.updateWorldMatrix(true, false);
    item.object.getWorldPosition(this.label.position);
    this.label.position.y += item.kind === 'agent' ? 2.2 : item.kind === 'chest' ? 1.2 : 2.5;
  }

  private click(): void {
    this.pointerDirty = true;
    this.pointerInside = true;
    this.updateHover();
    if (this.hovered) this.activate(this.hovered);
  }

  private activate(item: Interactive): void {
    const room = this.house?.rooms.get(item.roomId);
    if (room) this.focusRoom(room);
    if (this.keyboardIndex >= 0) this.setHover(null);
    this.callbacks.onPick({ kind: item.kind, projectId: item.projectId });
  }

  private roomUnderPointer(): BuiltRoom | null {
    if (!this.house) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const { origin, direction } = this.raycaster.ray;
    const planeY = this.activeFloor * FLOOR_HEIGHT;
    if (Math.abs(direction.y) < 1e-4) return null;
    const t = (planeY - origin.y) / direction.y;
    const x = origin.x + direction.x * t;
    const z = origin.z + direction.z * t;
    const contains = (room: Room) => x >= room.x * CELL && x <= (room.x + room.w) * CELL && z >= room.z * CELL && z <= (room.z + room.d) * CELL;
    for (const built of this.house.rooms.values()) {
      if (built.room.floor === this.activeFloor && contains(built.room)) return built;
    }
    return null;
  }

  setProjects(projects: Project[], rootName: string): void {
    const enabled = projects.filter((p) => p.enabled);
    this.projects = enabled;
    this.rootName = rootName;
    this.rebuildIfNeeded();
  }

  private rebuildIfNeeded(): void {
    if (!this.settings) return;
    const key = JSON.stringify(this.projects.map((p) => [p.id, p.seed, p.color, p.roomType, p.category, p.name]));
    const exteriorKey = `${this.rootName}|${this.settings.grass}|${this.settings.quality}`;
    if (key === this.buildKey && exteriorKey === this.exteriorKey) return;
    const houseChanged = key !== this.buildKey;
    this.buildKey = key;
    this.exteriorKey = exteriorKey;

    const seed = hashString(this.rootName);
    const hoveredReset = this.hovered !== null;
    if (hoveredReset) this.setHover(null);

    if (houseChanged || !this.house) {
      if (this.agents) {
        this.root.remove(this.agents.group);
        this.agents.dispose();
        this.agents = null;
      }
      if (this.house) {
        this.root.remove(this.house.group);
        this.house.dispose();
      }
      this.house = buildHouse({ projects: this.projects, rootName: this.rootName, seed });
      this.root.add(this.house.group);
      this.agents = new AgentManager(this.house, this.projects, (projectId, taskId) => this.callbacks.onBubbleClick(projectId, taskId));
      this.root.add(this.agents.group);
      for (const [projectId, task] of this.tasks) this.agents.applyTask(projectId, task);
      for (const [projectId, badge] of this.badges) this.agents.applyBadge(projectId, badge);
      for (const [kind, data] of this.screens) this.house.setScreen(kind, data);
      for (const projectId of this.externalWork) this.agents.setExternalWork(projectId, true);
      this.activeFloor = Math.min(this.activeFloor, this.house.layout.floors - 1);
      this.agents.setActiveFloor(this.activeFloor);
      this.selectedRoom = null;
      this.appliedView.floor = -1;
      this.configureShadowCamera();
      this.callbacks.onFloorsChanged(this.house.layout.floors, this.activeFloor);
    }

    if (this.exterior) {
      this.root.remove(this.exterior.group);
      this.exterior.dispose();
    }
    const grassCount = this.settings.grass ? GRASS_BY_QUALITY[this.settings.quality] : 0;
    this.exterior = buildExterior({ layout: this.house.layout, rootName: this.rootName, grassCount, seed });
    this.root.add(this.exterior.group);

    if (houseChanged) {
      this.overview();
      this.target.copy(this.targetGoal);
      this.zoom = this.zoomGoal;
    }
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  private configureShadowCamera(): void {
    if (!this.house) return;
    const { bounds } = this.house.layout;
    const sun = this.environment.sunLight;
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 14;
    const camera = sun.shadow.camera;
    camera.left = -span;
    camera.right = span;
    camera.top = span;
    camera.bottom = -span;
    camera.near = 1;
    camera.far = span * 5;
    camera.updateProjectionMatrix();
    this.shadowDistance = span * 2.5;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 1.6;
    sun.target.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    sun.target.updateMatrixWorld();
  }

  applySettings(settings: Settings): void {
    const previous = this.settings;
    this.settings = settings;
    const sun = this.environment.sunLight;
    sun.castShadow = settings.shadows;
    const mapSize = SHADOW_BY_QUALITY[settings.quality];
    if (sun.shadow.mapSize.x !== mapSize) {
      sun.shadow.mapSize.set(mapSize, mapSize);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    this.bloomAllowed = settings.postProcess && settings.quality !== 'low';
    this.ao.enabled = settings.postProcess && settings.quality !== 'low';
    this.smaa.enabled = settings.postProcess;
    if (!previous || previous.quality !== settings.quality) this.resize();
    this.rebuildIfNeeded();
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  applyTask(projectId: string, task: AgentTask | null): void {
    this.tasks.set(projectId, task);
    this.agents?.applyTask(projectId, task);
    this.activeTasks = [...this.tasks.values()].filter((t) => t?.status === 'running' || t?.status === 'queued').length;
    this.invalidate();
  }

  setExternalWork(projects: Set<string>): void {
    for (const projectId of this.externalWork) {
      if (!projects.has(projectId)) this.agents?.setExternalWork(projectId, false);
    }
    for (const projectId of projects) this.agents?.setExternalWork(projectId, true);
    this.externalWork = projects;
    this.invalidate();
  }

  setScreen(kind: StationKind, data: ScreenData): void {
    this.screens.set(kind, data);
    this.house?.setScreen(kind, data);
    this.invalidate();
  }

  applyBadges(badges: Map<string, AgentBadge>): void {
    for (const projectId of this.badges.keys()) {
      if (!badges.has(projectId)) this.agents?.applyBadge(projectId, null);
    }
    for (const [projectId, badge] of badges) this.agents?.applyBadge(projectId, badge);
    this.badges = badges;
    this.invalidate();
  }

  invalidate(): void {
    this.needsRender = true;
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const quality = this.settings?.quality ?? 'medium';
    const ratio = Math.min(window.devicePixelRatio, quality === 'high' ? 2 : quality === 'medium' ? 1.35 : 1);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
        this.invalidate();
  }

  private updateCamera(dt: number): void {
    const instant = this.reduceMotion.matches;
    const k = instant ? 1000 : 7;
    this.target.x = damp(this.target.x, this.targetGoal.x, k, dt);
    this.target.y = damp(this.target.y, this.targetGoal.y, k, dt);
    this.target.z = damp(this.target.z, this.targetGoal.z, k, dt);
    this.zoom = damp(this.zoom, this.zoomGoal, k, dt);
    this.azimuth = damp(this.azimuth, this.azimuthGoal, instant ? 1000 : 6, dt);

    this.inset = damp(this.inset, this.insetGoal, k, dt);
    const aspect = window.innerWidth / window.innerHeight;
    const shift = (this.inset * this.zoom) / window.innerHeight;
    const { camera } = this;
    camera.left = -this.zoom * aspect + shift;
    camera.right = this.zoom * aspect + shift;
    camera.top = this.zoom;
    camera.bottom = -this.zoom;
    camera.updateProjectionMatrix();
    const distance = 300;
    camera.position.set(
      this.target.x + Math.sin(this.azimuth) * Math.cos(ELEVATION) * distance,
      this.target.y + Math.sin(ELEVATION) * distance,
      this.target.z + Math.cos(this.azimuth) * Math.cos(ELEVATION) * distance,
    );
    camera.lookAt(this.target);
    camera.updateMatrixWorld();

    if (this.house && (this.appliedView.azimuth !== this.azimuth || this.appliedView.floor !== this.activeFloor)) {
      this.house.setView(this.azimuth, this.activeFloor);
      this.appliedView.azimuth = this.azimuth;
      this.appliedView.floor = this.activeFloor;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }

  setAlarm(level: AlarmLevel): void {
    this.alarm.setLevel(level);
    this.invalidate();
  }

  private updateLights(night: number, dt: number, time: number): void {
    if (!this.house) return;
    const alarmPulse = this.alarm.update(time, !this.reduceMotion.matches);
    if (this.alarm.active) {
      const rooms = [...this.house.rooms.values()].filter((room) => room.room.floor === this.activeFloor);
      this.alarm.place(this.house, rooms.map((room) => room.light));
    }
    const working = (room: BuiltRoom) => (room.room.projectId ? (this.agents?.isWorking(room.room.projectId) ?? false) : false);

    this.lightsRetarget -= dt;
    if (this.lightsRetarget <= 0) {
      this.lightsRetarget = 0.4;
      const rooms = [...this.house.rooms.values()]
        .filter((room) => room.room.floor === this.activeFloor)
        .map((room) => ({ room, active: working(room), distance: Math.hypot(room.center.x - this.target.x, room.center.z - this.target.z) }))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.distance - b.distance);
      this.lights.forEach((light, index) => {
        const entry = rooms[index];
        light.userData.on = Boolean(entry);
        light.userData.active = entry?.active ?? false;
        if (!entry) return;
        light.position.set(entry.room.light.x, entry.room.light.y, entry.room.light.z);
        if (entry.active) light.color.copy(this.warmColor).lerp(new Color(entry.room.palette.accent), 0.2);
        else light.color.copy(this.coolColor);
      });
    }
    for (const light of this.lights) {
      const pulse = 1 + Math.sin(time * 2.2) * 0.06;
      const power = !light.userData.on ? 0 : light.userData.active ? 20 * pulse : 2.2;
      light.intensity = power * night;
      if (this.alarm.active) {
        light.color.copy(this.alarm.color);
        light.intensity = light.userData.on ? 2 + alarmPulse * 14 : 0;
      }
    }
    for (const room of this.house.rooms.values()) {
      const active = working(room);
      const material = room.floorMaterial;
      material.emissive.copy(active ? this.warmColor : this.coolColor);
      material.emissiveIntensity = damp(material.emissiveIntensity, night * (active ? 0.38 : 0.035), 3, dt);
      if (this.alarm.active) {
        material.emissive.copy(this.alarm.color);
        material.emissiveIntensity = 0.03 + alarmPulse * 0.3;
      }
    }
  }

  private frame = (now: number) => {
    this.frameId = requestAnimationFrame(this.frame);
    const elapsed = Math.min((now - this.lastFrame) / 1000, 0.25);
    this.lastFrame = now;

    const idleBackground = !this.focused && this.activeTasks === 0 && !this.alarm.active;
    if (idleBackground && !this.needsRender) return;
    const smooth = this.cameraMoving || this.drag !== null || this.settings?.quality === 'high';
    const minInterval = !this.focused ? (this.needsRender ? 1 / 30 : 1 / 15) : smooth ? 1 / 61 : 1 / 31;
    this.frameBudget += elapsed;
    if (this.frameBudget < minInterval) return;
    const dt = Math.min(this.frameBudget, 0.05);
    this.frameBudget = 0;
    this.needsRender = false;

    const motion = !this.reduceMotion.matches;
    this.time += dt;
    const { time } = this;

    this.updateCamera(dt);
    const moving = this.target.distanceTo(this.targetGoal) > 0.01 || Math.abs(this.zoom - this.zoomGoal) > 0.01 || Math.abs(this.azimuth - this.azimuthGoal) > 0.001;
    this.cameraMoving = moving;
    if (moving) this.needsRender = true;
    this.updateHover();

    const mode = this.settings?.dayCycle ?? 'real';
    const state = this.environment.update(time, mode);
    const night = 1 - state.day;
    this.environment.sunLight.position.copy(state.sun).multiplyScalar(this.shadowDistance).add(this.environment.sunLight.target.position);
    setNightLevel(night);
    this.updateLights(night, dt, time);

    const isNight = night > 0.5;
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      this.callbacks.onNightChanged(isNight);
    }

    this.lightScale.setScalar(MathUtils.lerp(0.36, 1.05, state.day));
    this.exterior?.update(motion ? time : 0, motion ? dt : 0, this.lightScale);
    this.house?.update(time, dt);
    this.agents?.setMotion(motion);
    this.agents?.update(time, dt);

    const sunPosition = this.environment.sunLight.position;
    const sunRushing = sunPosition.distanceToSquared(this.lastSun) > 0.0004;
    this.lastSun.copy(sunPosition);
    this.shadowClock += dt;
    if (this.settings?.shadows && this.shadowClock >= (this.agents?.anyWalking || sunRushing ? 0.1 : 1)) {
      this.shadowClock = 0;
      this.renderer.shadowMap.needsUpdate = true;
    }

    this.bloom.enabled = this.bloomAllowed && (night > 0.1 || this.alarm.active);

    this.renderer.autoClear = true;
    this.composer.render(dt);
    this.labelRenderer.render(this.scene, this.camera);
  };

  stats(): { calls: number; triangles: number } {
    return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
  }

  dispose(): void {
    cancelAnimationFrame(this.frameId);
    for (const dispose of this.disposers) dispose();
    this.agents?.dispose();
    this.house?.dispose();
    this.alarm.dispose();
    this.exterior?.dispose();
    this.composer.dispose();
    this.renderer.dispose();
    this.overlay.replaceChildren();
  }
}
