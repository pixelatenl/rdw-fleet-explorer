import { Drawer } from "@/components/drawer";
import { snapshot } from "@/data/snapshot";

/**
 * The Method and sources drawer of this product, mounted from the
 * family footer. A server component: the method list renders into
 * the drawer body at build time, so it ships in the static HTML
 * even while the drawer is closed.
 */
export function MethodDrawer() {
  return (
    <Drawer
      label="Method and sources"
      title="Method and sources"
      description="Every figure on this page is a server-side aggregation of the official register, embedded at build time."
    >
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
          from fuel-based shares: trailers, centre-axle trailers,
          semi-trailers, and agricultural trailers and trailed equipment
          have no fuel data, which is why fuel-based figures cover fewer
          vehicles than the register total. The fuel-data total covers all
          motor vehicles, mopeds and motorcycles included, so the
          drivetrain figures are motor vehicle figures, not car figures.
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
            href="https://unsplash.com/@onno_blaauw"
          >
            Onno Blaauw
          </a>{" "}
          on{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://unsplash.com/photos/black-and-white-store-front-VdFLjf5GhWM"
          >
            Unsplash
          </a>
          .
        </li>
        <li className="text-xs">
          Photo by{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://unsplash.com/@haberdoedas"
          >
            Haberdoedas
          </a>{" "}
          on{" "}
          <a
            className="underline underline-offset-2 hover:text-foreground"
            href="https://unsplash.com/photos/a-grey-suv-parked-on-a-gravel-road-02vF_ow1ISE"
          >
            Unsplash
          </a>
          .
        </li>
      </ul>
    </Drawer>
  );
}
