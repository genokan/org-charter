// Builds the org as a React Flow graph using a *compact* layout:
//   - Management (CTO -> VP -> Director -> Eng Manager -> Team Lead) is laid
//     out as a normal top-down tree with dagre.
//   - Each team's ICs are stacked vertically in a column beneath their lead,
//     joined by a left-spine connector (the classic compact org-chart style).
// This keeps the chart from sprawling horizontally across hundreds of ICs.

import dagre from "@dagrejs/dagre";
import { flatten } from "./orgData.js";

export const NODE_W = 244;
export const NODE_H = 120;
export const IC_W = 216;
export const IC_H = 56;
const IC_GAP = 8;
const IC_TOP_GAP = 26;

const isIC = (p) => p.role === "ic";

// Nearest ancestor that is part of the visible set (for connecting edges when
// intermediate managers are filtered out).
function nearestVisibleParent(index, id, visible) {
  let cur = index.parentOf.get(id);
  while (cur && !visible.has(cur)) cur = index.parentOf.get(cur);
  return cur || null;
}

function bbox() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  return {
    add(x, y, w, h) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    },
    get bounds() {
      return { minX, minY, maxX, maxY };
    },
  };
}

// `visible` is an optional Set of person ids to render (for filters). When
// omitted, the whole org is laid out.
export function buildGraph(index, visible) {
  let people = flatten(index.root);
  if (visible) people = people.filter((p) => visible.has(p.id));
  const visibleSet = visible || new Set(people.map((p) => p.id));
  const structural = people.filter((p) => !isIC(p));

  // ---- Lay out the management tree with dagre ----
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 30, ranksep: 80 });
  g.setDefaultEdgeLabel(() => ({}));

  const edges = [];
  for (const p of structural) g.setNode(p.id, { width: NODE_W, height: NODE_H });
  for (const p of structural) {
    const parentId = nearestVisibleParent(index, p.id, visibleSet);
    if (parentId) {
      // Keep every team lead on the same rank: a lead reporting straight to a
      // director (a "standalone" squad) needs an extra rank so its IC column
      // hangs into open space instead of overlapping other teams.
      const parentRole = index.byId.get(parentId).role;
      const minlen =
        p.role === "team_lead" && parentRole !== "manager" ? 2 : 1;
      g.setEdge(parentId, p.id, { minlen });
      edges.push({
        id: `${parentId}->${p.id}`,
        source: parentId,
        target: p.id,
        type: "smoothstep",
        sourceHandle: "b",
        targetHandle: "t",
      });
    }
  }
  dagre.layout(g);

  const box = bbox();
  const nodes = [];
  const centers = new Map();

  for (const p of structural) {
    const pos = g.node(p.id);
    const x = pos.x - NODE_W / 2;
    const y = pos.y - NODE_H / 2;
    nodes.push({ id: p.id, type: "person", position: { x, y }, data: { person: p } });
    centers.set(p.id, { cx: pos.x, cy: pos.y, w: NODE_W, h: NODE_H });
    box.add(x, y, NODE_W, NODE_H);
  }

  // ---- Stack each team's ICs vertically under their lead ----
  const icsByLead = new Map();
  for (const p of people) {
    if (!isIC(p)) continue;
    const leadId = index.parentOf.get(p.id);
    if (!icsByLead.has(leadId)) icsByLead.set(leadId, []);
    icsByLead.get(leadId).push(p);
  }

  for (const [leadId, ics] of icsByLead) {
    const lead = g.node(leadId);
    if (!lead) continue; // lead filtered out
    const colX = lead.x; // spine drops from the lead's center
    const startY = lead.y + NODE_H / 2 + IC_TOP_GAP;
    ics.forEach((p, i) => {
      const x = colX;
      const y = startY + i * (IC_H + IC_GAP);
      nodes.push({ id: p.id, type: "ic", position: { x, y }, data: { person: p } });
      centers.set(p.id, { cx: x + IC_W / 2, cy: y + IC_H / 2, w: IC_W, h: IC_H });
      edges.push({
        id: `${leadId}->${p.id}`,
        source: leadId,
        target: p.id,
        type: "smoothstep",
        sourceHandle: "b",
        targetHandle: "l",
      });
      box.add(x, y, IC_W, IC_H);
    });
  }

  return { nodes, edges, bounds: box.bounds, centers };
}

// How much to show around a focused person, by their level. Senior people
// care more about the org *below* them than how far they sit from the CTO, so
// ancestors shrink and descendants grow as you go up.
const FOCUS = {
  L5: { up: 0, down: 2 },
  L4: { up: 1, down: 2 },
  L3: { up: 1, down: 2 },
  L2: { up: 1, down: 2 },
  L1: { up: 2, down: 1 },
};

// The set of people that make up a person's focus view: a few managers above
// (per level), their org a couple levels below, and — for a leaf IC — their
// squad peers so they still see their team.
export function focusScopeIds(index, id) {
  const { byId, parentOf } = index;
  const node = byId.get(id);
  const cfg = FOCUS[node.level] || { up: 1, down: 1 };
  const ids = new Set([id]);

  let cur = parentOf.get(id);
  for (let i = 0; i < cfg.up && cur; i++) {
    ids.add(cur);
    cur = parentOf.get(cur);
  }

  (function descend(n, depth) {
    if (depth <= 0) return;
    n.reports?.forEach((child) => {
      ids.add(child.id);
      descend(child, depth - 1);
    });
  })(node, cfg.down);

  if (!node.reports || node.reports.length === 0) {
    const parentId = parentOf.get(id);
    if (parentId) byId.get(parentId).reports.forEach((p) => ids.add(p.id));
  }

  return ids;
}
