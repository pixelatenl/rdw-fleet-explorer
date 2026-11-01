"use client";

import {
  snapshot,
  formatNumber,
} from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

const FROM_YEAR = 1970;

/**
 * Vertical bar chart of currently registered vehicles by the year they
 * were first registered in the Netherlands. Rendered as SVG with gradient
 * fills derived from the chart tokens; hover, focus and tap tooltips come
 * from the shared client tooltip component. Recent years keep their
 * brighter fill and lighter opacity distinction.
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
                  x={index * (chartWidth / rows.length) + gap / 2}
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
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{FROM_YEAR}</span>
        <span>Year of first Dutch registration</span>
        <span>2026</span>
      </figcaption>
    </figure>
  );
}
