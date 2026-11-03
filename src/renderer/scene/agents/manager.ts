import { Group, Vector3 } from 'three';
import { createRng, pick, shuffled, type Rng } from '@shared/random';
import type { AgentTask, Project } from '@shared/types';
import type { BuiltHouse } from '../house/house';
import { CELL, FLOOR_HEIGHT, type NavNode } from '../house/layout';
import { INTERACTIVE_LAYER, type BuiltRoom, type Interactive } from '../house/rooms/room';
import { Avatar } from './avatar';
import { ConversationBadge, QuestBubble, type AgentBadge, type BubbleState } from './bubble';
import { findPath, indexGraph, type NavIndex } from './nav';

const SPEED = 1.2;
const SEPARATION_RADIUS = 1.15;
const MAX_AVOID = 0.42;
const YIELD_DISTANCE = 1.05;
const MAX_YIELD = 2.6;
const SIDESTEP = 0.62;
const CORRIDOR_LANE = 0.44;
const SPOT_DISTANCE = 1.35;

interface Waypoint {
  x: number;
  y: number;
  z: number;
  tight?: boolean;
}

type Mode = 'idle' | 'walking' | 'visiting' | 'chatting' | 'seated';

interface Agent {
  project: Project;
  home: BuiltRoom;
  favorites: BuiltRoom[];
  avatar: Avatar;
  bubble: QuestBubble;
  badge: ConversationBadge;
  object: Group;
  interactive: Interactive;
  rng: Rng;
  mode: Mode;
  room: BuiltRoom;
  targetRoom: BuiltRoom | null;
  path: Waypoint[];
  wait: number;
  position: Vector3;
  avoid: Vector3;
  heading: number;
  busy: boolean;
  taskWork: boolean;
  externalWork: boolean;
  onArrive: (() => void) | null;
  floor: number;
  dest: { x: number; z: number };
  yielded: number;
  stepAside: number;
}

export class AgentManager {
  readonly group = new Group();
  private agents = new Map<string, Agent>();
  private nav: NavIndex;
  private activeFloor = 0;
  private tasksByProject = new Map<string, AgentTask>();
  private motion = true;

  constructor(
    private house: BuiltHouse,
    projects: Project[],
    private onBubbleClick: (projectId: string, taskId: string | null) => void,
  ) {
    this.nav = indexGraph(house.layout.navGraph);
    for (const project of projects) {
      const home = house.roomByProject.get(project.id);
      if (home) this.spawn(project, home);
    }
  }

  private spawn(project: Project, home: BuiltRoom): void {
    const rng = createRng(project.seed ^ 0xa6e47);
    const avatar = new Avatar(project.color, rng() * 10);
    const start = this.pickSpot(home, rng, null) ?? home.doorInner;

    const others = [...this.house.rooms.values()].filter((room) => room !== home);
    const favorites = shuffled(rng, others).slice(0, 2 + Math.floor(rng() * 2));

    const bubble = new QuestBubble(() => {
      const task = this.tasksByProject.get(project.id);
      this.onBubbleClick(project.id, task?.id ?? null);
    });
    avatar.root.add(bubble.object);
    const badge = new ConversationBadge(() => this.onBubbleClick(project.id, this.tasksByProject.get(project.id)?.id ?? null));
    avatar.root.add(badge.object);
    avatar.root.traverse((node) => node.layers.enable(INTERACTIVE_LAYER));

    const y = home.room.floor * FLOOR_HEIGHT;
    const position = new Vector3(start.x, y, start.z);
    avatar.root.position.copy(position);
    this.group.add(avatar.root);

    const agent: Agent = {
      project,
      home,
      favorites,
      avatar,
      bubble,
      badge,
      object: avatar.root,
      rng,
      mode: 'idle',
      room: home,
      targetRoom: null,
      path: [],
      wait: 0.5 + rng() * 3,
      position,
      avoid: new Vector3(),
      heading: rng() * Math.PI * 2,
      busy: false,
      taskWork: false,
      externalWork: false,
      onArrive: null,
      floor: home.room.floor,
      dest: { x: start.x, z: start.z },
      yielded: 0,
      stepAside: 0,
      interactive: { kind: 'agent', projectId: project.id, roomId: home.room.id, floor: home.room.floor, object: avatar.root, color: project.color },
    };
    this.agents.set(project.id, agent);
  }

  get interactives(): Interactive[] {
    return [...this.agents.values()]
      .filter((agent) => agent.floor === this.activeFloor)
      .map((agent) => {
        agent.interactive.floor = agent.floor;
        return agent.interactive;
      });
  }

  setActiveFloor(floor: number): void {
    this.activeFloor = floor;
  }

  setMotion(motion: boolean): void {
    this.motion = motion;
  }

  positionOf(projectId: string): Vector3 | null {
    return this.agents.get(projectId)?.position.clone() ?? null;
  }

  floorOf(projectId: string): number | null {
    return this.agents.get(projectId)?.floor ?? null;
  }

  applyTask(projectId: string, task: AgentTask | null): void {
    const agent = this.agents.get(projectId);
    if (!agent) return;
    if (task) this.tasksByProject.set(projectId, task);
    else this.tasksByProject.delete(projectId);

    const shown = bubbleFor(task);
    agent.bubble.set(shown?.state ?? null, shown?.text ?? '');

    agent.taskWork = task?.status === 'running' || task?.status === 'queued';
    this.refreshWork(agent);
  }

  setExternalWork(projectId: string, working: boolean): void {
    const agent = this.agents.get(projectId);
    if (!agent || agent.externalWork === working) return;
    agent.externalWork = working;
    this.refreshWork(agent);
  }

  isWorking(projectId: string): boolean {
    return this.agents.get(projectId)?.busy ?? false;
  }

  private refreshWork(agent: Agent): void {
    const working = agent.taskWork || agent.externalWork;
    if (agent.home.screen) agent.home.screen.uniforms.uActive!.value = working ? 1 : 0;
    if (working && !agent.busy) {
      agent.busy = true;
      this.sendToDesk(agent);
    } else if (!working && agent.busy) {
      agent.busy = false;
      if (agent.mode === 'seated') this.standUp(agent);
    }
  }

  applyBadge(projectId: string, badge: AgentBadge | null): void {
    this.agents.get(projectId)?.badge.set(badge);
  }

  private standUp(agent: Agent): void {
    const stand = agent.home.seatStand;
    agent.avatar.typing = false;
    const rest = () => {
      agent.mode = 'idle';
      agent.wait = 1 + agent.rng() * 2;
    };
    if (!stand) return rest();
    agent.path = [{ x: stand.x, y: agent.home.room.floor * FLOOR_HEIGHT, z: stand.z, tight: true }];
    agent.targetRoom = agent.home;
    agent.mode = 'walking';
    agent.onArrive = rest;
  }

  private pickSpot(room: BuiltRoom, rng: Rng, self: Agent | null): { x: number; z: number } | null {
    const candidates = shuffled(rng, room.pois);
    for (let i = 0; i < 4; i++) {
      const free = room.grid.randomFree(rng);
      if (free) candidates.push(free);
    }
    const others = [...this.agents.values()].filter((other) => other !== self && other.floor === room.room.floor);
    for (const candidate of candidates) {
      const spot = room.grid.nearestFree(candidate.x, candidate.z) ?? candidate;
      const taken = others.some(
        (other) =>
          Math.hypot(other.dest.x - spot.x, other.dest.z - spot.z) < SPOT_DISTANCE ||
          Math.hypot(other.position.x - spot.x, other.position.z - spot.z) < SPOT_DISTANCE,
      );
      if (!taken) return spot;
    }
    return null;
  }

  private sendToDesk(agent: Agent): void {
    const { home } = agent;
    if (!home.seat || !home.seatStand) return;
    if (agent.mode === 'seated') return;
    if (agent.mode === 'walking') {
      agent.onArrive = () => {
        agent.mode = 'idle';
        agent.wait = 0;
      };
      return;
    }
    agent.avatar.chatting = false;
    const seat = home.seat;
    const floorY = home.room.floor * FLOOR_HEIGHT;
    const path = this.routeTo(agent, home, home.seatStand);
    path.push({ x: seat.x, y: seat.y + floorY, z: seat.z, tight: true });
    agent.path = path;
    agent.dest = { x: seat.x, z: seat.z };
    agent.targetRoom = home;
    agent.mode = 'walking';
    agent.onArrive = () => {
      agent.heading = seat.ry;
      agent.avatar.typing = true;
      agent.mode = 'seated';
    };
  }

  private roomAt(floor: number, x: number, z: number): BuiltRoom | null {
    for (const room of this.house.rooms.values()) {
      const { x: rx, z: rz, w, d, floor: roomFloor } = room.room;
      if (roomFloor === floor && x >= rx * CELL && x <= (rx + w) * CELL && z >= rz * CELL && z <= (rz + d) * CELL) return room;
    }
    return null;
  }

  private routeTo(agent: Agent, room: BuiltRoom, point: { x: number; z: number }): Waypoint[] {
    const undo: (() => void)[] = [];
    for (const other of this.agents.values()) {
      if (other === agent || other.mode === 'walking' || other.mode === 'seated') continue;
      const { x, z } = other.position;
      const area = this.roomAt(other.floor, x, z);
      if (area) undo.push(area.grid.block(x - 0.6, z - 0.6, x + 0.6, z + 0.6));
    }
    const route = this.computeRoute(agent, room, point);
    for (const release of undo) release();
    return route;
  }

  private computeRoute(agent: Agent, room: BuiltRoom, point: { x: number; z: number }): Waypoint[] {
    const { position } = agent;
    const currentY = agent.room.room.floor * FLOOR_HEIGHT;
    if (room === agent.room) {
      const local = room.grid.path(position.x, position.z, point.x, point.z) ?? [point];
      return local.map((p) => ({ x: p.x, y: currentY, z: p.z }));
    }
    const out: Waypoint[] = [];
    const leave = agent.room.grid.path(position.x, position.z, agent.room.doorInner.x, agent.room.doorInner.z) ?? [agent.room.doorInner];
    for (const p of leave) out.push({ x: p.x, y: currentY, z: p.z });

    const graphPath = findPath(this.nav, `room:${agent.room.room.id}`, `room:${room.room.id}`) ?? [];
    for (const node of graphPath) {
      if (node.kind === 'room') continue;
      const lane = node.kind === 'corridor' ? laneOffset(graphPath, node) : { x: 0, z: 0 };
      out.push({ x: node.x + lane.x, y: node.floor * FLOOR_HEIGHT, z: node.z + lane.z, tight: node.kind === 'door' });
    }

    const arriveY = room.room.floor * FLOOR_HEIGHT;
    const enter = room.grid.path(room.doorInner.x, room.doorInner.z, point.x, point.z) ?? [point];
    out.push({ x: room.doorInner.x, y: arriveY, z: room.doorInner.z, tight: true });
    for (const p of enter) out.push({ x: p.x, y: arriveY, z: p.z });
    return out;
  }

  private think(agent: Agent): void {
    const { rng, home } = agent;
    if (agent.busy) {
      this.sendToDesk(agent);
      return;
    }
    const roll = rng();
    let targetRoom = home;
    if (agent.room !== home && roll < 0.7) targetRoom = home;
    else if (roll < 0.28 && agent.favorites.length > 0) targetRoom = pick(rng, agent.favorites);
    else if (agent.room !== home) targetRoom = agent.room;

    const point = this.pickSpot(targetRoom, rng, agent);
    if (!point) {
      agent.wait = 2 + rng() * 3;
      return;
    }
    agent.dest = point;
    agent.path = this.routeTo(agent, targetRoom, point);
    agent.targetRoom = targetRoom;
    agent.mode = 'walking';
    agent.onArrive = () => {
      agent.mode = targetRoom === home ? 'idle' : 'visiting';
      agent.wait = targetRoom === home ? 2 + rng() * 5 : 5 + rng() * 7;
    };
  }

  get anyWalking(): boolean {
    for (const agent of this.agents.values()) if (agent.mode === 'walking') return true;
    return false;
  }

  update(time: number, dt: number): void {
    for (const agent of this.agents.values()) {
      this.step(agent, dt);
      agent.avatar.update(time, this.motion);
      const visibleFloor = agent.floor === this.activeFloor;
      agent.object.visible = visibleFloor;
      agent.bubble.setVisible(visibleFloor);
      agent.badge.setVisible(visibleFloor);
    }
    this.separate(dt);
    this.findChats();
  }

  private step(agent: Agent, dt: number): void {
    const { position, avatar } = agent;
    if (agent.mode === 'walking') {
      this.follow(agent, dt);
    } else {
      avatar.walking = Math.max(0, avatar.walking - dt * 5);
      if (agent.mode === 'idle' || agent.mode === 'visiting' || agent.mode === 'chatting') {
        agent.wait -= dt;
        if (agent.wait <= 0) {
          avatar.chatting = false;
          this.think(agent);
        }
      }
    }
    agent.object.position.set(position.x + agent.avoid.x, position.y, position.z + agent.avoid.z);

    const delta = Math.atan2(Math.sin(agent.heading - agent.object.rotation.y), Math.cos(agent.heading - agent.object.rotation.y));
    agent.object.rotation.y += delta * Math.min(1, dt * 9);
  }

  private follow(agent: Agent, dt: number): void {
    const { position, avatar } = agent;
    agent.stepAside = this.mustYield(agent);
    if (agent.stepAside !== 0) {
      agent.yielded += dt;
      avatar.walking = Math.max(0, avatar.walking - dt * 5);
      return;
    }
    agent.yielded = Math.max(0, agent.yielded - dt * 0.5);
    let budget = SPEED * dt;
    while (budget > 0) {
      const next = agent.path[0];
      if (!next) {
        const arrive = agent.onArrive;
        agent.onArrive = null;
        if (agent.targetRoom) agent.room = agent.targetRoom;
        agent.interactive.roomId = agent.room.room.id;
        if (arrive) arrive();
        else agent.mode = 'idle';
        return;
      }
      const dx = next.x - position.x;
      const dz = next.z - position.z;
      const dy = next.y - position.y;
      const distance = Math.hypot(dx, dz, dy);
      if (distance < 1e-3) {
        agent.path.shift();
        continue;
      }
      if (Math.hypot(dx, dz) > 0.01) agent.heading = Math.atan2(dx, dz);
      const move = Math.min(budget, distance);
      const t = move / distance;
      position.x += dx * t;
      position.y += dy * t;
      position.z += dz * t;
      budget -= move;
      if (move >= distance - 1e-4) {
        agent.path.shift();
      }
    }
    agent.floor = Math.round(position.y / FLOOR_HEIGHT);
    avatar.walking = Math.min(1, avatar.walking + dt * 6);
  }

  private mustYield(agent: Agent): number {
    if (agent.yielded > MAX_YIELD) return 0;
    const next = agent.path[0];
    if (!next) return 0;
    const dirX = next.x - agent.position.x;
    const dirZ = next.z - agent.position.z;
    const length = Math.hypot(dirX, dirZ);
    if (length < 1e-3) return 0;
    for (const other of this.agents.values()) {
      if (other === agent || other.floor !== agent.floor || other.mode !== 'walking') continue;
      if (other.project.seed > agent.project.seed) continue;
      const dx = other.position.x - agent.position.x;
      const dz = other.position.z - agent.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= YIELD_DISTANCE || (dx * dirX + dz * dirZ) / (distance * length) <= 0.35) continue;
      return dirX * dz - dirZ * dx >= 0 ? -1 : 1;
    }
    return 0;
  }

  private offsetAllowed(agent: Agent, x: number, z: number): boolean {
    const room = this.roomAt(agent.floor, x, z);
    return room ? room.grid.isFree(x, z) : true;
  }

  private separate(dt: number): void {
    const agents = [...this.agents.values()];
    for (const agent of agents) {
      if (agent.mode === 'seated') {
        agent.avoid.set(0, 0, 0);
        continue;
      }
      let px = 0;
      let pz = 0;
      for (const other of agents) {
        if (other === agent || other.floor !== agent.floor) continue;
        const dx = agent.position.x - other.position.x;
        const dz = agent.position.z - other.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.001 && distance < SEPARATION_RADIUS) {
          const strength = (SEPARATION_RADIUS - distance) / SEPARATION_RADIUS;
          px += (dx / distance) * strength;
          pz += (dz / distance) * strength;
        }
      }
      let targetX = Math.max(-MAX_AVOID, Math.min(MAX_AVOID, px));
      let targetZ = Math.max(-MAX_AVOID, Math.min(MAX_AVOID, pz));
      const nearDoor = agent.path[0]?.tight || agent.path[1]?.tight;
      if (agent.stepAside !== 0 && agent.path[0]) {
        const dirX = agent.path[0].x - agent.position.x;
        const dirZ = agent.path[0].z - agent.position.z;
        const length = Math.hypot(dirX, dirZ) || 1;
        const sideX = (-dirZ / length) * SIDESTEP * agent.stepAside;
        const sideZ = (dirX / length) * SIDESTEP * agent.stepAside;
        const inDoorway = Math.hypot(dirX, dirZ) < 0.7 && agent.path[0].tight;
        if (!inDoorway && this.offsetAllowed(agent, agent.position.x + sideX, agent.position.z + sideZ)) {
          targetX = sideX;
          targetZ = sideZ;
        }
      } else if (nearDoor || !this.offsetAllowed(agent, agent.position.x + targetX, agent.position.z + targetZ)) {
        targetX = 0;
        targetZ = 0;
      }
      const k = Math.min(1, dt * 5);
      agent.avoid.x += (targetX - agent.avoid.x) * k;
      agent.avoid.z += (targetZ - agent.avoid.z) * k;
    }
  }

  private findChats(): void {
    const agents = [...this.agents.values()].filter((a) => a.mode === 'visiting');
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i] as Agent;
      if (a.avatar.chatting) continue;
      for (let j = i + 1; j < agents.length; j++) {
        const b = agents[j] as Agent;
        if (b.avatar.chatting || a.floor !== b.floor) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        if (Math.hypot(dx, dz) > 2.6) continue;
        a.heading = Math.atan2(dx, dz);
        b.heading = Math.atan2(-dx, -dz);
        a.avatar.chatting = b.avatar.chatting = true;
        a.mode = b.mode = 'chatting';
        a.wait = b.wait = 3.5 + a.rng() * 3;
        break;
      }
    }
  }

  dispose(): void {
    for (const agent of this.agents.values()) {
      agent.bubble.dispose();
      agent.badge.dispose();
      agent.avatar.dispose();
    }
    this.group.clear();
    this.agents.clear();
  }
}

function laneOffset(path: NavNode[], node: NavNode): { x: number; z: number } {
  const corridor = path.filter((step) => step.kind === 'corridor');
  const index = corridor.indexOf(node);
  const next = corridor[index + 1];
  const previous = corridor[index - 1];
  const from = next ? node : previous;
  const to = next ?? node;
  if (!from || from === to) return { x: 0, z: 0 };
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  if (Math.abs(dx) >= Math.abs(dz)) return { x: 0, z: Math.sign(dx) * CORRIDOR_LANE };
  return { x: -Math.sign(dz) * CORRIDOR_LANE, z: 0 };
}

function bubbleFor(task: AgentTask | null): { state: BubbleState; text: string } | null {
  if (!task) return null;
  switch (task.status) {
    case 'running':
    case 'queued':
      return { state: 'running', text: task.progress };
    case 'waiting':
      return task.acknowledged ? null : { state: 'waiting', text: task.progress };
    case 'done':
      return task.acknowledged ? null : { state: 'done', text: task.progress };
    case 'error':
      return task.acknowledged ? null : { state: 'error', text: task.progress };
    case 'cancelled':
      return null;
  }
}
