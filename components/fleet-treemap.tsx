"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Fuel, Zap } from "lucide-react";
import {
  snapshot,
  electricVehicles,
  batteryElectric,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";
import { ChartTooltip } from "@/components/ui/chart-tooltip";
import {
  squarifiedTreemap,
  type TreemapInputItem,
} from "@/lib/treemap";

/** Nominal ratio units for the pre-measurement (server) layout, 16:9. */
const REFERENCE_WIDTH = 1600;
const REFERENCE_HEIGHT = 900;
/** The smallest tile (fuel cell hybrid) stays visible at this size. */
const MIN_TILE_PX = 8;
/** Spacing between tiles; each tile is inset by half of this per side. */
const TILE_GAP_PX = 6;
const TILE_INSET_PX = TILE_GAP_PX / 2;
/**
 * Stacked tile heights are proportional, clamped to a per-range minimum:
 * below sm the compact metrics fit in 64px; from sm up the current
 * sizes need a label row plus a full-size count line (75px), so the
 * clamp rises to keep every stacked tile readable.
 */
const MIN_STACK_TILE_PX = 64;
const MIN_STACK_TILE_SM_PX = 80;
/** Nominal total height of the stacked layout before clamping. */
const STACK_TOTAL_PX = 440;
/** Tiles smaller than this in either dimension hide their text layer. */
const MIN_TEXT_WIDTH_PX = 84;
const MIN_TEXT_HEIGHT_PX = 52;
/** Tiles smaller than this in either dimension hide their icon layer. */
const MIN_ICON_WIDTH_PX = 48;
const MIN_ICON_HEIGHT_PX = 40;
/** Energy icon size, in px. */
const ICON_PX = 40;
/**
 * Content rule for the stacked tiles, in px. The label is a 10px line
 * at the inherited 1.5 line height and the rows sit gap-1 apart; the
 * inset and the count line height depend on the range: below sm the
 * count and pill step one size down on a p-1 inset, from sm up the
 * current sizes on a p-2 inset apply.
 */
const LABEL_LINE_PX = 15;
const LABEL_COUNT_GAP_PX = 4;
/** Below-sm metrics: p-1 inset and the stepped-down count lines. */
const COMPACT_TEXT_INSET_PX = 4;
const COMPACT_COUNT_LINE_PX: Record<string, number> = {
  "text-5xl": 48,
  "text-3xl": 36,
  "text-2xl": 32,
  "text-xl": 28,
};
/** From-sm metrics: p-2 inset and the current count lines. */
const CURRENT_TEXT_INSET_PX = 8;
const CURRENT_COUNT_LINE_PX: Record<string, number> = {
  "text-6xl": 60,
  "text-4xl": 40,
  "text-3xl": 36,
  "text-2xl": 32,
};
/**
 * Vertical space the current top-left chip (a 40px icon on p-2,
 * anchored top-2) needs above the text block before the two can share
 * a tile. Only the non-spacious anchor is spelled out: the stack rows
 * short enough to fall under the rule never reach the spacious sizes.
 */
const CURRENT_CHIP_CLEAR_PX = 8 + 56 + 4;
/** Count-up: short delay, then two seconds of slow-to-fast easing. */
const COUNT_UP_DELAY_MS = 300;
const COUNT_UP_MS = 2000;

/** Energy icons a drivetrain carries; see buildTiles for the mapping. */
type IconName = "fuel" | "zap";

interface FleetTile extends TreemapInputItem {
  /** Per-key text color token, chosen for contrast on the tile fill. */
  inkToken: string;
  /** Per-key translucent chip scrim token, the inverse of the ink. */
  chipToken: string;
  /** Per-key icon color token: the tile hue, shaded for contrast. */
  iconToken: string;
  /** Per-tile photo treatment overrides, when the default reads washed out. */
  photoOpacityToken?: string;
  photoContrastToken?: string;
  /** Energy icons shown in the tile's top-left corner. */
  icons: IconName[];
}

/** The five drivetrain tiles, every count derived from the snapshot. */
function buildTiles(): FleetTile[] {
  const withFuelData = snapshot.totals.vehiclesWithFuelData;
  const splitByKey = new Map(
    snapshot.electricSplit.map((entry) => [entry.key, entry]),
  );
  const countOf = (key: string) => splitByKey.get(key)?.count ?? 0;

  return [
    {
      key: "no-electric",
      label: "No electric drive",
      count: withFuelData - electricVehicles,
      colorToken: "var(--fleet-tile-no-electric)",
      inkToken: "var(--fleet-ink-no-electric)",
      chipToken: "var(--fleet-chip-no-electric)",
      iconToken: "var(--fleet-icon-no-electric)",
      icons: ["fuel"],
      photoOpacityToken: "var(--fleet-photo-opacity-no-electric)",
      photoContrastToken: "var(--fleet-photo-contrast-no-electric)",
      image: "/images/gas-station-onno-blaauw.jpg",
    },
    {
      key: "bev",
      label: "Battery electric",
      count: countOf("bev"),
      colorToken: "var(--drivetrain-bev)",
      inkToken: "var(--fleet-ink-bev)",
      chipToken: "var(--fleet-chip-bev)",
      iconToken: "var(--fleet-icon-bev)",
      icons: ["zap"],
      image: "/images/ev-charging-chuttersnap.jpg",
    },
    {
      key: "novc-hev",
      label: "Full hybrid",
      count: countOf("novc-hev"),
      colorToken: "var(--drivetrain-hev)",
      inkToken: "var(--fleet-ink-novc-hev)",
      chipToken: "var(--fleet-chip-novc-hev)",
      iconToken: "var(--fleet-icon-novc-hev)",
      icons: ["fuel"],
      image: "/images/hybrid-car-ivan-kazlouskij.jpg",
    },
    {
      key: "ovc-hev",
      label: "Plug-in hybrid",
      count: countOf("ovc-hev"),
      colorToken: "var(--drivetrain-phev)",
      inkToken: "var(--fleet-ink-ovc-hev)",
      chipToken: "var(--fleet-chip-ovc-hev)",
      iconToken: "var(--fleet-icon-ovc-hev)",
      icons: ["fuel", "zap"],
      image: "/images/phev-suv-haberdoedas.jpg",
    },
    {
      key: "fchv",
      label: "Fuel cell hybrid",
      count: countOf("fchv"),
      colorToken: "var(--drivetrain-fchv)",
      inkToken: "var(--fleet-ink-fchv)",
      chipToken: "var(--fleet-chip-fchv)",
      iconToken: "var(--fleet-icon-fchv)",
      icons: ["zap"],
    },
  ];
}

/** Count typography scales with the tile's share of the fleet, not by key. */
function countSizeClass(share: number): string {
  if (share > 0.5) return "text-6xl";
  if (share > 0.07) return "text-4xl";
  if (share > 0.05) return "text-3xl";
  return "text-2xl";
}

/**
 * One step below countSizeClass, for the below-sm stack: the count and
 * the share pill each drop one size so the shorter stack tiles breathe.
 */
function compactCountSizeClass(share: number): string {
  if (share > 0.5) return "text-5xl";
  if (share > 0.07) return "text-3xl";
  if (share > 0.05) return "text-2xl";
  return "text-xl";
}

/**
 * The fuel cell coverage fact, derived from snapshot.fuelCellByFuel: the
 * total over all recorded fuels plus the hydrogen and petrol entries.
 * Returns null when there is nothing to report, so callers omit the
 * sentence rather than print an undefined value.
 */
function fuelCellCoverageFact(): string | null {
  const fuelCellTotal = snapshot.fuelCellByFuel.reduce(
    (sum, entry) => sum + entry.count,
    0,
  );
  if (fuelCellTotal <= 0) return null;
  const hydrogen = snapshot.fuelCellByFuel.find(
    (entry) => entry.key === "waterstof",
  );
  const petrol = snapshot.fuelCellByFuel.find(
    (entry) => entry.key === "benzine",
  );
  const clauses: string[] = [];
  if (hydrogen) clauses.push(`${formatNumber(hydrogen.count)} list hydrogen`);
  if (petrol) clauses.push(`${formatNumber(petrol.count)} list petrol`);
  if (clauses.length === 0) return null;
  return `Across all ${formatNumber(fuelCellTotal)} fuel cell vehicles, ${clauses.join(" and ")} as a fuel.`;
}

/**
 * Context sentence for a tile's tooltip, derived from the snapshot at
 * render time. Returns null when the tile has nothing beyond its own
 * figures.
 */
function tileContext(tile: {
  key: string;
  label: string;
  count: number;
}): string | null {
  if (tile.key === "fchv") {
    return fuelCellCoverageFact();
  }
  if (tile.key === "no-electric") {
    return null;
  }
  return `${formatPercent(tile.count / electricVehicles)} of the ${formatNumber(electricVehicles)} vehicles with electric drive.`;
}

/**
 * Squarified treemap of the Dutch fleet by drivetrain, covering every
 * vehicle with fuel data. Tiles are positioned by the pure squarify
 * function in src/lib/treemap.ts: percentage coordinates from nominal
 * ratio units until the container is measured, exact pixels once the
 * ResizeObserver fires. Below the xl viewport the layout becomes a
 * vertical stack of full-width tiles in descending order; below sm
 * those stacked tiles switch to compact metrics, and a content rule
 * degrades any tile too short for its content instead of letting it
 * collide. Missing photos degrade to a color-only tile, since the
 * image is a plain CSS background layer.
 *
 * Hovering or keyboard-focusing a tile opens the shared cursor tooltip
 * with the tile's figures and its context sentence. Each tile carries
 * its energy icons (fuel, electric, or both)
 * in its top-left corner on wide layouts, hidden when the tile is too
 * small for them; in the below-sm stack the chip shrinks to 28px and
 * moves to the top-right, out of the text column, so the short stack
 * tiles keep their full content without the chip colliding with the
 * label or count.
 */
export function FleetTreemap() {
  const withFuelData = snapshot.totals.vehiclesWithFuelData;
  const noElectricCount = withFuelData - electricVehicles;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  // Starts at 1 so the server-rendered and first client render show the
  // final counts; the count-up below animates it once on first view.
  const [countProgress, setCountProgress] = useState(1);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // The stack spans everything below xl, and its tile metrics differ
  // between below-sm phones and the sm-to-xl range, so the component
  // tracks both breakpoints itself; media queries keep the switches
  // exactly aligned with the responsive classes. Both start at the
  // wide-layout values so the unmeasured server paint matches the
  // current desktop rendering, and the values only matter once the
  // ResizeObserver has fired.
  const [isSm, setIsSm] = useState(true);
  const [isXl, setIsXl] = useState(true);
  useEffect(() => {
    const smQuery = window.matchMedia("(min-width: 40rem)");
    const xlQuery = window.matchMedia("(min-width: 80rem)");
    const update = () => {
      setIsSm(smQuery.matches);
      setIsXl(xlQuery.matches);
    };
    update();
    smQuery.addEventListener("change", update);
    xlQuery.addEventListener("change", update);
    return () => {
      smQuery.removeEventListener("change", update);
      xlQuery.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    // Animate the counts from 0 once, unless the user prefers reduced
    // motion; re-renders (hover, focus, resize) never retrigger it.
    // Cubic ease-in: the first second covers only ~12% of the range, so
    // the count creeps, then races to its final value at two seconds.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const start = performance.now() + COUNT_UP_DELAY_MS;
    setCountProgress(0);
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(elapsed / COUNT_UP_MS, 1);
      setCountProgress(t * t * t);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const measured = size !== null;
  // Stacked below xl, horizontal aspect-[16/9] from xl up; the wide
  // layout and its tile rendering stay untouched there.
  const stack = measured && !isXl;
  const tiles = buildTiles();
  const rects = squarifiedTreemap(
    tiles,
    measured ? size.width : REFERENCE_WIDTH,
    measured ? size.height : REFERENCE_HEIGHT,
  );

  const summary = `Fleet by drivetrain: of ${formatNumber(withFuelData)} vehicles with fuel data, ${formatNumber(noElectricCount)} (${formatPercent(noElectricCount / withFuelData)}) have no electric drive and ${formatNumber(batteryElectric)} (${formatPercent(batteryElectric / withFuelData)}) are battery electric.`;

  return (
    <figure>
      <figcaption className="mb-3">
        <span className="block text-lg font-semibold text-primary dark:text-white">
          Vehicles by drivetrain, sized by count, of the{" "}
          {formatNumber(withFuelData)} with fuel data.
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">
          Hybrid drivetrains are grouped by their recorded hybrid class.
        </span>
      </figcaption>
      <div
        ref={containerRef}
        role="img"
        aria-label={summary}
        className={`relative w-full${
          stack
            ? // Flow layout: tiles carry their own rounded corners and
              // must not be clipped by the container, so no rounding or
              // overflow clipping here.
              " flex flex-col gap-1.5"
            : // Absolute layout, measured at xl and up: tiles sit 3px
              // inset with a 12px radius, so the clip radius must clear
              // their corner arcs (which reach ~13.4px); 16px gives
              // comfortable margin. The 4/5 base covers the unmeasured
              // below-xl paint, closer to the stack that follows.
              " overflow-hidden rounded-2xl aspect-[4/5] xl:aspect-[16/9]"
        }`}
      >
        {rects.map((rect) => {
          const share = rect.count / withFuelData;
          const context = tileContext(rect);
          const compact = stack && !isSm;
          const stackHeight = Math.max(
            compact ? MIN_STACK_TILE_PX : MIN_STACK_TILE_SM_PX,
            share * STACK_TOTAL_PX,
          );
          const textWidth = stack ? (size?.width ?? 0) : rect.width - TILE_GAP_PX;
          const textHeight = stack
            ? stackHeight
            : rect.height - TILE_GAP_PX;
          const showText =
            textWidth >= MIN_TEXT_WIDTH_PX && textHeight >= MIN_TEXT_HEIGHT_PX;
          const showIcons =
            textWidth >= MIN_ICON_WIDTH_PX && textHeight >= MIN_ICON_HEIGHT_PX;
          const spacious = textHeight >= 128;
          const gradientHeight = spacious
            ? "50%"
            : textHeight >= 80
              ? "70%"
              : "100%";

          /*
            Responsive tile treatment, via sm: pairs so the wide layout
            is untouched. Below sm the chip shrinks to 28px at the
            top-right, opposite the bottom-anchored text column, the
            count and pill step one size down, and the text inset
            tightens to p-1; from sm up every value is the current one.
          */
          const compactCountClass = compactCountSizeClass(share);
          const countClass = `${compactCountClass} sm:${countSizeClass(share)}`;
          const pillClass = "text-xs sm:text-sm";
          const chipPadClass = "p-1 sm:p-2";
          const iconSizeClass = "h-5 w-5 sm:h-10 sm:w-10";
          const chipPositionClass = spacious
            ? "top-3 right-3 sm:top-4 sm:left-4 sm:right-auto"
            : "top-2 right-2 sm:left-2 sm:right-auto";
          const textPadClass = spacious ? "p-3 sm:p-4" : "p-1 sm:p-2";

          /*
            Content rule for the stacked tiles, measured with the
            layout math: a tile keeps its full content while its height
            covers the label-and-count block, and — from sm up, where
            the chip returns to the top-left — while that block also
            clears the chip. Tiles that fall short drop the chip and
            the pill first (the label and count remain), then the
            count, so nothing ever collides or overflows. The compact
            thresholds are calibrated so the no-electric, battery
            electric, and full hybrid tiles keep their full content at
            a 390px viewport.
          */
          const countLinePx = compact
            ? (COMPACT_COUNT_LINE_PX[compactCountClass] ?? 28)
            : (CURRENT_COUNT_LINE_PX[countSizeClass(share)] ?? 32);
          const insetPx = compact
            ? COMPACT_TEXT_INSET_PX
            : CURRENT_TEXT_INSET_PX;
          const textBlockPx =
            insetPx + LABEL_LINE_PX + LABEL_COUNT_GAP_PX + countLinePx;
          const labelCountMinPx = textBlockPx + insetPx;
          const fullContentMinPx = compact
            ? labelCountMinPx
            : textBlockPx + CURRENT_CHIP_CLEAR_PX;
          const fitsFullContent = !stack || stackHeight >= fullContentMinPx;
          const fitsLabelCount = !stack || stackHeight >= labelCountMinPx;
          const showChip = showIcons && fitsFullContent;
          const showPill = fitsFullContent;
          const showCount = showText && fitsLabelCount;

          const positionStyle: CSSProperties = stack
            ? { height: stackHeight, minHeight: MIN_TILE_PX }
            : measured
              ? {
                  left: rect.x + TILE_INSET_PX,
                  top: rect.y + TILE_INSET_PX,
                  width: Math.max(rect.width - TILE_GAP_PX, MIN_TILE_PX),
                  height: Math.max(rect.height - TILE_GAP_PX, MIN_TILE_PX),
                }
              : {
                  left: `calc(${(rect.x / REFERENCE_WIDTH) * 100}% + ${TILE_INSET_PX}px)`,
                  top: `calc(${(rect.y / REFERENCE_HEIGHT) * 100}% + ${TILE_INSET_PX}px)`,
                  width: `calc(${(rect.width / REFERENCE_WIDTH) * 100}% - ${TILE_GAP_PX}px)`,
                  height: `calc(${(rect.height / REFERENCE_HEIGHT) * 100}% - ${TILE_GAP_PX}px)`,
                  minWidth: MIN_TILE_PX,
                  minHeight: MIN_TILE_PX,
                };

          const tileStyle = {
            ...positionStyle,
            "--fleet-tile-ink": rect.inkToken,
            "--fleet-chip": rect.chipToken,
            "--fleet-icon": rect.iconToken,
            ...(rect.photoOpacityToken
              ? { "--fleet-photo-opacity": rect.photoOpacityToken }
              : {}),
            ...(rect.photoContrastToken
              ? { "--fleet-photo-contrast": rect.photoContrastToken }
              : {}),
          } as CSSProperties;

          return (
            <ChartTooltip
              key={rect.key}
              label={rect.label}
              value={formatNumber(rect.count)}
              percent={formatPercent(share)}
              value2={context ?? undefined}
            >
              {(trigger) => (
                <div
                  {...trigger}
                  className={`chart-tooltip-trigger fleet-tile overflow-hidden${
                    stack ? " relative w-full" : " absolute"
                  }`}
                  style={tileStyle}
                >
                  <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{ backgroundColor: rect.colorToken }}
                  />
                  {rect.image ? (
                    <div
                      aria-hidden="true"
                      className="fleet-photo absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url("${rect.image}")` }}
                    />
                  ) : null}
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0"
                    style={{
                      height: gradientHeight,
                      background: `linear-gradient(to top, color-mix(in oklab, ${rect.colorToken} 90%, transparent), transparent)`,
                    }}
                  />
                  {showChip ? (
                    <div
                      aria-hidden="true"
                      className={`absolute flex items-center gap-1 rounded-full ${chipPadClass} ${chipPositionClass}`}
                      style={{
                        color: "var(--fleet-icon)",
                        backgroundColor: "var(--fleet-icon-chip)",
                      }}
                    >
                      {(rect.icons ?? []).map((icon) =>
                        icon === "fuel" ? (
                          <Fuel
                            key="fuel"
                            size={ICON_PX}
                            className={`fleet-icon-fuel ${iconSizeClass}`}
                          />
                        ) : (
                          <Zap key="zap" size={ICON_PX} className={iconSizeClass} />
                        ),
                      )}
                    </div>
                  ) : null}
                  {showText ? (
                    <div
                      className={`relative flex h-full flex-col justify-end gap-1 ${textPadClass}`}
                      style={{ color: "var(--fleet-tile-ink)" }}
                    >
                      <p
                        className="text-[10px] font-semibold tracking-widest uppercase"
                        style={{
                          color:
                            "color-mix(in oklab, var(--fleet-tile-ink) 80%, transparent)",
                        }}
                      >
                        {rect.label}
                      </p>
                      {showCount ? (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p
                            className={`font-bold tabular-nums ${countClass}`}
                          >
                            {formatNumber(Math.round(rect.count * countProgress))}
                          </p>
                          {showPill ? (
                            <span
                              className={`rounded-full px-2 py-0.5 font-medium tabular-nums ${pillClass}`}
                              style={{ backgroundColor: "var(--fleet-chip)" }}
                            >
                              {formatPercent(share)}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </ChartTooltip>
          );
        })}
      </div>
    </figure>
  );
}
