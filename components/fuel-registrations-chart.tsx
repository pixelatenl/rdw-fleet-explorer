import {
  snapshot,
  fuelRegistrationsTotal,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";

const colorByKey: Record<string, string> = {
  benzine: "var(--chart-3)",
  elektriciteit: "var(--chart-1)",
  diesel: "var(--chart-4)",
  lpg: "var(--chart-5)",
  other: "var(--chart-2)",
};

/**
 * Horizontal bar chart of fuel registrations in the RDW register.
 * Multi-fuel vehicles (hybrids) count once per fuel, which is stated
 * in the card copy. Pure CSS bars, no client JS.
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
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
              role="presentation"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${share * 100}%`,
                  backgroundColor:
                    colorByKey[row.key] ?? "var(--chart-2)",
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
