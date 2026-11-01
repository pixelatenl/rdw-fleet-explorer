import {
  snapshot,
  electricVehicles,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";

const segmentColors: Record<string, string> = {
  bev: "var(--chart-1)",
  "novc-hev": "var(--chart-2)",
  "ovc-hev": "var(--chart-3)",
  fchv: "var(--chart-4)",
};

/**
 * One stacked bar: all vehicles with electric drive, split into
 * battery electric, full hybrid, plug-in hybrid and fuel cell hybrid.
 * Rendered as pure SVG so it stays server-side with zero client JS.
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
          return (
            <div
              key={segment.key}
              title={`${segment.label}: ${formatNumber(segment.count)} (${formatPercent(segment.count / electricVehicles)})`}
              style={{
                width: `${Math.max(width, 0.5)}%`,
                backgroundColor: segmentColors[segment.key] ?? "var(--chart-5)",
              }}
            />
          );
        })}
      </div>
      <figcaption>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{
                  backgroundColor:
                    segmentColors[segment.key] ?? "var(--chart-5)",
                }}
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
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
