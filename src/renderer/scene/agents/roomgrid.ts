export class RoomGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;

  constructor(
    readonly originX: number,
    readonly originZ: number,
    width: number,
    depth: number,
    readonly cell = 0.5,
  ) {
    this.cols = Math.max(1, Math.round(width / cell));
    this.rows = Math.max(1, Math.round(depth / cell));
    this.blocked = new Uint8Array(this.cols * this.rows);
  }

  private index(col: number, row: number): number {
    return row * this.cols + col;
  }

  private cellOf(x: number, z: number): [number, number] {
    const col = Math.min(this.cols - 1, Math.max(0, Math.floor((x - this.originX) / this.cell)));
    const row = Math.min(this.rows - 1, Math.max(0, Math.floor((z - this.originZ) / this.cell)));
    return [col, row];
  }

  private center(col: number, row: number): { x: number; z: number } {
    return { x: this.originX + (col + 0.5) * this.cell, z: this.originZ + (row + 0.5) * this.cell };
  }

  block(minX: number, minZ: number, maxX: number, maxZ: number): () => void {
    const changed: number[] = [];
    const [c0, r0] = this.cellOf(minX, minZ);
    const [c1, r1] = this.cellOf(maxX - 1e-3, maxZ - 1e-3);
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const i = this.index(col, row);
        if (!this.blocked[i]) {
          this.blocked[i] = 1;
          changed.push(i);
        }
      }
    }
    return () => {
      for (const i of changed) this.blocked[i] = 0;
    };
  }

  isFree(x: number, z: number): boolean {
    const [col, row] = this.cellOf(x, z);
    return !this.blocked[this.index(col, row)];
  }

  nearestFree(x: number, z: number): { x: number; z: number } | null {
    const [startCol, startRow] = this.cellOf(x, z);
    if (!this.blocked[this.index(startCol, startRow)]) return this.center(startCol, startRow);
    for (let radius = 1; radius < Math.max(this.cols, this.rows); radius++) {
      let best: { x: number; z: number } | null = null;
      let bestDistance = Infinity;
      for (let row = startRow - radius; row <= startRow + radius; row++) {
        for (let col = startCol - radius; col <= startCol + radius; col++) {
          if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) continue;
          if (Math.max(Math.abs(col - startCol), Math.abs(row - startRow)) !== radius) continue;
          if (this.blocked[this.index(col, row)]) continue;
          const center = this.center(col, row);
          const distance = Math.hypot(center.x - x, center.z - z);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = center;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  path(fromX: number, fromZ: number, toX: number, toZ: number): { x: number; z: number }[] | null {
    const start = this.nearestFree(fromX, fromZ);
    const goal = this.nearestFree(toX, toZ);
    if (!start || !goal) return null;
    const [sc, sr] = this.cellOf(start.x, start.z);
    const [gc, gr] = this.cellOf(goal.x, goal.z);
    const startIndex = this.index(sc, sr);
    const goalIndex = this.index(gc, gr);
    const previous = new Int32Array(this.cols * this.rows).fill(-1);
    previous[startIndex] = startIndex;
    const queue = [startIndex];
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
    for (let head = 0; head < queue.length && previous[goalIndex] === -1; head++) {
      const current = queue[head] as number;
      const col = current % this.cols;
      const row = Math.floor(current / this.cols);
      for (const [dc, dr] of DIRS) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const next = this.index(nc, nr);
        if (previous[next] !== -1 || this.blocked[next]) continue;
        if (dc !== 0 && dr !== 0 && (this.blocked[this.index(col + dc, row)] || this.blocked[this.index(col, row + dr)])) continue;
        previous[next] = current;
        queue.push(next);
      }
    }
    if (previous[goalIndex] === -1) return null;

    const cells: number[] = [];
    for (let at = goalIndex; ; at = previous[at] as number) {
      cells.unshift(at);
      if (at === startIndex) break;
    }
    return this.simplify(cells);
  }

  private simplify(cells: number[]): { x: number; z: number }[] {
    const points = cells.map((i) => this.center(i % this.cols, Math.floor(i / this.cols)));
    const out: { x: number; z: number }[] = [];
    let anchor = 0;
    const first = points[0];
    if (first) out.push(first);
    for (let i = 2; i < points.length; i++) {
      const a = points[anchor] as { x: number; z: number };
      const b = points[i] as { x: number; z: number };
      if (!this.lineFree(a, b)) {
        const previous = points[i - 1] as { x: number; z: number };
        out.push(previous);
        anchor = i - 1;
      }
    }
    const last = points[points.length - 1];
    if (last && points.length > 1) out.push(last);
    return out;
  }

  private lineFree(a: { x: number; z: number }, b: { x: number; z: number }): boolean {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(length / (this.cell / 3));
    const side = this.cell * 0.45;
    const nx = length > 0 ? (-(b.z - a.z) / length) * side : 0;
    const nz = length > 0 ? ((b.x - a.x) / length) * side : 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (!this.isFree(x, z) || !this.isFree(x + nx, z + nz) || !this.isFree(x - nx, z - nz)) return false;
    }
    return true;
  }

  connected(fromX: number, fromZ: number, toX: number, toZ: number): boolean {
    return this.path(fromX, fromZ, toX, toZ) !== null;
  }

  randomFree(rng: () => number): { x: number; z: number } | null {
    for (let tries = 0; tries < 40; tries++) {
      const col = Math.floor(rng() * this.cols);
      const row = Math.floor(rng() * this.rows);
      if (!this.blocked[this.index(col, row)]) return this.center(col, row);
    }
    return null;
  }
}
