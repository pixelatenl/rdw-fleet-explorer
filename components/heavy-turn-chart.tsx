"use client";

import { snapshot, formatNumber } from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";

/*
  The heavy turn: two vertically stacked line panels sharing one year
  axis, so a given year lines up in both. The top panel shows the average
  mass in kilograms of each first-admission-year cohort of passenger
  cars, the bottom panel its average engine size in cubic centimetres.
  Pure SVG with chart-token strokes so both themes work without
  JavaScript involvement; hover, focus and tap tooltips come from the
  shared client tooltip component, one trigger per cohort point.
*/

const WIDTH = 720;
const PAD_X = 14;
const PANEL_HEIGHT = 130;
const MASS_TITLE_Y = 12;
const MASS_TOP = 22;
const ENGINE_TITLE_Y = 184;
const ENGINE_TOP = 194;
const LABEL_PAD = 54;
const HEIGHT = 352;
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
  const lastEngine = engineRows[engineRows.length - 1];

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Line chart of the average mass in kilograms and the average engine size in cubic centimetres of passenger cars by year of first admission, from ${firstYear} to ${lastYear}. Mass grows from ${formatNumber(firstMass.avgMass)} kg in ${firstMass.year} to ${formatNumber(lastMass.avgMass)} kg in ${lastMass.year}, while engine size shrinks and both trends bend between 2017 and 2020.`}
      >
        {/* Decade gridlines and year ticks, shared by both panels. */}
        {DECADES.filter((year) => year > firstYear && year < lastYear).map(
          (year) => (
            <g key={year}>
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
              <text
                x={xAxis(year)}
                y={ENGINE_TOP + PANEL_HEIGHT + 18}
                textAnchor="middle"
                fontSize="11"
                style={{ fill: "var(--muted-foreground)" }}
              >
                {year}
              </text>
            </g>
          ),
        )}

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
        />

        {/* Cohort points. The transparent trigger circle carries the
            tooltip interaction; the visible dot sits on top of it. */}
        {massRows.map((row) => (
          <ChartTooltip
            key={`mass-${row.year}`}
            label={String(row.year)}
            value={`${formatNumber(row.avgMass)} kg`}
            percent={`${formatNumber(row.count)} cars`}
          >
            {(trigger) => (
              <g>
                <circle
                  {...trigger}
                  className="chart-tooltip-trigger"
                  cx={xAxis(row.year)}
                  cy={yAxis(massPanel, row.avgMass)}
                  r="10"
                  fill="transparent"
                />
                <circle
                  cx={xAxis(row.year)}
                  cy={yAxis(massPanel, row.avgMass)}
                  r="3"
                  fill="var(--chart-1)"
                />
              </g>
            )}
          </ChartTooltip>
        ))}
        {engineRows.map((row) => (
          <ChartTooltip
            key={`engine-${row.year}`}
            label={String(row.year)}
            value={`${formatNumber(row.avgEngineSize)} cc`}
            percent={`${formatNumber(row.count)} cars`}
          >
            {(trigger) => (
              <g>
                <circle
                  {...trigger}
                  className="chart-tooltip-trigger"
                  cx={xAxis(row.year)}
                  cy={yAxis(enginePanel, row.avgEngineSize)}
                  r="10"
                  fill="transparent"
                />
                <circle
                  cx={xAxis(row.year)}
                  cy={yAxis(enginePanel, row.avgEngineSize)}
                  r="3"
                  fill="var(--chart-2)"
                />
              </g>
            )}
          </ChartTooltip>
        ))}
      </svg>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{firstYear}</span>
        <span>Year of first admission</span>
        <span>{lastEngine ? lastEngine.year : lastYear}</span>
      </figcaption>
    </figure>
  );
}
