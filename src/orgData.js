// Tree utilities for the org data (a nested tree of people rooted at the CTO).

// Flatten the tree into a flat array of people.
export function flatten(node, acc = []) {
  acc.push(node);
  node.reports?.forEach((child) => flatten(child, acc));
  return acc;
}

// Build lookup indexes from the root node.
export function buildIndex(root) {
  const byId = new Map();
  const parentOf = new Map();
  (function walk(node, parent) {
    byId.set(node.id, node);
    parentOf.set(node.id, parent ? parent.id : null);
    node.reports?.forEach((child) => walk(child, node));
  })(root, null);
  return { byId, parentOf, root };
}

// Manager chain for a person, immediate manager first up to the root.
export function ancestorsOf(index, id) {
  const chain = [];
  let cur = index.parentOf.get(id);
  while (cur) {
    chain.push(index.byId.get(cur));
    cur = index.parentOf.get(cur);
  }
  return chain;
}

// Pick a random person at L3-L1 to emulate as the "logged-in" user.
export function pickEmulatedUser(root) {
  const pool = flatten(root).filter((p) => ["L1", "L2", "L3"].includes(p.level));
  return pool[Math.floor(Math.random() * pool.length)];
}
