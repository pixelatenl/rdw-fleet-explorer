/*
  Snapshot job for the Dutch Fleet Electrification Explorer.
  Runs server-side SoQL aggregations against the RDW Open Data API and
  writes the result to src/data/snapshot.json. No raw vehicle records
  are stored; every aggregation records its retrieval date.

  Usage: node scripts/snapshot.mjs
  The RDW SODA2 endpoints are keyless and CC0 licensed.
*/

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { narrate } from "./narration.mjs";

const BASE = "https://opendata.rdw.nl/resource";
const DATASET_BASE = "m9d7-ebf2";
const DATASET_FUEL = "8ys7-d773";
const DATASET_FERRARI = "pmhw-w82q";

async function query(dataset, soql) {
  const url = `${BASE}/${dataset}.json?$query=${encodeURIComponent(soql)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `RDW query failed (${response.status}) on ${dataset}: ${soql}`
    );
  }
  return response.json();
}

/*
  Full fetch of the Ferrari brand extract, paged through the SODA
  offset limit (the API caps a single response well below the size of
  the extract). The view is small and keyless, so the snapshot job
  pulls every record once a week and aggregates locally; only the
  fields the Ferrari figures need are selected. Paging is ordered by
  kenteken: SODA offset paging without an order clause is not stable,
  and the row order can shift between pages mid-fetch.
*/
const FERRARI_PAGE_SIZE = 1000;

async function fetchFerrariRecords() {
  const records = [];
  let offset = 0;
  for (;;) {
    const page = await query(
      DATASET_FERRARI,
      `select kenteken, voertuigsoort, handelsbenaming, eerste_kleur, datum_eerste_toelating ` +
        `order by kenteken limit ${FERRARI_PAGE_SIZE} offset ${offset}`
    );
    records.push(...page);
    if (page.length < FERRARI_PAGE_SIZE) return records;
    offset += FERRARI_PAGE_SIZE;
  }
}

const fuelLabelByKey = {
  benzine: "Petrol",
  elektriciteit: "Electric",
  diesel: "Diesel",
  lpg: "LPG",
  cng: "CNG",
  alcohol: "Alcohol",
  lng: "LNG",
  waterstof: "Hydrogen",
};

const electricClassByKey = {
  "novc-hev": { key: "novc-hev", label: "Full hybrid" },
  "ovc-hev": { key: "ovc-hev", label: "Plug-in hybrid" },
  "novc-fchv": { key: "fchv", label: "Fuel cell hybrid" },
  "ovc-fchv": { key: "fchv", label: "Fuel cell hybrid" },
};

/*
  Snapshot JSON formatter. Keeps the committed format stable: two-space
  indentation, with every entry of a flat-object array on a single line
  so adding a series does not reformat the whole file.
*/
function isFlat(value) {
  if (value === null || Array.isArray(value)) return true;
  if (typeof value !== "object") return true;
  return Object.values(value).every(
    (child) => child === null || typeof child !== "object",
  );
}

function formatEntry(entry) {
  const fields = Object.entries(entry)
    .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
    .join(", ");
  return `{ ${fields} }`;
}

function pretty(value, level) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const pad = "  ".repeat(level);
  const inner = "  ".repeat(level + 1);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((entry) => entry !== null && typeof entry === "object" && isFlat(entry))) {
      const items = value.map((entry) => inner + formatEntry(entry)).join(",\n");
      return `[\n${items}\n${pad}]`;
    }
    const items = value
      .map((entry) => inner + pretty(entry, level + 1))
      .join(",\n");
    return `[\n${items}\n${pad}]`;
  }
  const fields = Object.entries(value)
    .map(([key, child]) => `${inner}${JSON.stringify(key)}: ${pretty(child, level + 1)}`)
    .join(",\n");
  return `{\n${fields}\n${pad}}`;
}

/*
  Vehicle type entries keyed by the raw (capitalized) RDW voertuigsoort
  value, carrying the exact key and label the site and committed snapshot
  use, so regeneration is byte-stable. Unknown types fall back to a
  slugified raw value.
*/
const vehicleTypeByKey = {
  "Personenauto": { key: "personenauto", label: "Passenger car" },
  "Bedrijfsauto": { key: "bedrijfsauto", label: "Van" },
  "Bromfiets": { key: "bromfiets", label: "Moped" },
  "Motorfiets": { key: "motorfiets", label: "Motorcycle" },
  "Aanhangwagen": { key: "aanhangwagen", label: "Trailer" },
  "Middenasaanhangwagen": { key: "middenasaanhangwagen", label: "Centre-axle trailer" },
  "Land- of bosbouwtrekker": { key: "land-bosbouwtrekker", label: "Agricultural tractor" },
  "Land- of bosb aanhw of getr uitr stuk": { key: "land-bosb-aanhangwagen", label: "Agricultural trailer or equipment" },
  "Oplegger": { key: "oplegger", label: "Semi-trailer" },
  "Motorrijtuig met beperkte snelheid": { key: "beperkte-snelheid", label: "Slow-moving vehicle" },
  "Driewielig motorrijtuig": { key: "driewielig", label: "Three-wheeled vehicle" },
  "Mobiele machine": { key: "mobiele-machine", label: "Mobile machine" },
  "Bus": { key: "bus", label: "Bus" },
  "Autonome aanhangwagen": { key: "autonome-aanhangwagen", label: "Autonomous trailer" },
  "Motorfiets met zijspan": { key: "motorfiets-zijspron", label: "Motorcycle with sidecar" },
};

async function main() {
  const [
    fuelComposition,
    electricSplitRaw,
    vehicleTypes,
    registrationYearsRaw,
    fuelTotals,
    massByYearRaw,
    engineSizeByYearRaw,
    fuelCellRaw,
  ] = await Promise.all([
    query(
      DATASET_FUEL,
      "select brandstof_omschrijving, count(1) as aantal group by brandstof_omschrijving order by aantal desc"
    ),
    query(
      DATASET_FUEL,
      'select klasse_hybride_elektrisch_voertuig, count(1) as aantal where brandstof_omschrijving="Elektriciteit" group by klasse_hybride_elektrisch_voertuig order by aantal desc'
    ),
    query(
      DATASET_BASE,
      "select voertuigsoort, count(1) as aantal group by voertuigsoort order by aantal desc"
    ),
    query(
      DATASET_BASE,
      "select date_extract_y(datum_eerste_tenaamstelling_in_nederland_dt) as jaar, count(1) as aantal group by jaar order by jaar"
    ),
    query(
      DATASET_FUEL,
      "select count(1) as rows, count(distinct kenteken) as vehicles"
    ),
    // Average mass by first admission year, passenger cars from 1975 on.
    // date_extract_y requires the _dt column variant; avg() ignores nulls
    // on its own, so count(1) covers every car of the cohort while the
    // average covers only cars with a recorded massa_ledig_voertuig.
    query(
      DATASET_BASE,
      "select date_extract_y(datum_eerste_toelating_dt) as year, avg(massa_ledig_voertuig) as avg_mass, count(1) as n " +
        "where voertuigsoort='Personenauto' and datum_eerste_toelating_dt >= '1975-01-01' " +
        "group by year order by year limit 200"
    ),
    // Average engine size by the same first admission year. SoQL has no
    // IS NULL; avg(cilinderinhoud) and count(cilinderinhoud) skip cars
    // without a recorded value, so n_cc exposes how much of the cohort
    // the engine-size average actually covers.
    query(
      DATASET_BASE,
      "select date_extract_y(datum_eerste_toelating_dt) as year, avg(cilinderinhoud) as avg_cc, count(cilinderinhoud) as n_cc, count(1) as n " +
        "where voertuigsoort='Personenauto' and datum_eerste_toelating_dt >= '1975-01-01' " +
        "group by year order by year limit 200"
    ),
    // Fuel cell coverage: distinct vehicles per recorded fuel over the
    // fuel cell hybrid classes. The class values are uppercase in the
    // register, so the where clause matches them literally.
    query(
      DATASET_FUEL,
      "select brandstof_omschrijving, count(distinct kenteken) as vehicles " +
        "where klasse_hybride_elektrisch_voertuig in ('NOVC-FCHV','OVC-FCHV') " +
        "group by brandstof_omschrijving order by vehicles desc"
    ),
  ]);

  const vehicles = await query(
    DATASET_BASE,
    "select count(1) as vehicles"
  );

  /*
    Ferrari coda: every figure of the closing card, aggregated from the
    full Ferrari brand extract. The extract is a filtered view of the
    register holding every vehicle with merk FERRARI, and Ferrari is
    also an Italian tractor manufacturer, so the tractors are part of
    the same register. Colour values are stored uppercase (ROOD) and
    tractors carry "N.v.t." or nothing where no colour is recorded.
    The model figures match the register's handelsbenaming exactly:
    the register lists the bare model number for the 458 and the bare
    name for the California, which is what makes them the tied most
    common models; named variants (458 SPIDER, CALIFORNIA T) are
    separate handelsbenaming values.
  */
  const ferrariRecords = await fetchFerrariRecords();
  const ferrariTractors = ferrariRecords.filter(
    (row) => row.voertuigsoort === "Land- of bosbouwtrekker"
  );
  const ferrariColor = (row) => (row.eerste_kleur ?? "").trim();
  const ferrariName = (row) => (row.handelsbenaming ?? "").trim();
  const tractorModelCounts = new Map();
  for (const row of ferrariTractors) {
    const name = ferrariName(row);
    // The register records ONBEKEND (and similar) where the model is
    // unknown; those records cannot crown a most common model.
    if (!name || /^onbekend/i.test(name)) continue;
    tractorModelCounts.set(name, (tractorModelCounts.get(name) ?? 0) + 1);
  }
  const [topTractorName, topTractorCount] =
    [...tractorModelCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  // First admission year of a record, from the YYYYMMDD register date;
  // null where the register records no parseable date.
  const ferrariFirstYear = (row) => {
    const date = row.datum_eerste_toelating ?? "";
    return /^\d{8}/.test(date) ? Number(date.slice(0, 4)) : null;
  };
  // The model and year of the lone motorcycle, if the extract holds
  // exactly one; null as soon as there is none or more than one.
  const ferrariMotorcycle =
    ferrariRecords.filter((row) => row.voertuigsoort === "Motorfiets")
      .length === 1
      ? ferrariRecords.find((row) => row.voertuigsoort === "Motorfiets")
      : null;
  // The record with the earliest first admission date in the extract.
  // The strict comparison keeps the first record on a tie, and the
  // fetch is kenteken-ordered, so the pick is deterministic.
  let ferrariOldest = null;
  for (const row of ferrariRecords) {
    const year = ferrariFirstYear(row);
    if (year === null) continue;
    if (!ferrariOldest || year < ferrariOldest.year) {
      ferrariOldest = { model: ferrariName(row), year };
    }
  }
  const ferrari = {
    total: ferrariRecords.length,
    red: ferrariRecords.filter((row) => ferrariColor(row).toUpperCase() === "ROOD")
      .length,
    model458: ferrariRecords.filter((row) => ferrariName(row) === "458").length,
    california: ferrariRecords.filter(
      (row) => ferrariName(row) === "CALIFORNIA"
    ).length,
    tractors: ferrariTractors.length,
    tractorsTopModel: topTractorName
      ? { name: topTractorName, count: topTractorCount }
      : null,
    tractorsWithColor: ferrariTractors.filter((row) => {
      const color = ferrariColor(row);
      return color !== "" && color !== "N.v.t.";
    }).length,
    motorcycle: ferrariRecords.filter(
      (row) => row.voertuigsoort === "Motorfiets"
    ).length,
    motorcycleModel: ferrariMotorcycle ? ferrariName(ferrariMotorcycle) : null,
    motorcycleYear: ferrariMotorcycle
      ? ferrariFirstYear(ferrariMotorcycle)
      : null,
    oldest: ferrariOldest,
  };

  // Fuel registrations; unlabelled rows are kept as Unknown.
  const fuelRegistrations = fuelComposition.map((row) => ({
    key: (row.brandstof_omschrijving ?? "onbekend").toLowerCase(),
    label:
      fuelLabelByKey[(row.brandstof_omschrijving ?? "").toLowerCase()] ??
      (row.brandstof_omschrijving ?? "Unknown"),
    count: Number(row.aantal),
  }));

  // Fuel cell coverage per recorded fuel, keyed and labelled like the
  // fuel registrations; unlabelled rows are kept as Unknown.
  const fuelCellByFuel = fuelCellRaw
    .map((row) => ({
      key: (row.brandstof_omschrijving ?? "onbekend").toLowerCase(),
      label:
        fuelLabelByKey[(row.brandstof_omschrijving ?? "").toLowerCase()] ??
        (row.brandstof_omschrijving ?? "Unknown"),
      count: Number(row.vehicles),
    }))
    .sort((a, b) => b.count - a.count);

  // Electric split; rows without a hybrid class are battery electric.
  const splitByClass = new Map();
  for (const row of electricSplitRaw) {
    const klass = (row.klasse_hybride_elektrisch_voertuig ?? "").toLowerCase();
    const count = Number(row.aantal);
    if (klass === "") {
      splitByClass.set("bev", (splitByClass.get("bev") ?? 0) + count);
    } else {
      const target = electricClassByKey[klass] ?? {
        key: klass,
        label: row.klasse_hybride_elektrisch_voertuig,
      };
      splitByClass.set(
        target.key,
        (splitByClass.get(target.key) ?? 0) + count
      );
    }
  }
  const labelBySplitKey = {
    bev: "Battery electric",
    "novc-hev": "Full hybrid",
    "ovc-hev": "Plug-in hybrid",
    fchv: "Fuel cell hybrid",
  };
  const electricSplit = [...splitByClass.entries()]
    .map(([key, count]) => ({
      key,
      label: labelBySplitKey[key] ?? key,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const typesByKey = new Map();
  for (const row of vehicleTypes) {
    const type = row.voertuigsoort ?? "";
    const known = vehicleTypeByKey[type];
    const key = known?.key ?? type.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    typesByKey.set(key, {
      key,
      label: known?.label ?? type,
      count: (typesByKey.get(key)?.count ?? 0) + Number(row.aantal),
    });
  }
  const vehicleTypesList = [...typesByKey.values()].sort(
    (a, b) => b.count - a.count
  );

  const registrationYears = [];
  let registrationYearsUnknown = 0;
  for (const row of registrationYearsRaw) {
    if (row.jaar == null) {
      registrationYearsUnknown += Number(row.aantal);
    } else {
      registrationYears.push({ year: Number(row.jaar), count: Number(row.aantal) });
    }
  }

  /*
    Heavy turn: average mass and engine size per first-admission-year
    cohort of passenger cars, merged on year. Both queries share the
    same where clause, so their counts match per year and the two
    arrays carry the same merged rows; each panel of the visual reads
    its own array so the series stay independently consumable.
  */
  const MIN_COHORT = 1000;
  const massByYearMap = new Map();
  for (const row of massByYearRaw) {
    if (row.year == null || Number(row.n) < MIN_COHORT) continue;
    massByYearMap.set(Number(row.year), {
      avgMass: Math.round(Number(row.avg_mass)),
      count: Number(row.n),
    });
  }
  const engineSizeByYearMap = new Map();
  for (const row of engineSizeByYearRaw) {
    if (row.year == null || Number(row.n) < MIN_COHORT) continue;
    engineSizeByYearMap.set(Number(row.year), {
      avgEngineSize: Math.round(Number(row.avg_cc)),
      // Cars of the cohort with a recorded cilinderinhoud; electric
      // vehicles have none, so this is the base of the engine average.
      withEngine: Number(row.n_cc),
    });
  }
  const heavyTurnCohorts = [...massByYearMap.entries()]
    .filter(([year]) => engineSizeByYearMap.has(year))
    .map(([year, { avgMass, count }]) => {
      const engine = engineSizeByYearMap.get(year);
      return { year, avgMass, avgEngineSize: engine.avgEngineSize, count };
    });
  const massByYear = heavyTurnCohorts.map(({ year, avgMass, avgEngineSize, count }) => ({
    year,
    avgMass,
    avgEngineSize,
    count,
  }));
  const engineSizeByYear = heavyTurnCohorts.map((cohort) => ({
    ...cohort,
    withEngine: engineSizeByYearMap.get(cohort.year).withEngine,
  }));

  const snapshot = {
    retrievedAt: new Date().toISOString().slice(0, 10),
    source: {
      name: "RDW Open Data",
      url: "https://opendata.rdw.nl",
      license: "CC0 1.0",
      datasets: {
        base: DATASET_BASE,
        fuel: DATASET_FUEL,
        ferrari: DATASET_FERRARI,
      },
    },
    totals: {
      vehicles: Number(vehicles[0].vehicles),
      vehiclesWithFuelData: Number(fuelTotals[0].vehicles),
      fuelRegistrations: Number(fuelTotals[0].rows),
    },
    fuelRegistrations,
    electricSplit,
    fuelCellByFuel,
    vehicleTypes: vehicleTypesList,
    registrationYears,
    registrationYearsUnknown,
    massByYear,
    engineSizeByYear,
    ferrari,
  };

  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data"
  );
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "snapshot.json");

  // Narration step: the previous narration is reused whenever the data
  // signature is unchanged, and without MISTRAL_API_KEY (plain push
  // build, local run) the step is skipped entirely and any existing
  // narrations are left untouched. A missing or failed narration
  // never fails the snapshot.
  let existingNarration = null;
  try {
    existingNarration = JSON.parse(await readFile(target, "utf8")).narration ?? null;
  } catch {
    // First run: no snapshot to reuse a narration from.
  }
  try {
    snapshot.narration = await narrate(snapshot, existingNarration);
  } catch (error) {
    // Fail-soft: an unexpected narration error must never fail the
    // snapshot; the existing narrations stay and this run adds none.
    console.error(`Narration skipped: ${error.message}`);
    snapshot.narration = existingNarration;
  }
  if (!snapshot.narration) delete snapshot.narration;

  await writeFile(target, `${pretty(snapshot, 0)}\n`, "utf8");

  const electricTotal = electricSplit.reduce((sum, e) => sum + e.count, 0);
  console.log(
    `Snapshot written to ${target}: ${snapshot.totals.vehicles} vehicles, ` +
      `${electricTotal} with electric drive, retrieved ${snapshot.retrievedAt}.`
  );
  console.log(
    `Ferrari coda: ${ferrari.total} vehicles, ` +
      `${ferrari.tractors} tractors, top model ` +
      `${ferrari.tractorsTopModel ? `${ferrari.tractorsTopModel.name} (${ferrari.tractorsTopModel.count})` : "none"}.`
  );
  const narrated = Object.keys(snapshot.narration?.visuals ?? {});
  console.log(
    snapshot.narration
      ? `Narration: ${narrated.length} visual(s) narrated for signature ${snapshot.narration.signature.slice(0, 8)}.`
      : "Narration: none this run."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
