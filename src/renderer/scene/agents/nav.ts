import type { NavEdge, NavGraph, NavNode } from '../house/layout';

export interface NavIndex {
  nodes: Map<string, NavNode>;
  adjacency: Map<string, { to: string; cost: number }[]>;
}

export function indexGraph(graph: NavGraph): NavIndex {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, { to: string; cost: number }[]>();
  const push = (from: string, edge: NavEdge, to: string) => {
    const list = adjacency.get(from);
    if (list) list.push({ to, cost: edge.cost });
    else adjacency.set(from, [{ to, cost: edge.cost }]);
  };
  for (const edge of graph.edges) {
    push(edge.a, edge, edge.b);
    push(edge.b, edge, edge.a);
  }
  return { nodes, adjacency };
}

export function findPath(index: NavIndex, from: string, to: string): NavNode[] | null {
  const goal = index.nodes.get(to);
  const start = index.nodes.get(from);
  if (!goal || !start) return null;

  const heuristic = (node: NavNode) => Math.hypot(node.x - goal.x, node.z - goal.z);
  const open = new Set<string>([from]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[from, 0]]);
  const fScore = new Map<string, number>([[from, heuristic(start)]]);

  while (open.size > 0) {
    let current = '';
    let best = Infinity;
    for (const id of open) {
      const score = fScore.get(id) ?? Infinity;
      if (score < best) {
        best = score;
        current = id;
      }
    }
    if (current === to) {
      const path: NavNode[] = [];
      let step: string | undefined = current;
      while (step) {
        const node = index.nodes.get(step);
        if (node) path.unshift(node);
        step = cameFrom.get(step);
      }
      return path;
    }
    open.delete(current);
    for (const { to: next, cost } of index.adjacency.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(next) ?? Infinity)) {
        cameFrom.set(next, current);
        gScore.set(next, tentative);
        const node = index.nodes.get(next);
        fScore.set(next, tentative + (node ? heuristic(node) : 0));
        open.add(next);
      }
    }
  }
  return null;
}
