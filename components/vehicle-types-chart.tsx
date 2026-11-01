import { snapshot, formatNumber, formatPercent } from "@/data/snapshot";

/**
 * Compact bar chart of the fleet by vehicle type, top six, with the
 * remainder grouped. Pure CSS bars, no client JS.
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
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="presentation"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${share * 100}%`,
                  backgroundColor:
                    index < 6 ? "var(--chart-2)" : "var(--chart-5)",
                }}
                title={`${row.label}: ${formatNumber(row.count)}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
