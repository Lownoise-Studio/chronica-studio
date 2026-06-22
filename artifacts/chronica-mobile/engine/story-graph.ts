import { Fragment, Project } from './types';
import { getGotoTarget, isValidDestination } from './editor-helpers';

export interface StoryGraphNode {
  fragmentUid: string;
  title: string;
  locationId: string;
  hasUnlockRequirements: boolean;
  unlockCount: number;
  isStart: boolean;
  hasBrokenOutgoing: boolean;
  incomingCount: number;
  outgoingCount: number;
  /** BFS depth from start location; null when unreachable */
  depth: number | null;
}

export interface StoryGraphEdge {
  id: string;
  fromFragmentUid: string;
  fromLocationId: string;
  choiceUid: string;
  choiceLabel: string;
  toLocationId: string;
  broken: boolean;
  hasChoiceConditions: boolean;
}

export interface StoryGraph {
  nodes: StoryGraphNode[];
  edges: StoryGraphEdge[];
  knownLocations: Set<string>;
}

export interface StoryGraphSection {
  title: string;
  depth: number | null;
  nodes: StoryGraphNode[];
}

function extractGotoTargets(action: string): string[] {
  return action
    .split(';')
    .map(s => s.trim())
    .filter(s => s.startsWith('goto:'))
    .map(s => s.slice(5).trim())
    .filter(Boolean);
}

export function buildStoryGraph(project: Pick<Project, 'fragments' | 'startLocation'>): StoryGraph {
  const knownLocations = new Set(project.fragments.map(f => f.locationId));
  const edges: StoryGraphEdge[] = [];

  for (const fragment of project.fragments) {
    for (const choice of fragment.choices) {
      const targets = extractGotoTargets(choice.action);
      if (targets.length === 0) {
        const fallback = getGotoTarget(choice.action);
        if (fallback) targets.push(fallback);
      }
      for (const toLocationId of targets) {
        edges.push({
          id: `${fragment.uid}:${choice.uid}:${toLocationId}`,
          fromFragmentUid: fragment.uid,
          fromLocationId: fragment.locationId,
          choiceUid: choice.uid,
          choiceLabel: choice.label.trim() || '(unnamed choice)',
          toLocationId,
          broken: !isValidDestination(toLocationId, knownLocations),
          hasChoiceConditions: (choice.conditions?.length ?? 0) > 0,
        });
      }
    }
  }

  const incomingCount = new Map<string, number>();
  for (const edge of edges) {
    if (edge.broken) continue;
    for (const fragment of project.fragments) {
      if (fragment.locationId === edge.toLocationId) {
        incomingCount.set(fragment.uid, (incomingCount.get(fragment.uid) ?? 0) + 1);
      }
    }
  }

  const outgoingBroken = new Map<string, boolean>();
  const outgoingCount = new Map<string, number>();
  for (const edge of edges) {
    outgoingCount.set(edge.fromFragmentUid, (outgoingCount.get(edge.fromFragmentUid) ?? 0) + 1);
    if (edge.broken) outgoingBroken.set(edge.fromFragmentUid, true);
  }

  const depths = computeLocationDepths(project.fragments, edges, project.startLocation);

  const nodes: StoryGraphNode[] = project.fragments.map(fragment => ({
    fragmentUid: fragment.uid,
    title: fragment.title || fragment.locationId || 'Untitled scene',
    locationId: fragment.locationId,
    hasUnlockRequirements: fragment.conditions.length > 0,
    unlockCount: fragment.conditions.length,
    isStart: fragment.locationId === project.startLocation,
    hasBrokenOutgoing: outgoingBroken.get(fragment.uid) ?? false,
    incomingCount: incomingCount.get(fragment.uid) ?? 0,
    outgoingCount: outgoingCount.get(fragment.uid) ?? 0,
    depth: depths.get(fragment.locationId) ?? null,
  }));

  return { nodes, edges, knownLocations };
}

/** BFS depth per locationId following non-broken goto edges. */
export function computeLocationDepths(
  fragments: Fragment[],
  edges: StoryGraphEdge[],
  startLocation: string,
): Map<string, number> {
  const depths = new Map<string, number>();
  if (!startLocation) return depths;

  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (edge.broken) continue;
    if (!adjacency.has(edge.fromLocationId)) adjacency.set(edge.fromLocationId, new Set());
    adjacency.get(edge.fromLocationId)!.add(edge.toLocationId);
  }

  const queue: string[] = [];
  if (fragments.some(f => f.locationId === startLocation)) {
    depths.set(startLocation, 0);
    queue.push(startLocation);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const nextDepth = (depths.get(current) ?? 0) + 1;
    for (const target of adjacency.get(current) ?? []) {
      if (depths.has(target)) continue;
      depths.set(target, nextDepth);
      queue.push(target);
    }
  }

  return depths;
}

export function groupGraphNodes(nodes: StoryGraphNode[]): StoryGraphSection[] {
  const byDepth = new Map<number | 'unconnected', StoryGraphNode[]>();

  for (const node of nodes) {
    const key = node.depth === null ? 'unconnected' : node.depth;
    if (!byDepth.has(key)) byDepth.set(key, []);
    byDepth.get(key)!.push(node);
  }

  const sections: StoryGraphSection[] = [];

  const connectedDepths = [...byDepth.keys()]
    .filter((k): k is number => k !== 'unconnected')
    .sort((a, b) => a - b);

  for (const depth of connectedDepths) {
    const group = byDepth.get(depth)!;
    sections.push({
      title: depth === 0 ? 'Opening' : `Step ${depth}`,
      depth,
      nodes: sortNodes(group),
    });
  }

  const unconnected = byDepth.get('unconnected');
  if (unconnected?.length) {
    sections.push({
      title: 'Unconnected',
      depth: null,
      nodes: sortNodes(unconnected),
    });
  }

  return sections;
}

function sortNodes(nodes: StoryGraphNode[]): StoryGraphNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isStart !== b.isStart) return a.isStart ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export function getOutgoingEdges(edges: StoryGraphEdge[], fragmentUid: string): StoryGraphEdge[] {
  return edges.filter(e => e.fromFragmentUid === fragmentUid);
}

export function resolveLocationTitle(
  fragments: Fragment[],
  locationId: string,
): string {
  const match = fragments.find(f => f.locationId === locationId);
  return match?.title || locationId;
}
