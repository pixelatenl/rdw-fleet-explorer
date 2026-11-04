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
import {
  narrate,
  visualContexts,
  visualSignature,
  validateNarration,
} from "./narration.mjs";

const BASE = "https://opendata.rdw.nl/resource";
const DATASET_BASE = "m9d7-ebf2";
const DATASET_FUEL = "8ys7-d773";
const DATASET_FERRARI = "pmhw-w82q";

/*
  Query plumbing. Every request to the RDW API runs with a per-attempt
  timeout and at least two retries with backoff: a hung or flaky query
  fails fast into the next attempt instead of blocking the run toward
  the client's 300-second header timeout. Failures surface with the
  HTTP status and the query text, never anything sensitive.
*/
const REQUEST_TIMEOUT_MS = 20000;
const REQUEST_RETRIES = 2;
const RETRY_BACKOFF_MS = [1000, 4000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJsonWithRetry(url) {
  let lastError = null;
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS[attempt - 1]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`RDW query failed (${response.status})`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`RDW query failed after ${REQUEST_RETRIES + 1} attempts: ${lastError?.message}`);
}

async function query(dataset, soql) {
  const url = `${BASE}/${dataset}.json?$query=${encodeURIComponent(soql)}`;
  try {
    return await fetchJsonWithRetry(url);
  } catch (error) {
    throw new Error(`${error.message} on ${dataset}: ${soql}`);
  }
}

/*
  Paged fetch of an explicit small row group, ordered by kenteken for
  stable offset paging (see the Ferrari note below). Only ever used on
  groups below SMALL_GROUP_MAX rows; a larger group would mean the
  classification design no longer matches the register.
*/
const PAGE_SIZE = 1000;

async function fetchGroup(dataset, soql) {
  const records = [];
  let offset = 0;
  for (;;) {
    const page = await query(
      dataset,
      `${soql} order by kenteken limit ${PAGE_SIZE} offset ${offset}`
    );
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
    offset += PAGE_SIZE;
  }
}

/*
  Full fuel-record fetch for an explicit list of kentekens, in chunks:
  `kenteken in (...)` is an indexed lookup, so each chunk returns in
  seconds. Used only on the small groups of the fleet-by-fuel
  classification; the chunk size keeps the URL well within the API's
  limits.
*/
const KENTEKEN_CHUNK_SIZE = 500;

async function fetchFuelRows(kentekens) {
  const rows = [];
  for (let i = 0; i < kentekens.length; i += KENTEKEN_CHUNK_SIZE) {
    const chunk = kentekens
      .slice(i, i + KENTEKEN_CHUNK_SIZE)
      .map((kenteken) => `'${kenteken}'`)
      .join(",");
    rows.push(
      ...(await query(
        DATASET_FUEL,
        "select kenteken, brandstof_omschrijving, brandstof_volgnummer, klasse_hybride_elektrisch_voertuig " +
          `where kenteken in (${chunk})`
      ))
    );
  }
  return rows;
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
    electricSplitRaw,
    vehicleTypes,
    registrationYearsRaw,
    fuelTotals,
    massByYearRaw,
    engineSizeByYearRaw,
    fuelCellRaw,
    // Fleet-by-fuel cross-tab: one indexed group-by over fuel,
    // sequence number, and hybrid class. It maps every fuel-sequence
    // group of the register (one row per registration), which drives
    // the whole mutually exclusive classification below; no
    // distinct-count, union, or per-vehicle scan over a large group
    // runs anywhere in this pipeline.
    fuelSequenceRaw,
  ] = await Promise.all([
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
    query(
      DATASET_FUEL,
      "select brandstof_omschrijving, brandstof_volgnummer, klasse_hybride_elektrisch_voertuig, count(1) as aantal " +
        "group by brandstof_omschrijving, brandstof_volgnummer, klasse_hybride_elektrisch_voertuig order by aantal desc"
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

  /*
    The fleet by fuel: every vehicle with fuel data in exactly one
    mutually exclusive category. A vehicle is one vehicle; a hybrid
    is a hybrid, never also petrol or diesel.

    The raw register holds one row per fuel registration, numbered per
    vehicle by brandstof_volgnummer: totals.fuelRegistrations records
    covering totals.vehiclesWithFuelData vehicles, so the
    volgnummer-1 rows are exactly one per vehicle (asserted below). The volgnummer is a
    sequence, not a classification: most hybrids list electricity
    first, and petrol-LPG conversions list their fuels in either
    order.

    The classification is built from cheap aggregates only:

    - the cross-tab of fuel x volgnummer x hybrid class above, one
      indexed group-by over the register;
    - the electric rows grouped by hybrid class (electricSplitRaw,
      the treemap's source): every vehicle with an Elektriciteit
      record is classified by that class, so the electric side needs
      no per-vehicle work at all;
    - explicit row fetches for the register's small fuel-sequence
      groups: the primary-fuel cells outside the four majors (CNG,
      alcohol, LNG, hydrogen, and unlabelled) and every secondary
      fuel-sequence cell under SMALL_GROUP_MAX rows, each fetched as
      kentekens and resolved to full fuel records through indexed
      kenteken lookups.

    The two classless v2 cells that are too large to fetch (Benzine
    and LPG as the second fuel) are pure arithmetic: the LPG-v2 cell
    is petrol-first conversions plus the small-group vehicles already
    classified locally, so subtracting those leaves the conversions,
    which are exactly the vehicles to move out of the petrol-first
    count. The Benzine-v2 cell holds LPG-first conversions (LPG
    through their own fuel record), diesel-first duals, and
    electricity-first vehicles; none of those is counted as petrol by
    primary fuel, so the cell needs no split.

    Other is the catch-all, so the seven counts partition the
    vehicles with fuel data by construction. The register is a live
    administrative dataset and not perfectly consistent: a small
    residue of records with broken volgnummer sequences, missing
    hybrid classes, or incomplete shapes is not resolvable by any
    aggregate and lands under other (documented in
    docs/data-notes.md). The cross-identity checks at the end are
    tolerance checks and fail only on material deviation; small
    residuals are logged in the run log.
  */
  const withFuelData = Number(fuelTotals[0].vehicles);
  const splitCount = (key) =>
    electricSplit.find((entry) => entry.key === key)?.count ?? 0;
  const electricTotal = electricSplit.reduce(
    (sum, entry) => sum + entry.count,
    0
  );

  // Cross-tab index: classless and classed row counts per fuel and
  // sequence number. Unlabelled fuels key to NO_FUEL.
  const NO_FUEL = "(none)";
  const MAJOR_FUELS = ["Benzine", "Diesel", "Elektriciteit", "LPG"];
  const cells = new Map(); // fuel -> volgnummer -> { classless, classed }
  const cell = (fuel, volg) => {
    if (!cells.has(fuel)) cells.set(fuel, new Map());
    const byVolg = cells.get(fuel);
    if (!byVolg.has(volg)) byVolg.set(volg, { classless: 0, classed: 0 });
    return byVolg.get(volg);
  };
  for (const row of fuelSequenceRaw) {
    const fuel = row.brandstof_omschrijving ?? NO_FUEL;
    const volg = row.brandstof_volgnummer;
    if (volg == null) continue; // a row outside the sequence fails the identity below
    cell(fuel, volg)[
      (row.klasse_hybride_elektrisch_voertuig ?? "") === "" ? "classless" : "classed"
    ] += Number(row.aantal);
  }
  const recordsByFuel = (fuel) =>
    [...(cells.get(fuel)?.values() ?? [])].reduce(
      (sum, c) => sum + c.classless + c.classed,
      0
    );
  const classedByFuel = (fuel) =>
    [...(cells.get(fuel)?.values() ?? [])].reduce(
      (sum, c) => sum + c.classed,
      0
    );
  const classlessCell = (fuel, volg) =>
    cells.get(fuel)?.get(volg)?.classless ?? 0;
  const v1Total = [...cells.values()].reduce(
    (sum, byVolg) => sum + (byVolg.get("1")?.classless ?? 0) + (byVolg.get("1")?.classed ?? 0),
    0
  );

  /*
    Small-group fetches. Every group is fetched as kentekens only;
    the full fuel records of those vehicles follow in one indexed
    pass. Groups: the primary-fuel cells outside the majors (every
    non-electric vehicle whose primary is not petrol, diesel, LPG,
    or electric is classified entirely from its fetched records) and
    every secondary-sequence classless cell under SMALL_GROUP_MAX
    rows, except the two classless Benzine/LPG v2 cells that are too
    large and are handled by arithmetic instead.
  */
  const SMALL_GROUP_MAX = 50000;
  const ARITHMETIC_V2_FUELS = ["Benzine", "LPG"];

  const groups = [];
  for (const [fuel, byVolg] of cells) {
    if (!MAJOR_FUELS.includes(fuel) && (byVolg.get("1")?.classless ?? 0) > 0) {
      groups.push({ fuel, volg: "1" });
    }
    for (const [volg, counts] of byVolg) {
      if (volg === "1") continue;
      if (volg === "2" && ARITHMETIC_V2_FUELS.includes(fuel)) continue;
      if (counts.classless === 0) continue;
      if (counts.classless > SMALL_GROUP_MAX) {
        throw new Error(
          `Fleet by fuel group ${fuel} v${volg} has ${counts.classless} classless rows, over the ${SMALL_GROUP_MAX} fetch limit.`
        );
      }
      groups.push({ fuel, volg });
    }
  }

  const groupKentekens = await Promise.all(
    groups.map(({ fuel, volg }) => {
      const fuelWhere =
        fuel === NO_FUEL
          ? "brandstof_omschrijving is null"
          : `brandstof_omschrijving='${fuel}'`;
      return fetchGroup(
        DATASET_FUEL,
        "select kenteken " +
          `where ${fuelWhere} and brandstof_volgnummer='${volg}' ` +
          "and klasse_hybride_elektrisch_voertuig is null"
      );
    })
  );
  const kentekens = [...new Set(groupKentekens.flat().map((row) => row.kenteken))];
  const vehicleRows = await fetchFuelRows(kentekens);

  /*
    Local classification of every fetched vehicle. Classed hybrid
    rows only ever sit on electric vehicles, so a vehicle reached
    through a classless cell that lists electricity is a classless
    electric dual: counted once by its (absent) hybrid class on the
    electric side, with its companion fuel rows booked so the
    row-count arithmetic can exclude them. A non-electric vehicle is
    classified by its full fuel set under the ordered rule, and
    booked either as a primary-fuel adjustment (petrol- and
    diesel-first vehicles, counted through their big primary cells)
    or as a locally classified small-group vehicle.
  */
  const rowsByKenteken = new Map();
  for (const row of vehicleRows) {
    if (!rowsByKenteken.has(row.kenteken)) rowsByKenteken.set(row.kenteken, []);
    rowsByKenteken.get(row.kenteken).push(row);
  }

  const dualPrimary = new Map(); // classless electric duals by primary fuel
  const dualCompanionRows = new Map(); // their non-electric rows by fuel
  const localCategory = { petrol: 0, diesel: 0, lpg: 0, other: 0 };
  const primaryAdjust = { petrolWithLpg: 0, dieselWithLpg: 0, dieselWithPetrol: 0 };
  let smallsetLpgV2 = 0; // small-group vehicles behind the classless LPG v2 cell
  let dieselRowsAfterV1 = 0; // fetched non-electric Diesel rows at volgnummer >= 2

  for (const rows of rowsByKenteken.values()) {
    const primaryRow = rows.find((row) => row.brandstof_volgnummer === "1");
    // A broken volgnummer sequence (no primary record) breaks the
    // primary-fuel arithmetic for this vehicle: it is not added to
    // any local count here. The ordered rules still place it through
    // its fuel records where those are counted (an LPG record, say),
    // and otherwise the catch-all under other absorbs it, so the
    // partition below stays structural.
    const primary = primaryRow ? primaryRow.brandstof_omschrijving ?? NO_FUEL : null;
    const fuel = (row) => row.brandstof_omschrijving ?? NO_FUEL;
    const has = (name) => rows.some((row) => fuel(row) === name);

    if (has("Elektriciteit")) {
      dualPrimary.set(primary ?? NO_FUEL, (dualPrimary.get(primary ?? NO_FUEL) ?? 0) + 1);
      for (const row of rows) {
        if (fuel(row) === "Elektriciteit") continue;
        const f = fuel(row);
        dualCompanionRows.set(f, (dualCompanionRows.get(f) ?? 0) + 1);
      }
      continue;
    }
    if (primary === null) continue;

    const category = has("LPG")
      ? "lpg"
      : has("Benzine")
        ? "petrol"
        : has("Diesel")
          ? "diesel"
          : "other";
    if (primary === "Benzine") {
      // Petrol-first: counted in the petrol-first total; an LPG
      // record moves the vehicle to LPG through its own fuel record.
      if (category === "lpg") primaryAdjust.petrolWithLpg += 1;
    } else if (primary === "Diesel") {
      // Diesel-first: counted in the diesel-first total; LPG moves
      // the vehicle to LPG, a petrol record to petrol.
      if (category === "lpg") primaryAdjust.dieselWithLpg += 1;
      else if (category === "petrol") primaryAdjust.dieselWithPetrol += 1;
    } else if (primary === "LPG") {
      // LPG-first: already counted by its own LPG record.
    } else {
      localCategory[category] += 1;
      if (
        rows.some(
          (row) => fuel(row) === "LPG" && row.brandstof_volgnummer === "2"
        )
      ) {
        smallsetLpgV2 += 1;
      }
    }
    for (const row of rows) {
      if (fuel(row) === "Diesel" && row.brandstof_volgnummer !== "1") {
        dieselRowsAfterV1 += 1;
      }
    }
  }

  /*
    Category arithmetic. The petrol-first and diesel-first counts come
    from the big primary cells minus the classless electric duals
    that share them. The classless LPG v2 cell is the petrol-first
    conversions (the vast majority) plus the locally classified
    small-group vehicles, so subtracting those moves exactly the
    conversions out of petrol-first. LPG itself is every LPG record
    that is neither classed (an electric hybrid's row) nor a
    classless electric dual's companion row.
  */
  const petrolFirst =
    classlessCell("Benzine", "1") - (dualPrimary.get("Benzine") ?? 0);
  const dieselFirst =
    classlessCell("Diesel", "1") - (dualPrimary.get("Diesel") ?? 0);
  const lpgConversions = classlessCell("LPG", "2") - smallsetLpgV2;

  const fleetByFuel = [
    {
      key: "battery-electric",
      label: "Battery electric",
      count: splitCount("bev"),
    },
    {
      key: "full-hybrid",
      label: "Full hybrid",
      count: splitCount("novc-hev"),
    },
    {
      key: "plug-in-hybrid",
      label: "Plug-in hybrid",
      count: splitCount("ovc-hev"),
    },
    {
      key: "lpg",
      label: "LPG",
      count:
        recordsByFuel("LPG") -
        classedByFuel("LPG") -
        (dualCompanionRows.get("LPG") ?? 0),
    },
    {
      key: "petrol",
      label: "Petrol",
      count:
        petrolFirst -
        lpgConversions -
        primaryAdjust.petrolWithLpg +
        primaryAdjust.dieselWithPetrol +
        localCategory.petrol,
    },
    {
      key: "diesel",
      label: "Diesel",
      count:
        dieselFirst -
        primaryAdjust.dieselWithLpg -
        primaryAdjust.dieselWithPetrol +
        localCategory.diesel,
    },
  ];
  // Other is the catch-all: every vehicle the ordered rules above do
  // not place lands here, so the seven counts partition the vehicles
  // with fuel data by construction. The residual against the locally
  // classified other count is the residue of broken records (see
  // docs/data-notes.md); it is logged, not reconciled away.
  const classifiedOther = splitCount("fchv") + localCategory.other;
  const placedTotal = fleetByFuel.reduce((sum, entry) => sum + entry.count, 0);
  const otherCount = withFuelData - placedTotal;
  fleetByFuel.push({
    key: "other",
    label: "Other",
    count: otherCount,
  });
  fleetByFuel.sort((a, b) => b.count - a.count);
  console.log(
    `Fleet by fuel: other holds ${otherCount} vehicles, of which ` +
      `${classifiedOther} classified from fetched records; ` +
      `${otherCount - classifiedOther} residual records of broken or incomplete shape land in the catch-all.`
  );

  /*
    Pipeline self-checks. The register is a live administrative
    dataset, not a perfectly consistent one: a few hundred records
    carry broken volgnummer sequences, missing hybrid classes, or
    timing skew between extracts. The classification above is a
    partition by construction (Other is the catch-all), so the seven
    counts sum to the vehicle total structurally. The cross-identities
    below are tolerance checks against the same register: they fail
    the snapshot only on material deviation (more than 1 percent and
    more than a thousand vehicles), and log small residuals in the
    run log instead. A negative category is always a bug and always
    fails.
  */
  const categoryCount = (key) =>
    fleetByFuel.find((entry) => entry.key === key).count;
  const fleetByFuelTotal = fleetByFuel.reduce(
    (sum, entry) => sum + entry.count,
    0
  );
  if (fleetByFuelTotal !== withFuelData) {
    throw new Error(
      `Fleet by fuel sums to ${fleetByFuelTotal}, expected ${withFuelData}.`
    );
  }
  if (fleetByFuel.some((entry) => entry.count < 0)) {
    throw new Error(
      `Fleet by fuel has a negative category: ${JSON.stringify(fleetByFuel)}`
    );
  }

  // A cross-identity is material only when it deviates by more than
  // 1 percent AND more than a thousand vehicles; smaller residuals
  // are register noise and are logged, not fatal.
  const checkIdentity = (name, expected, actual) => {
    const deviation = actual - expected;
    if (deviation !== 0) {
      console.log(
        `Fleet by fuel residual: ${name}: expected ${expected}, got ${actual} (${deviation > 0 ? "+" : ""}${deviation}).`
      );
    }
    if (
      Math.abs(deviation) > 1000 &&
      Math.abs(deviation) > 0.01 * Math.abs(expected)
    ) {
      throw new Error(
        `Fleet by fuel identity broken: ${name}: expected ${expected}, got ${actual}.`
      );
    }
  };

  checkIdentity(
    "volgnummer-1 records vs vehicles with fuel data",
    withFuelData,
    v1Total
  );
  checkIdentity(
    "Elektriciteit records vs hybrid-class partition",
    recordsByFuel("Elektriciteit"),
    electricTotal
  );
  checkIdentity(
    "full hybrid bar vs treemap class",
    splitCount("novc-hev"),
    categoryCount("full-hybrid")
  );
  checkIdentity(
    "plug-in hybrid bar vs treemap class",
    splitCount("ovc-hev"),
    categoryCount("plug-in-hybrid")
  );
  const dieselIdentity =
    recordsByFuel("Diesel") -
    classedByFuel("Diesel") -
    (dualCompanionRows.get("Diesel") ?? 0);
  checkIdentity(
    "non-electric diesel records vs diesel-first vehicles plus fetched secondary rows",
    dieselFirst + dieselRowsAfterV1,
    dieselIdentity
  );

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
      vehiclesWithFuelData: withFuelData,
      fuelRegistrations: Number(fuelTotals[0].rows),
    },
    fleetByFuel,
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

  // Narration step: per visual, the previous narration is reused
  // whenever that visual's context signature is unchanged, and without
  // MISTRAL_API_KEY (plain push build, local run) no call is made and
  // the existing narrations are kept (migrated to the per-visual
  // signature shape below). A missing or failed narration
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
  /*
    Storage shape of the narrations: each visual's text is stored
    under the SHA-256 of its own context (the per-visual signature of
    91639d3). A snapshot written before that change still carries the
    old single-signature shape; migrating it here — without any API
    call — keeps a stored text under its visual's signature only when
    the text validates against the current context figures, the same
    rule the staleness guard applies, and drops visuals whose context
    no longer exists. A keyed run therefore re-narrates exactly the
    visuals whose contexts changed and makes no call for the rest.
  */
  if (snapshot.narration) {
    const contexts = visualContexts(snapshot);
    const visuals = {};
    const signatures = {};
    for (const [key, context] of Object.entries(contexts)) {
      const text = snapshot.narration.visuals?.[key];
      if (text && validateNarration(text, context)) {
        visuals[key] = text;
        signatures[key] = visualSignature(context);
      }
    }
    snapshot.narration = { visuals, signatures };
  }
  if (!snapshot.narration) delete snapshot.narration;

  await writeFile(target, `${pretty(snapshot, 0)}\n`, "utf8");

  console.log(
    `Snapshot written to ${target}: ${snapshot.totals.vehicles} vehicles, ` +
      `${electricTotal} with electric drive, retrieved ${snapshot.retrievedAt}.`
  );
  console.log(
    `Fleet by fuel: ${fleetByFuelTotal} vehicles with fuel data, every ` +
      `vehicle in exactly one of ${fleetByFuel.length} categories.`
  );
  console.log(
    `Ferrari coda: ${ferrari.total} vehicles, ` +
      `${ferrari.tractors} tractors, top model ` +
      `${ferrari.tractorsTopModel ? `${ferrari.tractorsTopModel.name} (${ferrari.tractorsTopModel.count})` : "none"}.`
  );
  const narrated = Object.keys(snapshot.narration?.visuals ?? {});
  console.log(
    snapshot.narration
      ? `Narration: ${narrated.length} visual(s) with an insight, each under its own context signature.`
      : "Narration: none this run."
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
