/*
  Snapshot job for the Dutch Fleet Electrification Explorer.
  Runs server-side SoQL aggregations against the RDW Open Data API and
  writes the result to src/data/snapshot.json. No raw vehicle records
  are stored; every aggregation records its retrieval date.

  Usage: node scripts/snapshot.mjs
  The RDW SODA2 endpoints are keyless and CC0 licensed.
*/

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = "https://opendata.rdw.nl/resource";
const DATASET_BASE = "m9d7-ebf2";
const DATASET_FUEL = "8ys7-d773";

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
      datasets: { base: DATASET_BASE, fuel: DATASET_FUEL },
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
  };

  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data"
  );
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "snapshot.json");
  await writeFile(target, `${pretty(snapshot, 0)}\n`, "utf8");

  const electricTotal = electricSplit.reduce((sum, e) => sum + e.count, 0);
  console.log(
    `Snapshot written to ${target}: ${snapshot.totals.vehicles} vehicles, ` +
      `${electricTotal} with electric drive, retrieved ${snapshot.retrievedAt}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
