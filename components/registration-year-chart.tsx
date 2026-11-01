"use client";

import {
  snapshot,
  formatNumber,
} from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

const FROM_YEAR = 1970;
const DECADES = [1980, 1990, 2000, 2010, 2020];

/**
 * Vertical bar chart of currently registered vehicles by the year they
 * were first registered in the Netherlands. Rendered as SVG with gradient
 * fills derived from the chart tokens; hover, focus and tap tooltips come
 * from the shared client tooltip component. Recent years keep their
 * brighter fill and lighter opacity distinction. The bottom axis mirrors
 * the heavy turn chart: one border-colored line with a tick and a label
 * at the first bar year, the decades within range, and the last bar
 * year, the endpoints anchored outward so nothing clips at the edges.
 */
export function RegistrationYearChart() {
  const rows = snapshot.registrationYears.filter((row) => row.year >= FROM_YEAR);
  const max = Math.max(...rows.map((row) => row.count));
  const largest = rows.reduce((a, b) => (b.count > a.count ? b : a));
  const chartWidth = 720;
  const chartHeight = 220;
  // Tick and label space below the baseline of the bars.
  const axisHeight = 36;
  const svgHeight = chartHeight + axisHeight;
  const gap = 2;
  const step = chartWidth / rows.length;
  const barWidth = step - gap;

  const firstYear = rows[0].year;
  const lastYear = rows[rows.length - 1].year;

  // Column center of a bar year; null when the year has no bar.
  const xCenter = (year: number) => {
    const index = rows.findIndex((row) => row.year === year);
    return index === -1 ? null : index * step + step / 2;
  };

  const labeledYears = [
    { year: firstYear, anchor: "start" as const },
    ...DECADES.filter((year) => year > firstYear && year < lastYear).map(
      (year) => ({ year, anchor: "middle" as const }),
    ),
    { year: lastYear, anchor: "end" as const },
  ];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${chartWidth} ${svgHeight}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Bar chart of vehicles currently registered in the Netherlands by year of first Dutch registration, from ${firstYear} to ${lastYear}. The largest year is ${largest.year} with ${formatNumber(largest.count)} vehicles.`}
      >
        <defs>
          <linearGradient id="registration-year-recent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--chart-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--chart-1-base)" }} />
          </linearGradient>
          <linearGradient id="registration-year-older" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--chart-2)" }} />
            <stop offset="1" style={{ stopColor: "var(--chart-2-base)" }} />
          </linearGradient>
        </defs>
        {rows.map((row, index) => {
          const barHeight = (row.count / max) * (chartHeight - 8);
          return (
            <ChartTooltip
              key={row.year}
              label={String(row.year)}
              value={`${formatNumber(row.count)} vehicles`}
            >
              {(trigger) => (
                <rect
                  {...trigger}
                  className="chart-tooltip-trigger"
                  x={index * step + gap / 2}
                  y={chartHeight - barHeight}
                  width={Math.max(barWidth - gap, 1)}
                  height={barHeight}
                  fill={
                    row.year >= 2020
                      ? "url(#registration-year-recent)"
                      : "url(#registration-year-older)"
                  }
                  opacity={row.year >= 2020 ? 1 : 0.75}
                />
              )}
            </ChartTooltip>
          );
        })}
        {/* Year axis along the baseline of the bars, with a tick and a
            label at the first bar year, the decades within range and the
            last bar year. The end labels are anchored outward so they
            stay inside the viewBox. */}
        <line
          x1="0"
          x2={chartWidth}
          y1={chartHeight}
          y2={chartHeight}
          stroke="var(--border)"
          strokeWidth="1"
        />
        {labeledYears.map(({ year, anchor }) => {
          const cx = xCenter(year);
          if (cx == null) return null;
          return (
            <g key={`tick-${year}`}>
              <line
                x1={cx}
                x2={cx}
                y1={chartHeight}
                y2={chartHeight + 6}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={cx}
                y={chartHeight + 18}
                textAnchor={anchor}
                fontSize="10"
                style={{ fill: "var(--muted-foreground)" }}
              >
                {year}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Year of first Dutch registration
      </figcaption>
    </figure>
  );
}
