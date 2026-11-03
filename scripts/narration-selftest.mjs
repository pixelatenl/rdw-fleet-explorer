/*
  Dry-run harness for the narration module. Exercises the pure figure
  validation and the narrate() gating and budget logic against mock
  Mistral calls, using the committed snapshot as realistic context
  data. No API key is read and no network call is made.

  Usage: node scripts/narration-selftest.mjs
*/

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  narrate,
  dataSignature,
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

/* Signature gating */

const existing = {
  signature: dataSignature(data),
  visuals: { treemap: "Previous narration." },
};

// A mock that records every call and returns a figure-free sentence.
const recorder = (log, respond) => async (_apiKey, context) => {
  log.push(context);
  return respond(log.length);
};

let log = [];
let result = await narrate(data, existing, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "Figure-free narration."),
});
check(
  "unchanged signature reuses the existing narration and makes no call",
  log.length === 0 && result === existing,
);

log = [];
result = await narrate(data, existing, { apiKey: "" });
check(
  "absent key leaves the existing narration untouched and makes no call",
  log.length === 0 && result === existing,
);

log = [];
result = await narrate(data, null, { apiKey: "" });
check(
  "absent key with no existing narration returns null",
  log.length === 0 && result === null,
);

/* Fresh signature: generation, retry, budget */

const changed = structuredClone(data);
changed.totals.vehicles += 1;

log = [];
result = await narrate(changed, existing, {
  apiKey: "test-key",
  callMistral: recorder(log, () => "A clean, figure-free narration."),
});
check(
  "fresh signature makes one call per visual and narrates all four",
  log.length === 4 &&
    Object.keys(result.visuals).length === 4 &&
    result.signature === dataSignature(changed),
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

log = [];
result = await narrate(changed, existing, {
  apiKey: "test-key",
  // Always hallucinates a number, so every attempt fails validation.
  callMistral: recorder(log, () => "Some 999,999 vehicles, allegedly."),
});
check(
  "persistent hallucination stops after two calls per visual and stores no narration",
  log.length === 8 && Object.keys(result.visuals).length === 0,
  `calls: ${log.length}`,
);
check(
  "a failed run still carries the fresh signature",
  result.signature === dataSignature(changed),
);

log = [];
result = await narrate(changed, existing, {
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
result = await narrate(changed, existing, {
  apiKey: "test-key",
  // Fails first, succeeds on retry: exactly two calls per visual.
  callMistral: recorder(log, (n) =>
    n % 2 === 1 ? "Some 999,999 vehicles." : "A clean narration on retry.",
  ),
});
check(
  "a hallucination retried once succeeds and still honors two calls per visual",
  log.length === 8 && Object.keys(result.visuals).length === 4,
  `calls: ${log.length}, visuals: ${Object.keys(result.visuals).length}`,
);

console.log(
  failures.length === 0
    ? "All narration harness checks passed."
    : `${failures.length} check(s) failed.`,
);
process.exit(failures.length === 0 ? 0 : 1);
