"use client";

import { snapshot, formatNumber, formatPercent } from "@/data/snapshot";

/**
 * Compact bar chart of the fleet by vehicle type, top six, with the
 * remainder grouped. CSS bars with token-derived gradients; every
 * figure is printed beside its bar, and hovering a row highlights
 * its bar with the brand accent.
 */
export function VehicleTypesChart() {
  const rows = [...snapshot.vehicleTypes].sort((a, b) => b.count - a.count);
  const restCount = rows.slice(6).reduce((sum, row) => sum + row.count, 0);
  const display = [
    ...rows.slice(0, 6).map((row) => ({ ...row })),
    { key: "rest", label: "Other types", count: restCount },
  ];
  const total = snapshot.totals.vehicles;

  return (
    <ul className="flex flex-col gap-3">
      {display.map((row, index) => {
        const share = row.count / total;
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
                className={`h-full rounded-full chart-gradient-${index < 6 ? 2 : 5} group-hover:[background:var(--brand-accent)]`}
                style={{ width: `${share * 100}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
