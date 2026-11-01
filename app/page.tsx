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
import { snapshot, formatNumber } from "@/data/snapshot";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 sm:py-16">
      <section className="mb-12">
        <p className="mb-3 text-sm font-medium tracking-wide text-primary uppercase">
          Dutch open data, visualized by Pixelate
        </p>
        <h1 className="max-w-5xl text-4xl font-bold tracking-tight sm:text-5xl">
          How electric is the Dutch fleet?
        </h1>
        <p className="mt-4 max-w-5xl text-lg text-muted-foreground">
          Live aggregates from the complete RDW vehicle register, more than{" "}
          {formatNumber(snapshot.totals.vehicles)} vehicles, refreshed
          weekly and rendered straight into this page. This is version one
          of a growing family of open data products.
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
              Every vehicle in the register that lists electricity as one of
              its fuels, grouped by its recorded hybrid class.
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
              Currently registered vehicles by the year they were first
              registered in the Netherlands. This is the age structure of the
              fleet, not a sales history.
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
                Figures include all vehicle types unless stated otherwise;
                trailers and similar vehicles without fuel data are excluded
                from fuel-based shares.
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

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">What is next</CardTitle>
            <CardDescription>
              Version one establishes the family pipeline. The next versions
              add depth and correlation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li>
                A per-year electric adoption series, built from a joined
                ingest of registration dates and drivetrains.
              </li>
              <li>
                Regional views: electrification per province and municipality,
                correlated with CBS context such as income and housing stock.
                Municipality-level figures will carry the known attribution
                caveat for lease and business vehicles.
              </li>
              <li>
                A launcher hub connecting all products in the Pixelate data
                family, sharing this theme and the same family header.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
