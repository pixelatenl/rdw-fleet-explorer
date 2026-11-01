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

const vehicleTypeLabelByKey = {
  "personenauto": "Passenger car",
  "bedrijfsauto": "Van",
  "bromfiets": "Moped",
  "motorfiets": "Motorcycle",
  "aanhangwagen": "Trailer",
  "middenasaanhangwagen": "Centre-axle trailer",
  "land- of bosbouwtrekker": "Agricultural tractor",
  "land- of bosb aanhw of getr uitr stuk": "Agricultural trailer or equipment",
  "oplegger": "Semi-trailer",
  "motorrijtuig met beperkte snelheid": "Slow-moving vehicle",
  "driewielig motorrijtuig": "Three-wheeled vehicle",
  "mobiele machine": "Mobile machine",
  "bus": "Bus",
  "autonome aanhangwagen": "Autonomous trailer",
  "motorfiets met zijspan": "Motorcycle with sidecar",
};

async function main() {
  const [
    fuelComposition,
    electricSplitRaw,
    vehicleTypes,
    registrationYearsRaw,
    fuelTotals,
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

  const typesByLabel = new Map();
  for (const row of vehicleTypes) {
    const label = vehicleTypeLabelByKey[row.voertuigsoort] ?? row.voertuigsoort;
    typesByLabel.set(label, (typesByLabel.get(label) ?? 0) + Number(row.aantal));
  }
  const vehicleTypesList = [...typesByLabel.entries()]
    .map(([label, count]) => ({
      key: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const registrationYears = [];
  let registrationYearsUnknown = 0;
  for (const row of registrationYearsRaw) {
    if (row.jaar == null) {
      registrationYearsUnknown += Number(row.aantal);
    } else {
      registrationYears.push({ year: Number(row.jaar), count: Number(row.aantal) });
    }
  }

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
    vehicleTypes: vehicleTypesList,
    registrationYears,
    registrationYearsUnknown,
  };

  const dir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "src",
    "data"
  );
  await mkdir(dir, { recursive: true });
  const target = path.join(dir, "snapshot.json");
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

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
