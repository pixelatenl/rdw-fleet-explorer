import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FleetTreemap } from "@/components/fleet-treemap";
import { ElectricSplitChart } from "@/components/electric-split-chart";
import { FleetByFuelChart } from "@/components/fleet-by-fuel-chart";
import { VehicleTypesChart } from "@/components/vehicle-types-chart";
import { RegistrationYearChart } from "@/components/registration-year-chart";
import { HeavyTurnChart } from "@/components/heavy-turn-chart";
import { AiInsight } from "@/components/ai-insight";
import { snapshot, electricVehicles, formatNumber, formatDate } from "@/data/snapshot";

export default function Home() {
  const latestCohort =
    snapshot.engineSizeByYear[snapshot.engineSizeByYear.length - 1];

  // AI insight narrations, generated at snapshot time per visual; each
  // block renders only when its narration exists.
  const insights = snapshot.narration?.visuals;

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

  /*
    Ferrari coda: every figure of the closing card, from the snapshot
    only. The copy is assembled sentence by sentence so the omissions
    can keep the humor truthful as the data drifts: the Raptor quip
    renders only while the top tractor model is a Raptor, the
    not-one-red sentence only while the register records no tractor
    color at all, and the motorcycle and oldest sentences only while
    the snapshot still carries their model and year.
  */
  const ferrari = snapshot.ferrari;
  const codaSentences = [
    `You made it to the end of a page about vehicle data, so here is your reward: the Dutch register counts ${formatNumber(ferrari.total)} Ferraris.`,
    `${formatNumber(ferrari.red)} of them are red, because of course they are.`,
    `The most common model is the 458, with ${formatNumber(ferrari.model458)} on the road, the exact car in this photo, tied with the California (${formatNumber(ferrari.california)}).`,
    `Also registered: ${formatNumber(ferrari.tractors)} Ferrari tractors, from a different Italian company with the same name.`,
  ];
  if (ferrari.tractorsTopModel) {
    codaSentences.push(
      `The most common model is the ${ferrari.tractorsTopModel.name}, ${formatNumber(ferrari.tractorsTopModel.count)} strong.`,
    );
    if (ferrari.tractorsTopModel.name.startsWith("RAPTOR")) {
      codaSentences.push("A Ferrari Raptor.");
    }
  }
  if (ferrari.tractorsWithColor === 0) {
    codaSentences.push(
      "And not one of them is red, at least on paper: the register does not record a color for a single tractor.",
    );
  }
  if (ferrari.motorcycleModel && ferrari.motorcycleYear) {
    codaSentences.push(
      `And one Ferrari motorcycle: a ${ferrari.motorcycleYear} ${ferrari.motorcycleModel}, which raises questions we will not answer here.`,
    );
  } else if (ferrari.motorcycle > 0) {
    codaSentences.push(
      `And ${formatNumber(ferrari.motorcycle)} Ferrari motorcycles, which raise questions we will not answer here.`,
    );
  }
  if (ferrari.oldest) {
    codaSentences.push(
      `The oldest Ferrari in the register, a ${ferrari.oldest.year} ${ferrari.oldest.model}, at least makes sense.`,
    );
  }
  const codaCopy = codaSentences.join(" ");

  const codaStats = [
    { label: "Total Ferraris", value: ferrari.total, accent: true },
    { label: "Red", value: ferrari.red, accent: false },
    { label: "458s", value: ferrari.model458, accent: false },
    { label: "Tractors", value: ferrari.tractors, accent: false },
    { label: "Motorcycle", value: ferrari.motorcycle, accent: false },
  ];

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
          Dutch open data
        </p>
        {/*
          Editorial cover. The question is the page's display heading:
          fluid clamp sizing (about 2.7rem at a 390px viewport rising
          to about 4.75rem at desktop), the heaviest weight the system
          sans stack offers, tight leading and tracking, and an em-based
          max-width that keeps the two-line shape at every width — the
          line always breaks after "is the", never by a hard <br>. The
          accented words take the theme-adaptive battery-electric orange
          (--drivetrain-bev: 3.4 to 1 on the light canvas, 5.3 to 1 on
          the dark), the family's header language. The deck steps up to
          text-xl on a ~62-character measure with more air above the
          first chart; every word of the copy stays verbatim.
        */}
        <h1 className="max-w-[11em] text-[clamp(2.6rem,1.96rem+2.9vw,4.75rem)] font-black leading-[1.08] tracking-tight">
          How <span className="text-(--drivetrain-bev)">electric</span> is
          the{" "}
          <span className="text-(--drivetrain-bev)">Dutch</span> fleet?
        </h1>
        <p className="mt-6 max-w-[62ch] text-xl text-muted-foreground">
          Live aggregates from the complete RDW vehicle register, more than{" "}
          {formatNumber(snapshot.totals.vehicles)} vehicles, of which{" "}
          {formatNumber(snapshot.totals.vehiclesWithFuelData)} carry fuel
          data, refreshed weekly and rendered straight into this page.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Data received on {formatDate(snapshot.retrievedAt)}.
        </p>

        <div className="mt-12">
          <FleetTreemap />
        </div>
        {insights?.treemap && (
          <AiInsight text={insights.treemap} outlined />
        )}
      </section>

      <section className="mb-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">The electric slice, in detail</CardTitle>
            <CardDescription>
              The treemap above shows the whole fleet; this view keeps only
              the {formatNumber(electricVehicles)} vehicles with electric
              drive and splits them by drivetrain. Every motor vehicle in
              the register, mopeds and motorcycles included, that lists{" "}
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
            <CardTitle className="text-lg">The fleet by fuel</CardTitle>
            <CardDescription>
              The {formatNumber(snapshot.totals.vehiclesWithFuelData)}{" "}
              vehicles with fuel data, each counted once in exactly one
              fuel category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FleetByFuelChart />
            <p className="mt-4 text-sm text-muted-foreground">
              Every vehicle counted once. A hybrid is a hybrid: it is not
              also counted as petrol or diesel. LPG conversions are
              counted once as LPG.
            </p>
            {insights?.fleetByFuel && (
              <AiInsight text={insights.fleetByFuel} />
            )}
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
            {insights?.vehicleTypes && (
              <AiInsight text={insights.vehicleTypes} />
            )}
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
            {insights?.entryYears && (
              <AiInsight text={insights.entryYears} />
            )}
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
              Both lines show averages, not the exact middle, so a few
              extreme cars can pull a year up or down. In the{" "}
              {latestCohort.year} class,{" "}
              {formatNumber(latestCohort.count - (latestCohort.withEngine ?? 0))}{" "}
              of {formatNumber(latestCohort.count)} cars have no engine
              size to measure at all.
            </p>
            {insights?.heavyTurn && <AiInsight text={insights.heavyTurn} />}
          </CardContent>
        </Card>
      </section>

      {/*
        The coda: deliberately not a Card. A full-bleed photo inside the
        page container, with every figure derived from snapshot.ferrari
        at render time. The photo layer and the themed gradient sit
        behind the content, so the copy, stat row, and closing line
        stay legible in both themes.
      */}
      <section>
        <div className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-2xl sm:min-h-[34rem] lg:min-h-[70vh]">
          <div
            aria-hidden="true"
            className="ferrari-coda-photo absolute inset-0 bg-cover"
            style={{
              backgroundImage:
                'url("/images/ferrari-458-martin-katler.jpg")',
            }}
          />
          <div
            aria-hidden="true"
            className="ferrari-coda-overlay absolute inset-0"
          />
          <div className="relative flex flex-col gap-5 p-6 sm:gap-6 sm:p-10 lg:p-12">
            <p
              className="self-start rounded-full bg-primary px-3 py-1 text-sm font-medium tracking-wide text-primary-foreground uppercase"
            >
              A completely unrelated reward
            </p>
            <h2 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              The Netherlands has{" "}
              <span className="text-brand-accent">
                {formatNumber(ferrari.total)}
              </span>{" "}
              Ferraris
            </h2>
            <p className="max-w-3xl text-base leading-relaxed sm:text-lg">
              {codaCopy}
            </p>
            <div className="grid grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-14 lg:gap-y-0">
              {codaStats.map((stat) => (
                <div key={stat.label}>
                  <p
                    className={`text-4xl font-bold tabular-nums sm:text-5xl ${
                      stat.accent
                        ? "text-brand-accent"
                        : "text-foreground"
                    }`}
                  >
                    {formatNumber(stat.value)}
                  </p>
                  <p className="mt-1 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              How electric is the Dutch fleet? These are not the numbers
              that will tell you.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
