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

// Compact row for individual contributors. Squad is emphasized over fleet here
// because at the IC layer the squad is the team you actually work on.
export default function ICNode({ data }) {
  const { person, isFocus, isMe } = data;
  const { accent, soft } = colorFor(person);
  const [imgOk, setImgOk] = useState(true);
  const squad = person.squad ? person.squad.replace(/^Squad\s+/, "") : null;

  const classes = ["ic-node"];
  if (isFocus) classes.push("is-focus");
  if (isMe) classes.push("is-me");

  return (
    <div
      className={classes.join(" ")}
      style={{ background: soft, borderLeftColor: accent, "--accent": accent }}
    >
      <Handle id="l" type="target" position={Position.Left} className="node-handle" />

      <div className="ic-avatar" style={{ background: accent }}>
        {imgOk ? (
          <img src={person.photo} alt="" onError={() => setImgOk(false)} />
        ) : (
          <span>{initials(person.name)}</span>
        )}
      </div>

      <div className="ic-body">
        <div className="ic-name">{person.name}</div>
        <div className="ic-sub">
          {squad && (
            <span className="ic-squad" style={{ color: accent }}>
              <span className="team-dot" style={{ background: accent }} />
              {squad}
            </span>
          )}
          <span className="ic-title">{person.title}</span>
        </div>
      </div>

      {isMe && <span className="me-tag">You</span>}
    </div>
  );
}
