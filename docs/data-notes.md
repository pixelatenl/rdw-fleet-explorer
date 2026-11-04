# RDW fuel register: verified data notes

Everything below was verified live against the RDW Open Data API on
3–4 November 2026 (keyless SODA2 endpoints, CC0). The snapshot pipeline
(`scripts/snapshot.mjs`) builds the "The fleet by fuel" classification on
these facts. Re-verify cheaply before relying on any of it again; the
register is a live administrative dataset and drifts slowly.

## Datasets and raw shape

- Fuel dataset `8ys7-d773` ("gekentekende voertuig brandstof") holds
  **one row per fuel registration**: one row per (kenteken, fuel), with
  `brandstof_volgnummer` numbering a vehicle's fuel records 1, 2, 3…
  - 17,042,252 records covering **15,173,606 distinct kentekens**
    (`select count(1), count(distinct kenteken)`).
- Base register `m9d7-ebf2` holds one row per vehicle (16,882,072
  vehicles; the difference is trailers and towed equipment without fuel
  data).
- Per fuel, rows = distinct vehicles (no duplicate fuel rows), e.g.
  Benzine 11,308,514 = 11,308,514 vehicles.

## Cross-tab identity (the backbone of the cheap aggregation)

One indexed group-by
(`select brandstof_omschrijving, brandstof_volgnummer,
klasse_hybride_elektrisch_voertuig, count(1) group by …`, returns in
~2 s) maps every fuel-sequence group. Verified cells (fuel, volgnummer):

- v1: Benzine 10,034,907 · Diesel 2,593,720 · Elektriciteit 2,472,135 ·
  LPG 56,440 · CNG 10,393 · Alcohol 3,952 · LNG 1,561 · Waterstof 497 ·
  unlabelled 1
- v2: Benzine 1,272,873 · Elektriciteit 489,572 · LPG 92,254 ·
  Diesel 8,808 · CNG 1,680 · Alcohol 592 · Waterstof 705 · LNG 39
- v3: LPG 989 · Benzine 734 · Elektriciteit 255 · Alcohol 131 ·
  CNG 11 · LNG 1

**Identity: the volgnummer-1 records sum to exactly the vehicle count
with fuel data (15,173,606)** — every vehicle has exactly one primary
fuel record. The pipeline checks this as a tolerance identity.

## Field semantics the classification depends on

- `brandstof_volgnummer` is a **sequence, not a classification**:
  2,472,135 vehicles list Elektriciteit first, but only 1,245,906 are
  battery electric — roughly 1.2 million hybrids list electricity first,
  and petrol-LPG conversions list their fuels in either order. Never
  classify by first-listed fuel alone.
- `klasse_hybride_elektrisch_voertuig` on an Elektriciteit row gives the
  drivetrain class, and it is repeated on **all** rows of a classed
  hybrid vehicle: `NOVC-HEV` (full hybrid, 995,189 vehicles),
  `OVC-HEV` (plug-in hybrid, 718,786), `NOVC-FCHV`/`OVC-FCHV` (fuel cell
  hybrid, 2,081). A row with a class always belongs to a vehicle that
  also has an Elektriciteit row (verified: classed distinct vehicles =
  classed Elektriciteit rows for every class). Empty/null class on an
  Elektriciteit row = battery electric (1,245,906 vehicles; the treemap's
  `bev` tile). The four classes partition all 2,961,962 Elektriciteit
  records exactly.
- SoQL on this dataset supports `field is null` for the class and fuel
  fields (use it; `not in (...)` silently drops nulls).

## The fuel cell class: records versus vehicles

The fuel cell hybrid class is a tiny, emerging category and the
register applies it loosely. Verified live on 4 November 2026
(`select count(distinct kenteken) where klasse hybride in
('NOVC-FCHV','OVC-FCHV')`, plus a full fetch of the group's 4,169
rows — a small group under the fetch rule):

- **2,082 distinct vehicles** carry the class. Their rows total
  **4,169 fuel records**: 2,082 Elektriciteit (exactly one per classed
  vehicle, the verified identity above), 1,083 Waterstof, 992 Benzine,
  7 Diesel, 4 LPG, 1 Alcohol.
- The per-fuel coverage counts (the snapshot's `fuelCellByFuel`) are
  **record counts** — one row per recorded fuel. Per fuel they happen
  to equal the distinct vehicles listing that fuel, but they must
  never be summed into a vehicle total: the sum is 4,169 *records*,
  roughly twice the vehicle count, because every classed vehicle books
  several fuels. The site copy once summed the entries and called the
  result vehicles; the vehicle basis is the distinct-kenteken count,
  which equals the Elektriciteit entry.
- Roughly **half of the 2,082 vehicles list petrol, not hydrogen, as
  their other fuel** (992 petrol records against 1,083 hydrogen) — an
  artefact of the register's young fuel cell bookkeeping. The sequence
  position is no cleaner here than elsewhere: 396 of the hydrogen
  records and 986 of the petrol records are volgnummer 1, so "second
  fuel record" must not be read as volgnummer-2.
- The non-electric records number 2,087 over 2,082 vehicles; the five
  extra records belong to the five vehicles that book a **third** fuel
  (verified in the full fetch; e.g. VLH38V lists LPG, Elektriciteit and
  Benzine).
- The class-based tile follows the register faithfully — the `fchv`
  entry folds into battery electric in the treemap, and the electric
  slice chart splits it back out — and the page's coverage fact
  discloses the noise: vehicles stated as vehicles (2,082), the
  per-fuel split stated as records.

## The fleet-by-fuel classification

Seven mutually exclusive categories, in rule order: battery electric →
full hybrid → plug-in hybrid → LPG → petrol → diesel → other
(catch-all). The electric side comes entirely from the hybrid classes
above (the treemap's mechanism), so a hybrid is a hybrid and is never
also counted as petrol or diesel. Non-electric vehicles are classified
from the cross-tab plus explicit row fetches of the small fuel-sequence
groups: the primary-fuel cells outside the four majors (CNG, alcohol,
LNG, hydrogen, unlabelled — ~15.9k vehicles) and every secondary
volgnummer cell under 50,000 rows (Diesel v2 8,808 classed+classless,
CNG v2, Alcohol v2/v3, LNG v2/v3, Waterstof v2, Benzine v3, LPG v3,
classless Elektriciteit v2/v3). Each group is fetched as kentekens and
resolved to full fuel records through indexed `kenteken in (…)` lookups
(500 per query, ~2 s). The two classless v2 cells too large to fetch
(Benzine v2 55,176 classless, LPG v2 92,027 classless) are pure
arithmetic: the LPG-v2 cell is petrol-first conversions plus the
locally classified small-group vehicles, so subtracting those moves
exactly the conversions out of the petrol-first count.

Resulting counts (2026-11-04 snapshot): petrol 9,477,781 · diesel
2,577,327 · battery electric 1,245,906 · full hybrid 995,189 ·
plug-in hybrid 718,786 · LPG 148,002 · other 10,615 — summing exactly to
15,173,606 by construction (other is the catch-all).

## Anomalies and their landing rules

The register is not perfectly consistent; a few hundred records are
broken or incomplete. They land as follows, by construction:

- **Classless electric duals** (Elektriciteit record with no hybrid
  class plus an extra fuel record, ~459 vehicles): land in **battery
  electric** via the class mechanism (the treemap counts them the same
  way). Their companion rows are excluded from the non-electric
  arithmetic where visible.
- **Broken volgnummer sequences** (records without a volgnummer-1 row,
  duplicate primaries): the vehicle is placed by its fuel records where
  those are counted (e.g. an LPG record puts it in LPG), otherwise the
  **other** catch-all absorbs it. Current residue: 128 vehicles.
- **Records outside expected shapes** (unlabelled fuel, the single
  NULL-fuel vehicle): **other**.
- Diesel-plus-LNG duals stay **diesel** (rule 6); petrol cars converted
  to LPG count once as **LPG** (rule 4); fuel cell hybrids, hydrogen
  combustion, CNG, alcohol, LNG are **other**.

## Aggregation constraints (hard rules for pipeline work)

- **No per-vehicle scans, distinct-counts, or unions over large
  groups.** Distinct-count/union queries over the 17 M-row fuel dataset
  can hang toward undici's 300 s header timeout and killed an earlier
  pipeline run. Everything must come from the indexed cross-tab, the
  per-fuel counts, the treemap classes, arithmetic identities, and
  explicit fetches of groups under ~50,000 rows.
- **Every fetch gets retry logic**: at least two retries with backoff
  on network errors or timeouts, plus a per-attempt timeout
  (20 s) so a hung query fails fast into the next attempt.
- **Speed gate**: every query returns within seconds; the full snapshot
  run finishes in a couple of minutes end to end (currently ~1–2 min).

## Self-checks in the pipeline

The seven categories partition the vehicles with fuel data by
construction (other is the remainder), so their sum is structural.
Cross-identities are **tolerance checks**: they fail the snapshot only
on material deviation (more than 1 % and more than 1,000 vehicles) and
log small residuals in the run log:

- volgnummer-1 records = vehicles with fuel data;
- hybrid classes sum = Elektriciteit records (electric partition);
- full/plug-in hybrid bars = the treemap's drivetrain classes;
- non-electric diesel records = diesel-first vehicles + fetched
  secondary diesel rows.

A negative category always fails the snapshot.

## Derived site metadata

The page's derived-not-hardcoded rule extends to the SEO surface: the
title and meta description, the Open Graph/Twitter tags and the JSON-LD
Dataset node are all computed in `app/layout.tsx` at module scope from
the committed `src/data/snapshot.json` at build time, through Next's
static metadata path — no runtime code, no pipeline references, no
numbers copied by hand, so the meta description can never go stale
between the weekly rebuilds. The figures keep the page's own formats:
`formatNumber` (en-GB) for counts and `formatPercent` (one decimal) for
the electric share. The description sits in the 150-to-160-character
band on the current snapshot; it floats a few characters per week with
the number widths, which is expected.

Two things are deliberately figure-free so they never go stale: the
`public/images/og.png` Open Graph image (rebuilt from
`design/og-image.html` with headless Chrome; it carries the product
name and a stable tagline only) and its `og:image:alt`. The structured
data has two nodes in the page head: a schema.org **Dataset** (creator
Pixelate, provider RDW with the opendata.rdw.nl attribution, CC0
license, the source repository via `sameAs`, `dateModified` from the
snapshot's retrieval date) and a minimal **WebSite** node. The
canonical URL (`https://fleet.pixelate.nl/`) and the shared site name
live in `src/family.ts` as `siteUrl`/`siteName`, next to the existing
launcher and source URLs, so the family's other product sites inherit
the pattern. `app/robots.ts` and `app/sitemap.ts` resolve against the
same constants.
