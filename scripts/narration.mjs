/*
  Narration step of the snapshot job: one "AI insight" paragraph per
  narrated visual, written at snapshot time by the Mistral API.

  The recorded family pattern, in this module and nowhere else:
  deterministic code computes every figure and builds the context, the
  model only narrates that context, and the site renders the narration
  verbatim as static text. The model never calculates: every number in
  the returned text is validated against the context figures, and a
  narration that introduces an unknown figure is retried once and then
  dropped for this run. No API call happens from the client, ever; the
  key is read from process.env.MISTRAL_API_KEY only, never logged and
  never written anywhere.
*/

import { createHash } from "node:crypto";

const MISTRAL_ENDPOINT = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL = "mistral-small-latest";
const TEMPERATURE = 0.2;
const MAX_TOKENS = 150;
/** Per-visual retry budget: one fresh attempt after a failed validation. */
const MAX_CALLS_PER_VISUAL = 2;
/** Hard cap of Mistral calls per run, across all visuals. */
const MAX_CALLS_PER_RUN = 14;

const SYSTEM_PROMPT = [
  "You write the 'AI insight' caption of a public data-visualization page.",
  "Plain English, at most two sentences.",
  "Tell the visitor what is on the screen and the single most notable thing about it.",
  "Use only figures that appear in the provided context; never introduce a number that is not in the context.",
  "No markdown, no lists, no hedging (never write words like 'approximately', 'around', 'seems', or 'likely').",
  "Output only the insight text.",
].join(" ");

const format = (value) => new Intl.NumberFormat("en-GB").format(value);
const share = (part, whole) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "0%";

/*
  Deterministic context per visual: the chart's title, one line of what
  it shows, the population the chart counts (phrased the way the page
  itself phrases it, so the model cannot blur the bases), and the exact
  aggregates behind it from the snapshot, and nothing else. Every
  figure a narration may use appears here.
*/
export function visualContexts(snapshot) {
  const { totals } = snapshot;
  const electricTotal = snapshot.electricSplit.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const withFuel = totals.vehiclesWithFuelData;
  const withoutFuel = totals.vehicles - withFuel;

  const treemapTiles = [
    { label: "No electric drive", count: withFuel - electricTotal },
    ...snapshot.electricSplit,
  ];

  const fuelLines = snapshot.fuelRegistrations.map((entry, index) => {
    const shareOfFuel = share(entry.count, totals.fuelRegistrations);
    // The first three fuels carry the chart's story; the tail is a count.
    return index < 3
      ? `${entry.label}: ${format(entry.count)} registrations (${shareOfFuel} of registrations)`
      : `${entry.label}: ${format(entry.count)} registrations`;
  });

  const typeLines = snapshot.vehicleTypes.map(
    (entry) =>
      `${entry.label}: ${format(entry.count)} vehicles (${share(entry.count, totals.vehicles)} of the register)`,
  );

  const cohorts = snapshot.massByYear;
  const first = cohorts[0];
  const last = cohorts[cohorts.length - 1];
  const heaviest = cohorts.reduce((top, row) =>
    row.avgMass > top.avgMass ? row : top,
  );
  const smallestEngine = cohorts.reduce((low, row) =>
    row.avgEngineSize < low.avgEngineSize ? row : low,
  );
  const latestEngine = snapshot.engineSizeByYear.find(
    (row) => row.year === last.year,
  );
  const heavyTurnLines = [
    "Title: The heavy turn",
    "Shows: two line charts, the average mass in kilograms and the average engine size in cubic centimetres of passenger cars by the year they were first registered in the Netherlands.",
    `Cohorts: ${format(cohorts.length)} first-registration-year cohorts from ${first.year} to ${last.year}, each with at least ${format(1000)} cars.`,
    "Population: the most recent cohort is a partial year. Average mass covers all passenger cars, electric ones included. Engine size covers only the cars that have an engine, because electric vehicles have no cylinder capacity.",
    `Average mass grows from ${format(first.avgMass)} kg in ${first.year} to ${format(last.avgMass)} kg in ${last.year}; the heaviest cohort is ${heaviest.year} at ${format(heaviest.avgMass)} kg.`,
    `Average engine size shrinks from ${format(first.avgEngineSize)} cc in ${first.year} to a low of ${format(smallestEngine.avgEngineSize)} cc in ${smallestEngine.year}, and stands at ${format(last.avgEngineSize)} cc in ${last.year}.`,
  ];
  if (latestEngine && latestEngine.withEngine != null) {
    heavyTurnLines.push(
      `The ${last.year} cohort holds ${format(last.count)} cars, of which ${format(last.count - latestEngine.withEngine)} have no engine size to measure.`,
    );
  }

  // The entry-year chart starts at 1970, mirroring its FROM_YEAR.
  const entryRows = snapshot.registrationYears.filter(
    (row) => row.year >= 1970,
  );
  const entryTotal = entryRows.reduce((sum, row) => sum + row.count, 0);
  const decadeCounts = new Map();
  for (const row of entryRows) {
    const decade = Math.floor(row.year / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) ?? 0) + row.count);
  }
  const largestEntry = entryRows.reduce((top, row) =>
    row.count > top.count ? row : top,
  );
  // Median entry year over the full registration-year series, sorted
  // ascending: the first year where the cumulative count reaches half
  // of the vehicles with a known year, as the chart caption states it.
  const knownYearTotal = snapshot.registrationYears.reduce(
    (sum, row) => sum + row.count,
    0,
  );
  let cumulativeYears = 0;
  let medianEntryYear = snapshot.registrationYears[0]?.year;
  for (const row of [...snapshot.registrationYears].sort(
    (a, b) => a.year - b.year,
  )) {
    cumulativeYears += row.count;
    if (cumulativeYears * 2 >= knownYearTotal) {
      medianEntryYear = row.year;
      break;
    }
  }
  const entryYearsLines = [
    "Title: When today's fleet entered the Netherlands",
    "Shows: bars counting the vehicles still registered today by the year they were first registered in the Netherlands, from 1970 onward; a bar is a survivor count, not the number registered that year, and the most recent year is a partial count.",
    `Population: the years are years of first registration in the Netherlands, and the chart covers the ${format(entryTotal)} vehicles first registered in 1970 or later.`,
    ...[...decadeCounts].map(
      ([decade, count]) => `${decade}s: ${format(count)} vehicles`,
    ),
    `Largest year: ${largestEntry.year} with ${format(largestEntry.count)} vehicles.`,
    `Half of the fleet entered in ${medianEntryYear} or later.`,
    `${format(snapshot.registrationYearsUnknown)} vehicles have no registration year recorded.`,
  ];

  return {
    treemap: [
      "Title: How electric is the Dutch fleet? (hero treemap)",
      `Shows: a treemap of the ${format(withFuel)} vehicles with fuel data, split into drivetrain tiles sized by their share of the vehicles with fuel data.`,
      `Population: every share on this chart is a share of the ${format(withFuel)} vehicles with fuel data; for contrast, the full register counts ${format(totals.vehicles)} vehicles, of which ${format(withoutFuel)} are trailers and towed equipment without fuel data.`,
      ...treemapTiles.map(
        (tile) =>
          `${tile.label}: ${format(tile.count)} vehicles (${share(tile.count, withFuel)} of vehicles with fuel data)`,
      ),
      `Total with electric drive: ${format(electricTotal)} vehicles (${share(electricTotal, withFuel)} of vehicles with fuel data).`,
      "Guidance: phrase every share as 'of vehicles with fuel data', never 'of the fleet' or 'of the register'.",
    ].join("\n"),
    fuelRegistrations: [
      "Title: Fuel registrations",
      "Shows: bars counting registrations per recorded fuel; hybrid vehicles carry one registration per fuel, so the registration total exceeds the vehicle count. The electric bar counts vehicles, the only fuel that is never double counted.",
      `Total fuel registrations: ${format(totals.fuelRegistrations)} across ${format(withFuel)} vehicles with fuel data.`,
      "Guidance: when the insight mentions the registration total, it must also note that hybrids carry one registration per fuel, which is why the total exceeds the vehicle count.",
      ...fuelLines,
    ].join("\n"),
    vehicleTypes: [
      "Title: The register by vehicle type",
      "Shows: bars counting every vehicle in the register by its recorded vehicle type; the fleet is far more than cars.",
      `Population: every share on this chart is a share of the full register of ${format(totals.vehicles)} vehicles, which spans every vehicle type, mopeds, trailers, tractors and vans included.`,
      `Register total: ${format(totals.vehicles)} vehicles.`,
      ...typeLines,
    ].join("\n"),
    // The heavy turn has no context without cohorts, so it is left out
    // and gets no narration rather than narrating an empty chart.
    ...(cohorts.length > 0 ? { heavyTurn: heavyTurnLines.join("\n") } : {}),
    // The entry-year chart has no context without charted years.
    ...(entryRows.length > 0 ? { entryYears: entryYearsLines.join("\n") } : {}),
  };
}

/*
  Figure validation. Every number in the returned text must match a
  figure from the provided context, compared numerically so formatted
  variants (12,212,370 and 12212370) are equal. A narration containing
  one unknown figure is rejected in full; it is not rewritten.
*/
const NUMBER_PATTERN = /\d[\d,]*(?:\.\d+)?/g;

export function extractNumbers(text) {
  return [...text.matchAll(NUMBER_PATTERN)].map((match) =>
    Number.parseFloat(match[0].replace(/,/g, "")),
  );
}

export function validateNarration(text, context) {
  if (!text) return false;
  const allowed = new Set(extractNumbers(context));
  return extractNumbers(text).every((figure) => allowed.has(figure));
}

/*
  One Mistral chat completion. The key is used here and nowhere else;
  failure surfaces carry the HTTP status only, never the key.
*/
async function callMistral(apiKey, context) {
  const response = await fetch(MISTRAL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: context },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`Mistral API failed (${response.status})`);
  }
  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/*
  Signature gating, per visual: a visual's signature is the SHA-256 of
  its own context, and the context embeds that visual's exact
  aggregates, so every data change flows into the hash. Reuse is per
  visual: a narration stored under the visual's current signature
  already describes the chart on screen, so it is kept without a call,
  while a visual whose signature changed (or that is missing from the
  stored set: newly added, or failed last run) is narrated again. A
  complete set under unchanged contexts makes no call at all.
*/
export function visualSignature(context) {
  return createHash("sha256").update(context).digest("hex");
}

/**
 * Narrates the five visuals of a fresh snapshot.
 *
 * @param {object} snapshot the freshly aggregated snapshot, without a
 *   narration field yet.
 * @param {object|null} existing the narration object of the previous
 *   snapshot.json, or null when there is none.
 * @param {object} [options] test seams: `apiKey` overrides the
 *   environment, `callMistral` replaces the API call, `maxCalls`
 *   overrides the run budget.
 * @returns {Promise<object|null>} the narration object to store in
 *   snapshot.json (the insight text per visual, each under its own
 *   context signature), or null when there is nothing to store.
 */
export async function narrate(snapshot, existing, options = {}) {
  const apiKey = (options.apiKey ?? process.env.MISTRAL_API_KEY ?? "").trim();
  // Fail-soft: without a key (plain push build, local run) narration is
  // skipped entirely and any existing narrations are left untouched.
  if (!apiKey) return existing ?? null;

  const contexts = visualContexts(snapshot);
  const call = options.callMistral ?? callMistral;
  const budget = { left: options.maxCalls ?? MAX_CALLS_PER_RUN };
  // Narrations stored under a visual's current signature are reused as
  // they are; only visuals with a changed or missing signature are
  // narrated.
  const storedVisuals = existing?.visuals ?? {};
  const storedSignatures = existing?.signatures ?? {};

  const visuals = {};
  const signatures = {};
  for (const key of Object.keys(contexts)) {
    const signature = visualSignature(contexts[key]);
    let text =
      storedSignatures[key] === signature ? storedVisuals[key] ?? null : null;
    // At most two calls per visual, never a loop, and never past the
    // run-wide budget.
    for (let attempt = 0; !text && attempt < MAX_CALLS_PER_VISUAL; attempt++) {
      if (budget.left <= 0) break;
      budget.left -= 1;
      try {
        const candidate = await call(apiKey, contexts[key]);
        if (validateNarration(candidate, contexts[key])) {
          text = candidate;
        }
      } catch {
        // A failed call consumes the attempt; the visual is simply not
        // narrated this run when the retry also fails.
      }
    }
    if (!text) {
      // Staleness guard: when no narration could be generated for the
      // new context, the previous text is not kept blindly. It is
      // revalidated against the new context's figures with the same
      // numeric comparison used at generation time, and kept only if
      // every figure it cites is still present. Otherwise the visual
      // gets no narration this run: an insight block must never sit
      // beside a chart whose aggregates no longer match its figures.
      const previous = storedVisuals[key] ?? null;
      if (previous && validateNarration(previous, contexts[key])) {
        text = previous;
      }
    }
    if (text) {
      visuals[key] = text;
      signatures[key] = signature;
    }
  }

  return { visuals, signatures };
}
