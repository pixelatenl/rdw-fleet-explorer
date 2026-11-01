"use client";

import { snapshot, formatNumber } from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

/*
  The heavy turn: two vertically stacked line panels sharing one year
  axis, so a given year lines up in both. The top panel shows the average
  mass in kilograms of each first-admission-year cohort of passenger
  cars, the bottom panel its average engine size in cubic centimetres.
  Pure SVG with chart-token strokes so both themes work without
  JavaScript involvement. Interaction is per year, not per point: one
  transparent strip per cohort spans both panels, so hover, focus and
  tap highlight that year everywhere at once, with one tooltip holding
  both series and a dashed guide line connecting the panels.
*/

const WIDTH = 720;
const PAD_X = 14;
const PANEL_HEIGHT = 130;
const MASS_TITLE_Y = 12;
const MASS_TOP = 34;
const ENGINE_TITLE_Y = 194;
const ENGINE_TOP = 216;
const LABEL_PAD = 54;
const AXIS_Y = ENGINE_TOP + PANEL_HEIGHT;
const TICK_BOTTOM = AXIS_Y + 6;
const TICK_LABEL_Y = AXIS_Y + 18;
const HEIGHT = 374;
const DECADES = [1980, 1990, 2000, 2010, 2020];

interface Panel {
  /** Plot-area top edge. */
  top: number;
  /** Domain padding: the lines never touch the panel edge. */
  lo: number;
  hi: number;
}

function yAxis(panel: Panel, value: number): number {
  const t = (value - panel.lo) / (panel.hi - panel.lo);
  return panel.top + (1 - t) * PANEL_HEIGHT;
}

export function HeavyTurnChart() {
  const massRows = snapshot.massByYear;
  const engineRows = snapshot.engineSizeByYear;

  // Shared x scale from the union of both series, so 2017 lines up in
  // both panels even if a cohort ever exists in only one of them.
  const years = [
    ...new Set([
      ...massRows.map((row) => row.year),
      ...engineRows.map((row) => row.year),
    ]),
  ].sort((a, b) => a - b);
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const xAxis = (year: number) =>
    PAD_X +
    ((year - firstYear) / (lastYear - firstYear)) * (WIDTH - 2 * PAD_X);

  // Axis labels at a regular cadence including both endpoints; the
  // endpoint labels anchor outward so they stay inside the viewBox.
  const labeledYears = [
    { year: firstYear, anchor: "start" as const },
    ...DECADES.filter((year) => year > firstYear && year < lastYear).map(
      (year) => ({ year, anchor: "middle" as const }),
    ),
    { year: lastYear, anchor: "end" as const },
  ];

  function panelFor(values: number[], top: number): Panel {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = (max - min || 1) * 0.08;
    return { top, lo: min - spread, hi: max + spread };
  }

  const massPanel = panelFor(
    massRows.map((row) => row.avgMass),
    MASS_TOP,
  );
  const enginePanel = panelFor(
    engineRows.map((row) => row.avgEngineSize),
    ENGINE_TOP,
  );

  const massPoints = massRows
    .map((row) => `${xAxis(row.year)},${yAxis(massPanel, row.avgMass)}`)
    .join(" ");
  const enginePoints = engineRows
    .map((row) => `${xAxis(row.year)},${yAxis(enginePanel, row.avgEngineSize)}`)
    .join(" ");

  const firstMass = massRows[0];
  const lastMass = massRows[massRows.length - 1];

  const massByYear = new Map(massRows.map((row) => [row.year, row]));
  const engineByYear = new Map(engineRows.map((row) => [row.year, row]));

  // One interaction strip per cohort year, spanning both panels. Each
  // strip reaches from the midpoint between the neighbouring years to
  // the other; the first and last years extend to the plot edges. The
  // DOM order is chronological, so keyboard focus walks the years in
  // order.
  const strips = years.map((year, index) => {
    const cx = xAxis(year);
    const left =
      index === 0 ? PAD_X : (xAxis(years[index - 1]) + cx) / 2;
    const right =
      index === years.length - 1
        ? WIDTH - PAD_X
        : (xAxis(years[index + 1]) + cx) / 2;
    return { year, cx, x: left, width: right - left };
  });

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Line chart of the average mass in kilograms and the average engine size in cubic centimetres of passenger cars by year of first admission, from ${firstYear} to ${lastYear}. Mass grows from ${formatNumber(firstMass.avgMass)} kg in ${firstMass.year} to ${formatNumber(lastMass.avgMass)} kg in ${lastMass.year}, while engine size shrinks and both trends bend between 2017 and 2020.`}
      >
        {/* Decade gridlines across both panels. */}
        {DECADES.filter((year) => year > firstYear && year < lastYear).map(
          (year) => (
            <g key={`grid-${year}`}>
              <line
                x1={xAxis(year)}
                x2={xAxis(year)}
                y1={MASS_TOP}
                y2={MASS_TOP + PANEL_HEIGHT}
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.6"
              />
              <line
                x1={xAxis(year)}
                x2={xAxis(year)}
                y1={ENGINE_TOP}
                y2={ENGINE_TOP + PANEL_HEIGHT}
                stroke="var(--border)"
                strokeWidth="1"
                opacity="0.6"
              />
            </g>
          ),
        )}

        {/* Year axis along the bottom edge of the engine panel, with a
            tick and a label at every labeled year including both
            endpoints. The end labels are anchored outward so nothing
            clips at the viewBox edges. */}
        <line
          x1={xAxis(firstYear)}
          x2={xAxis(lastYear)}
          y1={AXIS_Y}
          y2={AXIS_Y}
          stroke="var(--border)"
          strokeWidth="1"
        />
        {labeledYears.map(({ year, anchor }) => (
          <g key={`tick-${year}`}>
            <line
              x1={xAxis(year)}
              x2={xAxis(year)}
              y1={AXIS_Y}
              y2={TICK_BOTTOM}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={xAxis(year)}
              y={TICK_LABEL_Y}
              textAnchor={anchor}
              fontSize="10"
              style={{ fill: "var(--muted-foreground)" }}
            >
              {year}
            </text>
          </g>
        ))}

        {/* Top panel: average mass in kg. */}
        <text
          x="0"
          y={MASS_TITLE_Y}
          fontSize="12"
          fontWeight="500"
          style={{ fill: "var(--muted-foreground)" }}
        >
          Average mass (kg)
        </text>
        {[
          { value: massPanel.hi, y: MASS_TOP },
          { value: massPanel.lo, y: MASS_TOP + PANEL_HEIGHT },
        ].map((line) => (
          <g key={`mass-axis-${line.y}`}>
            <line
              x1={LABEL_PAD}
              x2={WIDTH - 6}
              y1={line.y}
              y2={line.y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x="0"
              y={line.y + 4}
              fontSize="10"
              style={{ fill: "var(--muted-foreground)" }}
            >
              {formatNumber(Math.round(line.value))}
            </text>
          </g>
        ))}
        <polyline
          points={massPoints}
          fill="none"
          stroke="var(--chart-1)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {/* Bottom panel: average engine size in cc. */}
        <text
          x="0"
          y={ENGINE_TITLE_Y}
          fontSize="12"
          fontWeight="500"
          style={{ fill: "var(--muted-foreground)" }}
        >
          Average engine size (cc)
        </text>
        {[
          { value: enginePanel.hi, y: ENGINE_TOP },
          { value: enginePanel.lo, y: ENGINE_TOP + PANEL_HEIGHT },
        ].map((line) => (
          <g key={`engine-axis-${line.y}`}>
            <line
              x1={LABEL_PAD}
              x2={WIDTH - 6}
              y1={line.y}
              y2={line.y}
              stroke="var(--border)"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x="0"
              y={line.y + 4}
              fontSize="10"
              style={{ fill: "var(--muted-foreground)" }}
            >
              {formatNumber(Math.round(line.value))}
            </text>
          </g>
        ))}
        <polyline
          points={enginePoints}
          fill="none"
          stroke="var(--chart-2)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {/* Static cohort dots; the strips own all interaction. */}
        {massRows.map((row) => (
          <circle
            key={`mass-dot-${row.year}`}
            cx={xAxis(row.year)}
            cy={yAxis(massPanel, row.avgMass)}
            r="3"
            fill="var(--chart-1)"
            pointerEvents="none"
          />
        ))}
        {engineRows.map((row) => (
          <circle
            key={`engine-dot-${row.year}`}
            cx={xAxis(row.year)}
            cy={yAxis(enginePanel, row.avgEngineSize)}
            r="3"
            fill="var(--chart-2)"
            pointerEvents="none"
          />
        ))}

        {/* Year strips: one full-height trigger per cohort. While a year
            is active, a dashed guide line connects the panels and that
            year's dots in both panels gain a stroke ring. */}
        {strips.map(({ year, cx, x, width }) => {
          const massRow = massByYear.get(year);
          const engineRow = engineByYear.get(year);
          if (!massRow || !engineRow) return null;
          return (
            <ChartTooltip
              key={`strip-${year}`}
              label={String(year)}
              value={`Average mass ${formatNumber(massRow.avgMass)} kg · ${formatNumber(massRow.count)} cars`}
              value2={`Average engine size ${formatNumber(engineRow.avgEngineSize)} cc · ${formatNumber(engineRow.withEngine ?? 0)} cars with an engine`}
            >
              {(trigger, active) => (
                <g>
                  {active && (
                    <>
                      <line
                        x1={cx}
                        x2={cx}
                        y1={MASS_TOP}
                        y2={AXIS_Y}
                        stroke="var(--border)"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                        pointerEvents="none"
                      />
                      <circle
                        cx={cx}
                        cy={yAxis(massPanel, massRow.avgMass)}
                        r="6"
                        fill="none"
                        stroke="var(--chart-1)"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                      <circle
                        cx={cx}
                        cy={yAxis(enginePanel, engineRow.avgEngineSize)}
                        r="6"
                        fill="none"
                        stroke="var(--chart-2)"
                        strokeWidth="2"
                        pointerEvents="none"
                      />
                    </>
                  )}
                  <rect
                    {...trigger}
                    className="chart-tooltip-trigger"
                    x={x}
                    y={MASS_TOP}
                    width={width}
                    height={AXIS_Y - MASS_TOP}
                    fill="transparent"
                  />
                </g>
              )}
            </ChartTooltip>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        Year of first admission
      </figcaption>
    </figure>
  );
}
