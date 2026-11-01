"use client";

import { snapshot, formatNumber, formatPercent } from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

/**
 * Compact bar chart of the fleet by vehicle type, top six, with the
 * remainder grouped. CSS bars with token-derived gradients; the full
 * track is the hover, focus and tap target so every row gets a tooltip
 * even when its bar is very small.
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
    <ul className="flex flex-col gap-2.5">
      {display.map((row, index) => {
        const share = row.count / total;
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
              {(trigger) => (
                <div
                  {...trigger}
                  className="chart-tooltip-trigger h-2.5 w-full overflow-hidden rounded-full bg-muted"
                >
                  <div
                    className={`h-full rounded-full chart-gradient-${index < 6 ? 2 : 5}`}
                    style={{ width: `${share * 100}%` }}
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
