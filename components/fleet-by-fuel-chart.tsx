"use client";

import {
  snapshot,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";

/** Chart token index used for each fuel category, matching the legend colors. */
const tokenByKey: Record<string, number> = {
  petrol: 3,
  diesel: 4,
  "battery-electric": 1,
  "full-hybrid": 5,
  "plug-in-hybrid": 2,
  lpg: 5,
  other: 2,
};

/**
 * Horizontal bar chart of the fleet by fuel. Every vehicle with fuel
 * data counts once, in exactly one mutually exclusive category, and
 * every share is a share of the vehicles with fuel data. CSS bars
 * with token-derived gradients; every figure is printed beside its
 * bar, and hovering a row highlights its bar with the brand accent.
 */
export function FleetByFuelChart() {
  const withFuelData = snapshot.totals.vehiclesWithFuelData;
  const rows = [...snapshot.fleetByFuel]
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.count - a.count);

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => {
        const share = row.count / withFuelData;
        return (
          <li key={row.key} className="group text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium tabular-nums">
                {formatNumber(row.count)}
                <span className="ml-2 text-muted-foreground tabular-nums">
                  {formatPercent(share)}
                </span>
              </span>
            </div>
            <div className="h-3.5 w-full overflow-hidden rounded-full bg-[var(--chart-track)]">
              <div
                className={`h-full rounded-full chart-gradient-${tokenByKey[row.key] ?? 2} group-hover:[background:var(--brand-accent)]`}
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
