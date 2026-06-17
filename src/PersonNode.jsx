import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { colorFor } from "./colors.js";

function initials(name) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// Strip the alliance prefix so "Casino Fleet 2" reads as "Fleet 2" next to the
// alliance chip; squads read as their codename ("Squad Phoenix" -> "Phoenix").
function shortFleet(person) {
  if (!person.fleet) return null;
  return person.alliance
    ? person.fleet.replace(`${person.alliance} `, "")
    : person.fleet;
}
function shortSquad(person) {
  return person.squad ? person.squad.replace(/^Squad\s+/, "") : null;
}

// The secondary "where they sit" line. Squad leads with its name; fleet (or
// "Standalone" for fleet-less squads) follows as context.
function sublineParts(person) {
  const parts = [];
  const fleet = shortFleet(person);
  const squad = shortSquad(person);
  if (squad) parts.push(squad);
  if (fleet) parts.push(fleet);
  else if (squad && person.alliance) parts.push("Standalone");
  return parts;
}

export default function PersonNode({ data }) {
  const { person, isFocus, isMe } = data;
  const { accent, soft } = colorFor(person);
  const [imgOk, setImgOk] = useState(true);

  const groupLabel = person.alliance || person.org;
  const subline = sublineParts(person);

  const classes = ["person-node"];
  if (isFocus) classes.push("is-focus");
  if (isMe) classes.push("is-me");

  return (
    <div
      className={classes.join(" ")}
      style={{
        background: soft,
        borderLeftColor: accent,
        "--accent": accent,
      }}
    >
      <Handle id="t" type="target" position={Position.Top} className="node-handle" />

      <div className="person-avatar" style={{ background: accent }}>
        {imgOk ? (
          <img src={person.photo} alt="" onError={() => setImgOk(false)} />
        ) : (
          <span>{initials(person.name)}</span>
        )}
      </div>

      <div className="person-body">
        <div className="person-name">{person.name}</div>
        <div className="person-title">{person.title}</div>

        <div className="person-meta">
          <span className="level-chip">{person.level}</span>
          <span className="alliance-chip" style={{ color: accent }}>
            <span className="team-dot" style={{ background: accent }} />
            {groupLabel}
          </span>
        </div>

        {subline.length > 0 && (
          <div className="person-subline">{subline.join(" · ")}</div>
        )}
      </div>

      {isMe && <span className="me-tag">You</span>}

      <Handle id="b" type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}
