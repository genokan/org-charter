import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import PersonNode from "./PersonNode.jsx";
import ICNode from "./ICNode.jsx";
import { buildGraph, focusScopeIds } from "./orgView.js";
import { ancestorsOf, flatten, pickEmulatedUser } from "./orgData.js";
import { ALLIANCE_NAMES, allianceAccent } from "./colors.js";

const nodeTypes = { person: PersonNode, ic: ICNode };
const PAN_PADDING = 600;
const LEADERSHIP_ROLES = new Set(["executive", "vp", "director", "manager"]);

export default function OrgChart({ index }) {
  // Emulated logged-in user: a random L3-L1 person, drawn once. Seeding "me"
  // and the initial focus in the same place keeps them in sync.
  const [meId] = useState(() => pickEmulatedUser(index.root).id);
  const [focusId, setFocusId] = useState(meId);
  const [view, setView] = useState("focus"); // focus (restructured) | spotlight
  const [dimActive, setDimActive] = useState(true); // spotlight: blur the rest
  const [levelFilter, setLevelFilter] = useState("all"); // all | leadership
  const [allianceFilter, setAllianceFilter] = useState("all");

  const { fitView, setCenter } = useReactFlow();

  const filtersActive = levelFilter !== "all" || allianceFilter !== "all";

  // The people that make up the current focus person's org (level-aware).
  const focusSet = useMemo(
    () => focusScopeIds(index, focusId),
    [index, focusId]
  );

  // Spotlight renders the whole org (narrowed by filters); focus renders only
  // the focus person's org, restructured compactly.
  const spotlightVisible = useMemo(() => {
    const set = new Set();
    const matches = (p) =>
      (levelFilter === "all" || LEADERSHIP_ROLES.has(p.role)) &&
      (allianceFilter === "all" || p.alliance === allianceFilter);
    for (const p of flatten(index.root)) {
      if (!matches(p)) continue;
      set.add(p.id);
      let cur = index.parentOf.get(p.id);
      while (cur) {
        set.add(cur);
        cur = index.parentOf.get(cur);
      }
    }
    return set;
  }, [index, levelFilter, allianceFilter]);

  const visible = view === "focus" ? focusSet : spotlightVisible;

  const { nodes: baseNodes, edges: baseEdges, bounds, centers } = useMemo(
    () => buildGraph(index, visible),
    [index, visible]
  );

  // In spotlight, dim everything outside the focus person's org.
  const dimSet = view === "spotlight" && dimActive ? focusSet : null;

  const nodes = useMemo(
    () =>
      baseNodes.map((n) => ({
        ...n,
        className: dimSet && !dimSet.has(n.id) ? "node-dimmed" : undefined,
        data: { ...n.data, isFocus: n.id === focusId, isMe: n.id === meId },
      })),
    [baseNodes, focusId, meId, dimSet]
  );

  const edges = useMemo(
    () =>
      baseEdges.map((e) => ({
        ...e,
        className:
          dimSet && !(dimSet.has(e.source) && dimSet.has(e.target))
            ? "edge-dimmed"
            : undefined,
      })),
    [baseEdges, dimSet]
  );

  const translateExtent = useMemo(
    () => [
      [bounds.minX - PAN_PADDING, bounds.minY - PAN_PADDING],
      [bounds.maxX + PAN_PADDING, bounds.maxY + PAN_PADDING],
    ],
    [bounds]
  );

  const minZoom = useMemo(() => {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const fit = Math.min(
      (window.innerWidth - 80) / w,
      (window.innerHeight - 160) / h
    );
    return Math.max(0.04, Math.min(0.6, fit * 0.85));
  }, [bounds]);

  // Re-frame on view/focus/filter change — but NOT when only the blur toggles,
  // so clicking off to unblur keeps your place. In spotlight we center on the
  // focus person (instead of refitting the whole org) for the same reason.
  useEffect(() => {
    const t = setTimeout(() => {
      if (view === "focus") {
        fitView({ duration: 600, padding: 0.2, maxZoom: 1.1 });
      } else if (filtersActive || !centers.has(focusId)) {
        fitView({ duration: 600, padding: 0.08, maxZoom: 1.4 });
      } else {
        const c = centers.get(focusId);
        setCenter(c.cx, c.cy, { zoom: 0.62, duration: 600 });
      }
    }, 90);
    return () => clearTimeout(t);
  }, [view, focusId, visible, filtersActive, centers, fitView, setCenter]);

  // Clicking a card focuses that person (and re-arms the spotlight blur).
  const onNodeClick = useCallback((_event, node) => {
    setFocusId(node.id);
    setDimActive(true);
  }, []);

  // Clicking empty canvas: in spotlight, just clear the blur in place so you
  // can roam without losing your spot.
  const onPaneClick = useCallback(() => {
    if (view === "spotlight") setDimActive(false);
  }, [view]);

  const breadcrumb = useMemo(() => {
    const chain = ancestorsOf(index, focusId).reverse();
    chain.push(index.byId.get(focusId));
    return chain;
  }, [index, focusId]);

  const goToFocus = (id) => {
    setFocusId(id);
    setDimActive(true);
  };

  const me = index.byId.get(meId);

  return (
    <div className="org-chart">
      <header className="org-toolbar">
        <nav className="breadcrumb" aria-label="Manager path">
          {breadcrumb.map((person, i) => (
            <span key={person.id} className="crumb-wrap">
              {i > 0 && <span className="crumb-sep">›</span>}
              <button
                type="button"
                className={
                  "crumb" + (person.id === focusId ? " crumb-current" : "")
                }
                onClick={() => goToFocus(person.id)}
                title={person.title}
              >
                {person.name}
              </button>
            </span>
          ))}
        </nav>

        <div className="toolbar-actions">
          <div className="seg" role="group" aria-label="View mode">
            <button
              type="button"
              className={"seg-btn" + (view === "focus" ? " active" : "")}
              onClick={() => setView("focus")}
              title="Restructured view of this person's org"
            >
              Focus
            </button>
            <button
              type="button"
              className={"seg-btn" + (view === "spotlight" ? " active" : "")}
              onClick={() => {
                setView("spotlight");
                setDimActive(true);
              }}
              title="Whole org with this person's team highlighted"
            >
              Spotlight
            </button>
          </div>

          <select
            className="filter-select"
            value={allianceFilter}
            onChange={(e) => {
              setAllianceFilter(e.target.value);
              setView("spotlight");
            }}
            aria-label="Alliance filter"
          >
            <option value="all">All alliances</option>
            {ALLIANCE_NAMES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={"tool-btn" + (levelFilter === "leadership" ? " active" : "")}
            onClick={() => {
              setLevelFilter(levelFilter === "leadership" ? "all" : "leadership");
              setView("spotlight");
            }}
          >
            Leadership only
          </button>

          <button
            type="button"
            className="tool-btn primary"
            onClick={() => {
              goToFocus(meId);
              setView("focus");
            }}
          >
            Back to me · {me.name}
          </button>
        </div>
      </header>

      <div className="org-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          minZoom={minZoom}
          maxZoom={1.4}
          translateExtent={translateExtent}
          defaultEdgeOptions={{ style: { stroke: "#c7cbe0", strokeWidth: 1.5 } }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={26} color="#e6e8f0" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
          <Legend />
        </ReactFlow>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="org-legend">
      <div className="legend-title">Alliances</div>
      <div className="legend-items">
        {ALLIANCE_NAMES.map((name) => (
          <span key={name} className="legend-item">
            <span
              className="legend-dot"
              style={{ background: allianceAccent(name) }}
            />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
