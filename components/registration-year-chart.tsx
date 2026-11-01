import {
  snapshot,
  formatNumber,
} from "@/data/snapshot";

const FROM_YEAR = 1970;

/**
 * Vertical bar chart of currently registered vehicles by the year they
 * were first registered in the Netherlands. Rendered as pure SVG with
 * native title tooltips, so no client JS is needed.
 */
export function RegistrationYearChart() {
  const rows = snapshot.registrationYears.filter((row) => row.year >= FROM_YEAR);
  const max = Math.max(...rows.map((row) => row.count));
  const largest = rows.reduce((a, b) => (b.count > a.count ? b : a));
  const chartWidth = 720;
  const chartHeight = 220;
  const gap = 2;
  const barWidth = chartWidth / rows.length - gap;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Bar chart of vehicles currently registered in the Netherlands by year of first Dutch registration, from ${FROM_YEAR} to 2026. The largest year is ${largest.year} with ${formatNumber(largest.count)} vehicles.`}
      >
        {rows.map((row, index) => {
          const barHeight = (row.count / max) * (chartHeight - 8);
          return (
            <rect
              key={row.year}
              x={index * (chartWidth / rows.length) + gap / 2}
              y={chartHeight - barHeight}
              width={Math.max(barWidth - gap, 1)}
              height={barHeight}
              fill={row.year >= 2020 ? "var(--chart-1)" : "var(--chart-2)"}
              opacity={row.year >= 2020 ? 1 : 0.75}
            >
              <title>{`${row.year}: ${formatNumber(row.count)} vehicles`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{FROM_YEAR}</span>
        <span>Year of first Dutch registration</span>
        <span>2026</span>
      </figcaption>
    </figure>
  );
}
