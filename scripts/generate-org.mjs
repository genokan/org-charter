// Generates a mock org chart of exactly 300 people and writes it to
// public/org.json as a nested tree rooted at the CTO.
//
// Hierarchy (levels L5 -> L1):
//   L5 CTO
//   L4 VP (Engineering, Marketing, Program Management)
//   L3 Director
//   L2 Engineering Manager
//   L1 Team Lead (senior IC lead) and IC
//
// Engineering is organized into Alliances > Fleets > Squads. Some squads are
// "standalone" (directly under an alliance, no fleet). Marketing and Program
// Management are smaller orgs without the alliance/fleet/squad grouping.
//
// Run: node scripts/generate-org.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ---- Deterministic PRNG so re-runs produce stable output -------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260616);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ---- Name + title pools ----------------------------------------------------
const FIRST = [
  "Jordan", "Sam", "Priya", "Morgan", "Avery", "Riley", "Casey", "Taylor",
  "Jamie", "Quinn", "Devon", "Reese", "Skyler", "Cameron", "Hayden", "Rowan",
  "Elliot", "Marlowe", "Noa", "Kai", "Maya", "Leah", "Ivan", "Diego", "Sofia",
  "Chen", "Yuki", "Anaya", "Tariq", "Nadia", "Omar", "Lena", "Ravi", "Mei",
  "Ana", "Liam", "Noah", "Zoe", "Ada", "Felix", "Iris", "Nina", "Theo", "Owen",
  "Aisha", "Mateo", "Lucia", "Hana", "Jonas", "Petra", "Sven", "Amara",
];
const LAST = [
  "Avery", "Rivera", "Nair", "Lee", "Chen", "Patel", "Kim", "Garcia", "Nguyen",
  "Okafor", "Silva", "Haddad", "Novak", "Larsson", "Costa", "Ibrahim", "Reyes",
  "Bauer", "Moreau", "Schmidt", "Rossi", "Andersson", "Khan", "Mensah", "Singh",
  "Park", "Ortega", "Vance", "Holloway", "Bishop", "Frost", "Mercer", "Webb",
  "Castellano", "Donnelly", "Vargas", "Whitfield", "Sato", "Abara", "Cole",
  "Beckett", "Lindqvist", "Adeyemi", "Volkov", "Marchetti", "Bjornson",
];
function nextName() {
  return `${pick(FIRST)} ${pick(LAST)}`;
}

const ENG_IC_TITLES = [
  "Software Engineer", "Software Engineer II", "Senior Software Engineer",
  "Backend Engineer", "Frontend Engineer", "Full-Stack Engineer",
  "Site Reliability Engineer", "DevOps Engineer", "Data Engineer",
  "QA Automation Engineer", "Platform Engineer", "Security Engineer",
];
const MKT_IC_TITLES = [
  "Marketing Specialist", "Growth Marketer", "Content Strategist",
  "Brand Designer", "Lifecycle Marketing Manager", "SEO Analyst",
  "Social Media Manager",
];
const PM_IC_TITLES = [
  "Program Manager", "Technical Program Manager", "Project Coordinator",
  "Delivery Manager", "Release Manager",
];

const ALLIANCES = [
  "Casino", "Sportsbook", "Platform", "Infrastructure", "Data", "Trading",
];

const SQUAD_NAMES = [
  "Phoenix", "Nebula", "Vanguard", "Atlas", "Orion", "Kraken", "Titan",
  "Cobra", "Falcon", "Lynx", "Mako", "Onyx", "Pulse", "Quartz", "Raptor",
  "Sable", "Tundra", "Vortex", "Wraith", "Zephyr", "Comet", "Drake", "Ember",
  "Glacier", "Halcyon", "Ion", "Jet", "Kestrel", "Lumen", "Meridian", "Nimbus",
  "Obsidian", "Polaris", "Quasar", "Rune", "Solstice", "Talon", "Umbra",
  "Volt", "Willow", "Xenon", "Yonder", "Zenith", "Apex", "Boreal", "Cinder",
  "Delta", "Echo", "Forge", "Grove", "Helix", "Ridge", "Spire", "Tide",
];
let squadIdx = 0;
const nextSquadName = () => `Squad ${SQUAD_NAMES[squadIdx++ % SQUAD_NAMES.length]}`;

// ---- Person factory --------------------------------------------------------
const all = [];
let idCounter = 0;
function makePerson(parent, { title, level, org, role, alliance = null, fleet = null, squad = null }) {
  const id = `p${String(++idCounter).padStart(3, "0")}`;
  const person = {
    id,
    name: nextName(),
    title,
    level,
    role,
    org,
    alliance,
    fleet,
    squad,
    managerId: parent ? parent.id : null,
    photo: `https://i.pravatar.cc/300?u=${id}`,
    reports: [],
  };
  if (parent) parent.reports.push(person);
  all.push(person);
  return person;
}

// ---- Build leadership ------------------------------------------------------
const cto = makePerson(null, {
  title: "Chief Technology Officer", level: "L5", org: "Executive", role: "executive",
});
const vpEng = makePerson(cto, {
  title: "VP of Engineering", level: "L4", org: "Engineering", role: "vp",
});
const vpMkt = makePerson(cto, {
  title: "VP of Marketing", level: "L4", org: "Marketing", role: "vp",
});
const vpPm = makePerson(cto, {
  title: "VP of Program Management", level: "L4", org: "Program Management", role: "vp",
});

// Teams that can receive ICs: { lead, org, alliance, fleet, squad }
const engTeams = [];
const otherTeams = [];
const TARGET = 300;

// Directors per alliance: 1 each, with the two largest getting 2 ("some
// alliances will have multiple directors"). Kept deliberately low so the org
// is bottom-heavy (most people are ICs) rather than top-heavy with directors.
const DIRECTORS_PER_ALLIANCE = {
  Casino: 2, Sportsbook: 1, Platform: 1, Infrastructure: 1, Data: 2, Trading: 1,
};

// ---- Engineering management: Directors -> Eng Managers (each owns a fleet) --
const engDirectors = [];
const engEMs = []; // { em, alliance, fleet }
for (const alliance of ALLIANCES) {
  const numDirectors = DIRECTORS_PER_ALLIANCE[alliance] ?? 1;
  let fleetNo = 0;
  for (let d = 0; d < numDirectors; d++) {
    const director = makePerson(vpEng, {
      title: "Director of Engineering", level: "L3", org: "Engineering",
      role: "director", alliance,
    });
    engDirectors.push(director);
    // Each director owns 2-3 fleets; each fleet is run by an Engineering Manager.
    const numFleets = randInt(2, 3);
    for (let f = 0; f < numFleets; f++) {
      const fleet = `${alliance} Fleet ${++fleetNo}`;
      const em = makePerson(director, {
        title: "Engineering Manager", level: "L2", org: "Engineering",
        role: "manager", alliance, fleet,
      });
      engEMs.push({ em, alliance, fleet });
    }
  }
}

// ---- Engineering squads (each led by a Team Lead) --------------------------
// Squad count is chosen so that, after management + support, every dev squad
// can hold 5-10 engineers. Squads spread across fleets (Eng Managers); roughly
// one in eight is a "standalone" squad attached straight to a director.
const numSquads = engEMs.length + randInt(4, 8);
for (let i = 0; i < numSquads; i++) {
  const squad = nextSquadName();
  if (i % 8 === 7) {
    const director = pick(engDirectors);
    const lead = makePerson(director, {
      title: "Team Lead", level: "L1", org: "Engineering",
      role: "team_lead", alliance: director.alliance, fleet: null, squad,
    });
    engTeams.push({ lead, org: "Engineering", alliance: director.alliance, fleet: null, squad });
  } else {
    const { em, alliance, fleet } = engEMs[i % engEMs.length];
    const lead = makePerson(em, {
      title: "Team Lead", level: "L1", org: "Engineering",
      role: "team_lead", alliance, fleet, squad,
    });
    engTeams.push({ lead, org: "Engineering", alliance, fleet, squad });
  }
}

// ---- Build Marketing + Program Management (smaller, no alliances) ----------
function buildSupportOrg(vp, orgName, managerTitle, leadTitle) {
  const director = makePerson(vp, {
    title: `Director of ${orgName}`, level: "L3", org: orgName, role: "director",
  });
  const numManagers = randInt(2, 3);
  for (let m = 0; m < numManagers; m++) {
    const manager = makePerson(director, {
      title: managerTitle, level: "L2", org: orgName, role: "manager",
    });
    const lead = makePerson(manager, {
      title: leadTitle, level: "L1", org: orgName, role: "team_lead",
    });
    otherTeams.push({ lead, org: orgName, alliance: null, fleet: null, squad: null });
  }
}
buildSupportOrg(vpMkt, "Marketing", "Marketing Manager", "Marketing Team Lead");
buildSupportOrg(vpPm, "Program Management", "Senior Program Manager", "Program Lead");

// ---- Fill teams with ICs to reach exactly 300 ------------------------------
const titlesFor = (org) =>
  org === "Engineering" ? ENG_IC_TITLES : org === "Marketing" ? MKT_IC_TITLES : PM_IC_TITLES;

function addICs(team, n) {
  for (let k = 0; k < n; k++) {
    makePerson(team.lead, {
      title: pick(titlesFor(team.org)),
      level: "L1", org: team.org, role: "ic",
      alliance: team.alliance, fleet: team.fleet, squad: team.squad,
    });
  }
}

// Support teams get 4-7 ICs each.
for (const team of otherTeams) addICs(team, randInt(4, 7));

// Engineering soaks up the remaining headcount: every dev squad gets 5-10
// engineers, summing exactly to what's left so the total lands on 300.
const MIN = 5, MAX = 10;
const N = engTeams.length;
const budget = TARGET - all.length;
const sizes = new Array(N).fill(MIN);
let extra = budget - MIN * N; // headcount above the per-squad minimum
let cursor = 0;
while (extra > 0) {
  const j = Math.floor(rand() * N);
  if (sizes[j] < MAX) {
    sizes[j]++;
    extra--;
  }
  // Safety valve: if everything is capped, lift remaining onto the next squad.
  if (++cursor > N * (MAX - MIN) * 4) {
    sizes[budget % N] += extra;
    extra = 0;
  }
}
for (let i = 0; i < N; i++) addICs(engTeams[i], sizes[i]);

// ---- Write output ----------------------------------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "org.json");
writeFileSync(outFile, JSON.stringify(cto, null, 2) + "\n");

// ---- Summary ---------------------------------------------------------------
const byOrg = {};
const byLevel = {};
const byAlliance = {};
for (const p of all) {
  byOrg[p.org] = (byOrg[p.org] || 0) + 1;
  byLevel[p.level] = (byLevel[p.level] || 0) + 1;
  if (p.alliance) byAlliance[p.alliance] = (byAlliance[p.alliance] || 0) + 1;
}
const engSizes = engTeams.map((t) => t.lead.reports.length);
const fleetNames = new Set(all.filter((p) => p.fleet).map((p) => p.fleet));
console.log(`Wrote ${all.length} people to ${outFile}`);
console.log("By org:", byOrg);
console.log("By level:", byLevel);
console.log("By alliance (Engineering):", byAlliance);
console.log(`Engineering squads: ${engTeams.length}, support teams: ${otherTeams.length}`);
console.log(`Fleets: ${fleetNames.size}`);
console.log(`Eng squad size min/max: ${Math.min(...engSizes)}/${Math.max(...engSizes)}`);
