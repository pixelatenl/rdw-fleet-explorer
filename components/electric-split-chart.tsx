"use client";

import {
  snapshot,
  electricVehicles,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

/** Chart token index used for each drivetrain segment. */
const tokenByKey: Record<string, number> = {
  bev: 1,
  "novc-hev": 2,
  "ovc-hev": 3,
  fchv: 4,
};

/**
 * One stacked bar: all vehicles with electric drive, split into
 * battery electric, full hybrid, plug-in hybrid and fuel cell hybrid.
 * Each segment gets a gradient derived from its own chart token; hover,
 * focus and tap tooltips come from the shared client tooltip component.
 */
export function ElectricSplitChart() {
  const segments = snapshot.electricSplit;

  return (
    <figure>
      <div
        className="flex h-10 w-full overflow-hidden rounded-md border border-border"
        role="img"
        aria-label={`Of ${formatNumber(electricVehicles)} vehicles with electric drive, ${formatNumber(segments[0].count)} are battery electric, ${formatNumber(segments[1].count)} are full hybrid, ${formatNumber(segments[2].count)} are plug-in hybrid and ${formatNumber(segments[3].count)} are fuel cell hybrid.`}
      >
        {segments.map((segment) => {
          const width = (segment.count / electricVehicles) * 100;
          const percent = formatPercent(segment.count / electricVehicles);
          const tokenIndex = tokenByKey[segment.key] ?? 5;
          return (
            <ChartTooltip
              key={segment.key}
              label={segment.label}
              value={formatNumber(segment.count)}
              percent={percent}
            >
              {(trigger) => (
                <div
                  {...trigger}
                  className={`chart-tooltip-trigger chart-gradient-${tokenIndex}`}
                  style={{ width: `${Math.max(width, 0.5)}%` }}
                />
              )}
            </ChartTooltip>
          );
        })}
      </div>
      <figcaption>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {segments.map((segment) => {
            const tokenIndex = tokenByKey[segment.key] ?? 5;
            return (
              <li
                key={segment.key}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="inline-block size-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: `var(--chart-${tokenIndex})` }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{segment.label}</span>
                <span className="ml-auto font-medium tabular-nums">
                  {formatNumber(segment.count)}
                </span>
                <span className="w-14 text-right text-muted-foreground tabular-nums">
                  {formatPercent(segment.count / electricVehicles)}
                </span>
              </li>
            );
          })}
        </ul>
      </figcaption>
    </figure>
  );
}
