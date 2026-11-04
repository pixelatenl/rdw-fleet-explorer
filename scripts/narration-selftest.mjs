/*
  Dry-run harness for the narration module. Exercises the pure figure
  validation, the per-visual signature gating (reuse, selective
  re-narration, and the staleness guard) and the narrate() budget
  logic against mock Mistral calls, using the committed snapshot as
  realistic context data. No API key is read and no network call is
  made.

  Usage: node scripts/narration-selftest.mjs
*/

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  narrate,
  visualContexts,
  visualSignature,
  validateNarration,
  extractNumbers,
} from "./narration.mjs";

const failures = [];

function check(name, condition, detail = "") {
  if (condition) {
    console.log(`ok - ${name}`);
  } else {
    failures.push(name);
    console.error(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const dir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "data",
);
const snapshot = JSON.parse(
  await readFile(path.join(dir, "snapshot.json"), "utf8"),
);
// The data the snapshot job hands to narrate(): no narration field.
const { narration: _narration, ...data } = snapshot;

const KEYS = [
  "treemap",
  "fuelRegistrations",
  "vehicleTypes",
  "heavyTurn",
  "entryYears",
];

const signatureOf = (snap, key) =>
  visualSignature(visualContexts(snap)[key]);

// A stored narration set: every visual carries its text and the
// signature of the context that text was validated against.
const storedFor = (snap, textOf) => {
  const set = { visuals: {}, signatures: {} };
  for (const key of KEYS) {
    set.visuals[key] = textOf(key);
    set.signatures[key] = signatureOf(snap, key);
  }
  return set;
};

// Mocks that record every call: one answers, one always fails.
const recorder = (log, respond) => async (_apiKey, context) => {
  log.push(context);
  return respond(log.length);
};
const failing = (log) => async (_apiKey, context) => {
  log.push(context);
  throw new Error("Mistral unavailable");
};

/* Figure validation */

const context =
  "Battery electric: 12,212,370 vehicles (80.5% of the fleet) since 1975.";

check(
  "extractNumbers treats 12,212,370 and 12212370 as the same figure",
  extractNumbers("12,212,370").join() === extractNumbers("12212370").join(),
);
check(
  "validation accepts every figure from the context, formatted variants included",
  validateNarration(
    "The fleet holds 12,212,370 vehicles, or 12212370 if you prefer, some since 1975.",
    context,
  ),
);
check(
  "validation rejects a hallucinated number",
  !validateNarration("The fleet holds 999,999 vehicles.", context),
);
check(
  "validation rejects an invented share",
  !validateNarration("A full 42.0% of the fleet.", context),
);
check("validation rejects empty text", !validateNarration("", context));

/* Per-visual signature gating */

// A set stored under the current contexts, minus one visual that
// failed to narrate last run.
const partial = storedFor(data, (key) => `Narration for ${key}.`);
delete partial.visuals.treemap;
delete partial.signatures.treemap;

let log = [];
let result = await narrate(data, partial, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "Figure-free narration."),
});
check(
  "unchanged contexts reuse the stored narrations and only narrate the missing visual",
  log.length === 1 &&
    result.visuals.treemap === "Figure-free narration." &&
    result.visuals.vehicleTypes === "Narration for vehicleTypes." &&
    Object.keys(result.visuals).length === 5 &&
    Object.keys(result.signatures).length === 5,
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

const complete = storedFor(data, (key) => `Narration for ${key}.`);

log = [];
result = await narrate(data, complete, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "Figure-free narration."),
});
check(
  "a complete set under unchanged contexts makes no call",
  log.length === 0 &&
    KEYS.every((key) => result.visuals[key] === complete.visuals[key]) &&
    KEYS.every((key) => result.signatures[key] === complete.signatures[key]),
  `calls: ${log.length}`,
);

// A new vehicle-type count changes only the vehicleTypes context.
const changedTypes = structuredClone(data);
changedTypes.vehicleTypes[0].count += 1;

log = [];
result = await narrate(changedTypes, complete, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "Figure-free narration."),
});
check(
  "a change to one visual's context re-narrates only that visual",
  log.length === 1 &&
    result.visuals.vehicleTypes === "Figure-free narration." &&
    result.visuals.treemap === "Narration for treemap." &&
    result.signatures.vehicleTypes ===
      signatureOf(changedTypes, "vehicleTypes") &&
    result.signatures.treemap === signatureOf(data, "treemap"),
  `calls: ${log.length}`,
);

log = [];
result = await narrate(data, complete, { apiKey: "" });
check(
  "absent key leaves the existing narration untouched and makes no call",
  log.length === 0 && result === complete,
);

log = [];
result = await narrate(data, null, { apiKey: "" });
check(
  "absent key with no existing narration returns null",
  log.length === 0 && result === null,
);

/* Fresh generation, retry, budget */

log = [];
result = await narrate(data, null, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "A clean, figure-free narration."),
});
check(
  "no existing narration makes one call per visual and narrates all five",
  log.length === 5 &&
    Object.keys(result.visuals).length === 5 &&
    KEYS.every((key) => result.signatures[key] === signatureOf(data, key)),
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

log = [];
result = await narrate(data, null, {
  apiKey: "test-key",
  // Always hallucinates a number, so every attempt fails validation.
  callMistral: recorder(log, () => "Some 999,999 vehicles, allegedly."),
});
check(
  "persistent hallucination stops after two calls per visual and stores no narration",
  log.length === 10 &&
    Object.keys(result.visuals).length === 0 &&
    Object.keys(result.signatures).length === 0,
  `calls: ${log.length}`,
);

log = [];
result = await narrate(data, null, {
  apiKey: "test-key",
  maxCalls: 3,
  callMistral: recorder(log, () => "A clean, figure-free narration."),
});
check(
  "the run-wide budget caps total calls",
  log.length === 3 && Object.keys(result.visuals).length === 3,
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

log = [];
result = await narrate(data, null, {
  apiKey: "test-key",
  // Fails first, succeeds on retry: exactly two calls per visual.
  callMistral: recorder(log, (n) =>
    n % 2 === 1 ? "Some 999,999 vehicles." : "A clean narration on retry.",
  ),
});
check(
  "a hallucination retried once succeeds and still honors two calls per visual",
  log.length === 10 && Object.keys(result.visuals).length === 5,
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

/* Staleness guard */

// A stored heavyTurn narration that cites the 1975 average mass.
const staleHeavyText = "The 1975 cohort averaged 1,195 kg.";
check(
  "the heavyTurn fixture cites a figure the current context carries",
  validateNarration(staleHeavyText, visualContexts(data).heavyTurn),
);

// The 1975 average mass changes: the cited figure disappears from the
// new context, and only the heavyTurn context changes.
const massChanged = structuredClone(data);
massChanged.massByYear[0].avgMass += 9;
check(
  "the changed mass leaves the cited figure out of the new context",
  !validateNarration(staleHeavyText, visualContexts(massChanged).heavyTurn),
);

const staleSet = storedFor(data, (key) =>
  key === "heavyTurn" ? staleHeavyText : `Narration for ${key}.`,
);

log = [];
result = await narrate(massChanged, staleSet, {
  apiKey: "test-key",
  callMistral: failing(log),
});
check(
  "a stale narration whose cited figure disappeared is dropped when both attempts fail",
  log.length === 2 &&
    !("heavyTurn" in result.visuals) &&
    !("heavyTurn" in result.signatures) &&
    result.visuals.treemap === "Narration for treemap.",
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

// A treemap narration citing figures that survive an electric-split
// change: the counts it names stay in the new context.
const keptTreemapText =
  "The register counts 16,882,072 vehicles, of which 15,173,606 carry fuel data.";
const splitChanged = structuredClone(data);
splitChanged.electricSplit[0].count += 1;
check(
  "the treemap fixture keeps every cited figure in the new context",
  validateNarration(keptTreemapText, visualContexts(splitChanged).treemap),
);

const keptSet = storedFor(data, (key) =>
  key === "treemap" ? keptTreemapText : `Narration for ${key}.`,
);

log = [];
result = await narrate(splitChanged, keptSet, {
  apiKey: "test-key",
  callMistral: failing(log),
});
check(
  "a narration whose figures all survive a context change is kept when both attempts fail",
  log.length === 2 &&
    result.visuals.treemap === keptTreemapText &&
    result.signatures.treemap === signatureOf(splitChanged, "treemap"),
  `calls: ${log.length}`,
);

log = [];
result = await narrate(splitChanged, result, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "Never reached."),
});
check(
  "a narration kept by the staleness guard makes no call on the next unchanged run",
  log.length === 0 && result.visuals.treemap === keptTreemapText,
  `calls: ${log.length}`,
);

log = [];
result = await narrate(splitChanged, keptSet, {
  apiKey: "test-key",
  maxCalls: 0,
  callMistral: recorder(log, () => "Never reached."),
});
check(
  "with the run budget exhausted a still-valid narration is kept without a call",
  log.length === 0 && result.visuals.treemap === keptTreemapText,
  `calls: ${log.length}`,
);

log = [];
result = await narrate(massChanged, staleSet, {
  apiKey: "test-key",
  maxCalls: 0,
  callMistral: recorder(log, () => "Never reached."),
});
check(
  "with the run budget exhausted a narration citing a vanished figure is dropped without a call",
  log.length === 0 &&
    !("heavyTurn" in result.visuals) &&
    result.visuals.treemap === "Narration for treemap.",
  `calls: ${log.length}`,
);

console.log(
  failures.length === 0
    ? "All narration harness checks passed."
    : `${failures.length} check(s) failed.`,
);
process.exit(failures.length === 0 ? 0 : 1);
