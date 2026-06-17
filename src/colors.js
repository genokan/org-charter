// Delicate color coding by alliance, with a subtle lightness shift per
// fleet/squad so teams within an alliance read as related-but-distinct.
// Kept low-saturation on purpose so it accents rather than shouts.

const ALLIANCE_HUE = {
  Casino: 350,
  Sportsbook: 145,
  Platform: 230,
  Infrastructure: 190,
  Data: 40,
  Trading: 280,
};

export const ALLIANCE_NAMES = Object.keys(ALLIANCE_HUE);

// Base accent color for an alliance (used by the legend).
export function allianceAccent(name) {
  const hue = ALLIANCE_HUE[name];
  if (hue === undefined) return "hsl(220 9% 62%)";
  return `hsl(${hue} 44% 50%)`;
}

function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Returns { accent, soft } colors for a person. People without an alliance
// (executives, marketing, program mgmt) get a neutral gray accent.
export function colorFor({ alliance, fleet, squad }) {
  if (!alliance || ALLIANCE_HUE[alliance] === undefined) {
    return { accent: "hsl(220 9% 62%)", soft: "hsl(220 14% 97%)" };
  }
  const hue = ALLIANCE_HUE[alliance];
  const key = `${fleet || ""}|${squad || ""}`;
  const shift = key ? (hashStr(key) % 13) - 6 : 0; // -6..+6
  const light = 50 + shift;
  return {
    accent: `hsl(${hue} 44% ${light}%)`,
    soft: `hsl(${hue} 40% 97%)`,
  };
}
