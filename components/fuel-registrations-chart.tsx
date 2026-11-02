"use client";

import {
  snapshot,
  fuelRegistrationsTotal,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

/** Chart token index used for each fuel, matching the legend colors. */
const tokenByKey: Record<string, number> = {
  benzine: 3,
  elektriciteit: 1,
  diesel: 4,
  lpg: 5,
  other: 2,
};

/**
 * Horizontal bar chart of fuel registrations in the RDW register.
 * Multi-fuel vehicles (hybrids) count once per fuel, which is stated
 * in the card copy. CSS bars with token-derived gradients; the full
 * track is the hover, focus and tap target so even the smallest fuels
 * get a tooltip.
 */
export function FuelRegistrationsChart() {
  const rows = [...snapshot.fuelRegistrations]
    .filter((entry) => entry.key !== "onbekend")
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.count - a.count);

  const otherCount = rows.slice(4).reduce((sum, row) => sum + row.count, 0);
  const display = [
    ...rows.slice(0, 4).map((row) => ({ ...row })),
    ...(otherCount > 0
      ? [{ key: "other", label: "Other", count: otherCount }]
      : []),
  ];

  return (
    <ul className="flex flex-col gap-2.5">
      {display.map((row) => {
        const share = row.count / fuelRegistrationsTotal;
        return (
          <li key={row.key} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">
                {formatNumber(row.count)}
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {formatPercent(share)}
                </span>
              </span>
            </div>
            <ChartTooltip
              label={row.label}
              value={formatNumber(row.count)}
              percent={formatPercent(share)}
            >
              {(trigger, active) => (
                <div
                  {...trigger}
                  className="chart-tooltip-trigger h-2.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full chart-gradient-${tokenByKey[row.key] ?? 2}`}
                    style={{
                      width: `${share * 100}%`,
                      // While active the bar carries the accent outright;
                      // the inline background overrides the token gradient.
                      background: active ? "var(--brand-accent)" : undefined,
                    }}
                  />
                </div>
              )}
            </ChartTooltip>
          </li>
        );
      })}
    </ul>
  );
}
