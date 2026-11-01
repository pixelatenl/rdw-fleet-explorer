# Dutch Fleet Electrification Explorer

How fast is the Netherlands going electric? This site aggregates the complete RDW vehicle register, more than 16.8 million vehicles, and visualizes the electrification of the Dutch fleet. It is the first product in the Pixelate open data family: separate product sites sharing one theme, each linking back to a launcher hub.

Built by [Pixelate BV](https://pixelate.nl). Live at fleet.pixelate.nl once deployed.

## Stack

- Next.js (App Router) with static export, so the public site is fully static
- React 19 and TypeScript
- Tailwind CSS v4 with shadcn/ui token conventions
- Charts rendered as pure SVG and CSS, zero chart dependencies and no client-side data fetching

## Getting started

```bash
npm install
npm run dev      # local development
npm run build    # static export to out/
npm run typecheck
```

## Data pipeline

The site never loads raw vehicle records. A weekly GitHub Actions job (`.github/workflows/snapshot.yml`) runs server-side SoQL aggregations against the keyless RDW Open Data API and commits the result to `src/data/snapshot.json`. That commit triggers the build workflow, which embeds the snapshot into the static pages. Rollback is a commit revert.

Run the aggregation manually:

```bash
node scripts/snapshot.mjs
```

Current snapshot aggregates:

- Fuel registrations across the register
- Electric drivetrain split (battery electric, full hybrid, plug-in hybrid, fuel cell hybrid)
- Fleet composition by vehicle type
- Vehicles by year of first Dutch registration

Provenance: RDW Open Data, datasets `m9d7-ebf2` and `8ys7-d773`, CC0 1.0. The RDW gives no actuality guarantee, so the snapshot records its retrieval date and the site displays it.

## Theme

The family theme is defined once in `app/globals.css`: the shadcn/ui default token set with the neutral white surfaces replaced by the Pixelate green, in a light shade for the light theme and the dark pixelate.nl teal for the dark theme. A theme switcher persists the visitor choice and defaults to the operating system preference. The brand color values are provisional until the final brand palette is confirmed; swapping them is a change to the CSS variables in that single file.

## Deployment

Mirrors the pixelate.nl pattern: a GitHub Actions workflow builds the static export and uploads it as an artifact. Upload the artifact contents to the fleet.pixelate.nl directory on the Apache host. FTP credentials belong only in Actions secrets if the upload step is automated later.

## Roadmap

1. Per-year electric adoption series, from a joined ingest of registration dates and drivetrains on the home server
2. Regional views: electrification per province and municipality, correlated with CBS context, with the lease and business attribution caveat
3. Launcher hub connecting the product family

## License

MIT, Pixelate BV. The aggregated RDW data is CC0 1.0.
