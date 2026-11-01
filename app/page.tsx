import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FleetTreemap } from "@/components/fleet-treemap";
import { ElectricSplitChart } from "@/components/electric-split-chart";
import { FuelRegistrationsChart } from "@/components/fuel-registrations-chart";
import { VehicleTypesChart } from "@/components/vehicle-types-chart";
import { RegistrationYearChart } from "@/components/registration-year-chart";
import { HeavyTurnChart } from "@/components/heavy-turn-chart";
import { snapshot, formatNumber, formatDate } from "@/data/snapshot";

export default function Home() {
  const latestCohort =
    snapshot.engineSizeByYear[snapshot.engineSizeByYear.length - 1];

  // Fuel cell coverage, derived from the snapshot: the total over all
  // recorded fuels, plus the hydrogen and petrol entries. The sentence
  // is omitted when an expected entry is missing.
  const fuelCellTotal = snapshot.fuelCellByFuel.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  const fuelCellHydrogen = snapshot.fuelCellByFuel.find(
    (entry) => entry.key === "waterstof",
  );
  const fuelCellPetrol = snapshot.fuelCellByFuel.find(
    (entry) => entry.key === "benzine",
  );

  // Median entry year over the full registration-year series, sorted
  // ascending: the first year where the cumulative count reaches half
  // of the vehicles with a known year.
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
  const latestEntryYear =
    snapshot.registrationYears[snapshot.registrationYears.length - 1]?.year;

  const datasetJsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Dutch fleet aggregates from the RDW vehicle register",
    description:
      "How electric is the Dutch fleet? Live aggregates from the complete RDW vehicle register, refreshed weekly and visualized by Pixelate.",
    url: "https://fleet.pixelate.nl",
    isAccessibleForFree: true,
    license: "https://creativecommons.org/publicdomain/zero/1.0/",
    creator: {
      "@type": "Organization",
      name: "Pixelate BV",
      url: "https://pixelate.nl",
    },
    dateModified: snapshot.retrievedAt,
  };

  return (
    <div className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 sm:py-16">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
      />
      <section className="mb-12">
        <p className="mb-3 text-sm font-medium tracking-wide text-primary uppercase">
          Dutch open data, visualized by Pixelate
        </p>
        <h1 className="max-w-5xl text-4xl font-bold tracking-tight sm:text-5xl">
          How <span className="text-brand-accent">electric</span> is the{" "}
          <span className="text-brand-accent">Dutch</span> fleet?
        </h1>
        <p className="mt-4 max-w-5xl text-lg text-muted-foreground">
          Live aggregates from the complete RDW vehicle register, more than{" "}
          {formatNumber(snapshot.totals.vehicles)} vehicles, refreshed
          weekly and rendered straight into this page.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Data received on {formatDate(snapshot.retrievedAt)}.
        </p>

        <div className="mt-8">
          <FleetTreemap />
        </div>
      </section>

      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">The electric fleet, split by drivetrain</CardTitle>
            <CardDescription>
              Every motor vehicle in the register, mopeds and motorcycles
              included, that lists{" "}
              <span className="text-brand-accent">electricity</span> as one
              of its fuels, grouped by its recorded hybrid class.{" "}
              {fuelCellHydrogen &&
                fuelCellPetrol &&
                fuelCellTotal > 0 &&
                `The fuel cell tile counts only fuel cell vehicles that list electricity; the register holds ${formatNumber(fuelCellTotal)} vehicles with a fuel cell class, of which ${formatNumber(fuelCellHydrogen.count)} list hydrogen and ${formatNumber(fuelCellPetrol.count)} petrol.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ElectricSplitChart />
          </CardContent>
        </Card>
      </section>

      <section className="mb-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fuel registrations</CardTitle>
            <CardDescription>
              Hybrid vehicles carry one registration per fuel, so petrol and
              electric both include hybrids. The electric bar is vehicles,
              the only fuel that is never double counted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FuelRegistrationsChart />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The register by vehicle type</CardTitle>
            <CardDescription>
              The fleet is far more than cars: mopeds, trailers, tractors and
              vans are all part of the register.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VehicleTypesChart />
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">When today&apos;s fleet entered the Netherlands</CardTitle>
            <CardDescription>
              Each bar counts only the vehicles from that entry year that
              are still registered today. Vehicles scrapped, exported, or
              deregistered since have left the register, so a bar is a
              survivor count, not the number registered that year. Half
              of the fleet entered in {medianEntryYear} or later, and{" "}
              {latestEntryYear} is a partial year.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegistrationYearChart />
            <p className="mt-4 text-sm text-muted-foreground">
              The spike in 2021 reflects a one-off registration peak in the
              register, and {formatNumber(snapshot.registrationYearsUnknown)}{" "}
              vehicles have no registration year recorded. Recent years
              appear brighter.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">The heavy turn</CardTitle>
            <CardDescription>
              Average mass and engine size of passenger cars by the year
              they were first registered in the Netherlands. Engines
              shrank for four decades while cars grew heavier; both trends
              bend around{" "}
              <span className="text-brand-accent">2017 to 2020</span>, where
              electrification arrives. The most recent cohort is a partial
              year. Average mass covers all passenger cars, electric ones
              included. Engine size covers only the cars that have an
              engine, because electric vehicles have no cylinder capacity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeavyTurnChart />
            <p className="mt-4 text-sm text-muted-foreground">
              Both series are means per first-registration-year cohort,
              not medians.{" "}
              {formatNumber(latestCohort.count - (latestCohort.withEngine ?? 0))}{" "}
              of {formatNumber(latestCohort.count)} cars in the{" "}
              {latestCohort.year} cohort have no engine capacity.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Method and sources</CardTitle>
            <CardDescription>
              Every figure on this page is a server-side aggregation of the
              official register, embedded at build time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                Source: RDW Open Data, datasets{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  {snapshot.source.datasets.base}
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  {snapshot.source.datasets.fuel}
                </code>
                , license {snapshot.source.license}.
              </li>
              <li>
                Snapshot date: {snapshot.retrievedAt}. The register reflects
                the current state only, so time series on this page are built
                from what is on the road today.
              </li>
              <li>
                Aggregations are computed with server-side queries against
                the RDW API; no raw vehicle records are stored or published.
                No personal owner data exists in this source.
              </li>
              <li>
                The heavy turn: SoQL averages of{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  massa_ledig_voertuig
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  cilinderinhoud
                </code>{" "}
                per first-admission-year cohort of passenger cars from 1975
                on. The mass averages cover all passenger cars including
                electric vehicles, the engine-size averages cover only
                vehicles with a recorded{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  cilinderinhoud
                </code>
                , and cohorts under 1,000 vehicles are excluded.
              </li>
              <li>
                The fuel cell coverage is a SoQL count of distinct{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  kenteken
                </code>{" "}
                per recorded fuel over the fuel cell hybrid classes{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  NOVC-FCHV
                </code>{" "}
                and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  OVC-FCHV
                </code>
                . Hydrogen fuel cell vehicles carry a{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  Waterstof
                </code>{" "}
                row without a matching{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                  Elektriciteit
                </code>{" "}
                row, which is why the electric split counts only the
                electricity-listing portion.
              </li>
              <li>
                Entry year is the first registration in the Netherlands,
                so imported used vehicles count in the year they arrived,
                not their build year. Because the register holds the
                current state only, older bars shrink through attrition,
                not through declining registrations.
              </li>
              <li>
                Figures include all vehicle types unless stated otherwise;
                trailers and similar vehicles without fuel data are excluded
                from fuel-based shares. The fuel-data total covers all motor
                vehicles, mopeds and motorcycles included, so the drivetrain
                figures are motor vehicle figures, not car figures.
              </li>
              <li className="text-xs">
                Photo by{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/@chuttersnap"
                >
                  CHUTTERSNAP
                </a>{" "}
                on{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/photos/electric-vehicle-charging-cable-plugged-into-car-xJLsHl0hIik"
                >
                  Unsplash
                </a>
                .
              </li>
              <li className="text-xs">
                Photo by{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/@ivankazlouskij"
                >
                  Ivan Kazlouskij
                </a>{" "}
                on{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/photos/a-close-up-of-a-cars-logo-TgtwqlglS-s"
                >
                  Unsplash
                </a>
                .
              </li>
              <li className="text-xs">
                Photo by{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/@mkumbwajr"
                >
                  Ali Mkumbwa
                </a>{" "}
                on{" "}
                <a
                  className="underline underline-offset-2 hover:text-foreground"
                  href="https://unsplash.com/photos/a-man-pumping-gas-into-his-car-at-a-gas-station-BK20Ws-wSFc"
                >
                  Unsplash
                </a>
                .
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
