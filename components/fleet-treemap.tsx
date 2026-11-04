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
/** Tiles smaller than this in either dimension hide their text layer;
 *  72 admits the plug-in hybrid tile at a 390px viewport inside the
 *  card frame, with a count fitted down to it. */
const MIN_TEXT_WIDTH_PX = 72;
const MIN_TEXT_HEIGHT_PX = 52;
/** Tiles smaller than this in either dimension hide their icon layer. */
const MIN_ICON_WIDTH_PX = 48;
const MIN_ICON_HEIGHT_PX = 40;
/** Energy icon size, in px. */
const ICON_PX = 40;
/**
 * Count typography. A count's font size is bounded by its share tier,
 * exactly the classes the wide layout always used, but a count that
 * would then run wider than its tile shrinks to fit it — the squarify
 * layout puts narrow tiles side by side, so counts must respect the
 * tile's actual width instead of clipping the number's tail. Below sm
 * the text inset is p-1 and from sm p-2, both at most 8px per side;
 * the only tile that is narrow and spacious (the no-electric mass on
 * a phone, p-3) budgets a full 24px. Tier line heights come from the
 * Tailwind classes; fitted counts render at a 1.3 line ratio.
 */
const COUNT_TIER_PX: Record<string, number> = {
  "text-6xl": 60,
  "text-4xl": 36,
  "text-3xl": 30,
  "text-2xl": 24,
};
const COUNT_TIER_LINE_PX: Record<string, number> = {
  "text-6xl": 60,
  "text-4xl": 40,
  "text-3xl": 36,
  "text-2xl": 32,
};
/**
 * Rough tabular-digit width of a count at black weight with its
 *  custom tight tracking (-0.07em) subtracted, in em: digits wide,
 *  dots narrow. The measure stays above the rendered width, keeping
 *  the no-clipping guarantee while fitted counts earn pixels back.
 */
const COUNT_DIGIT_EM = 0.57;
const COUNT_SEPARATOR_EM = 0.36;
/** Per-side horizontal room a fitted count keeps inside its tile. */
const COUNT_INSET_PX = 8;
const SPACIOUS_COUNT_INSET_PX = 12;
/** Fitted line ratio, between the tier classes' own ratios. */
const FITTED_COUNT_LINE_RATIO = 1.3;
/** Smallest fitted count, in px, whatever the geometry says. */
const MIN_FITTED_COUNT_PX = 12;
/**
 * The share pill renders only when the tile is tall enough to stack
 * label, count and wrapped pill without crowding; below this the
 * percentage stays in the tooltip and the summary aria-label.
 */
const MIN_PILL_TILE_HEIGHT_PX = 100;
/**
 * The icon chip renders only when the tile is tall enough for the
 * chip block (its anchor offset plus the chip and a margin) above
 * the bottom-anchored text block, so the two can share a tile.
 */
const CHIP_CLEAR_PX = 8 + 56 + 4;
/**
 * Adaptive canvas anchors. The squarified layout runs at every width,
 * so the container's aspect ratio interpolates linearly between these
 * instead of dropping to a stacked wrap below the wide breakpoint: at
 * the wide anchor the canvas keeps the wide 16:9, and as the viewport
 * narrows the canvas grows taller, reaching 1.2 — square plus a step,
 * so the squarified layout lays the four electrified tiles side by
 * side in a strip tall enough for their labels and fitted counts — at
 * the narrow anchor, and holding there below it. Both anchors are
 * content-box widths of this figure in its card frame — the page
 * container carries px-4 below sm and px-6 from sm up, the card adds
 * its 2px border and the CardContent padding px-4 below sm and px-6
 * from sm — so 926 is the canvas at the 1024px viewport and 324 the
 * canvas at a 390px viewport, inside the card.
 */
const CANVAS_VIDEO_WIDTH_PX = 926;
const CANVAS_SQUARE_WIDTH_PX = 324;
/** The wide aspect ratio at and above the wide anchor. */
const CANVAS_ASPECT_VIDEO = 9 / 16;
/** The narrow aspect ratio at and below the narrow anchor. */
const CANVAS_ASPECT_NARROW = 1.2;

/**
 * Height-to-width ratio for a measured canvas width: 16:9 at and above
 * the wide anchor, square at and below the narrow anchor, linearly
 * interpolated between, so crossing either anchor is continuous and
 * no width ever jumps the layout.
 */
function adaptiveCanvasAspect(canvasWidth: number): number {
  if (canvasWidth >= CANVAS_VIDEO_WIDTH_PX) return CANVAS_ASPECT_VIDEO;
  if (canvasWidth <= CANVAS_SQUARE_WIDTH_PX) return CANVAS_ASPECT_NARROW;
  const step =
    (CANVAS_VIDEO_WIDTH_PX - canvasWidth) /
    (CANVAS_VIDEO_WIDTH_PX - CANVAS_SQUARE_WIDTH_PX);
  return (
    CANVAS_ASPECT_VIDEO +
    step * (CANVAS_ASPECT_NARROW - CANVAS_ASPECT_VIDEO)
  );
}
/** Count-up: short delay, then two seconds of slow-to-fast easing. */
const COUNT_UP_DELAY_MS = 300;
const COUNT_UP_MS = 2000;

/** Energy icons a drivetrain carries; see buildTiles for the mapping. */
type IconName = "fuel" | "zap";

interface FleetTile extends TreemapInputItem {
  /**
   * Per-key categorical text ink, chip scrim and icon shade, each
   * chosen for contrast on the categorical fill above. On
   * hover-capable devices the fill is a hover/focus reveal — at rest
   * every tile but battery electric takes the neutral no-electric
   * treatment instead, per the focus treatment in app/globals.css —
   * while hover-less devices keep the categorical set at all times.
   */
  inkToken: string;
  chipToken: string;
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
 * Fitted count style for a tile whose share-tier count would run wider
 * than the tile: the font shrinks until the full formatted number fits,
 * with a line height in the same band as the tier classes. Returns
 * undefined when the tier already fits, so the wide layout keeps the
 * tier class untouched.
 */
function fittedCountStyle(
  formattedCount: string,
  tierPx: number,
  countWidthPx: number,
): CSSProperties | undefined {
  const digits = [...formattedCount].filter((c) => c >= "0" && c <= "9")
    .length;
  const separators = formattedCount.length - digits;
  const emWidth = digits * COUNT_DIGIT_EM + separators * COUNT_SEPARATOR_EM;
  const fitPx = countWidthPx / emWidth;
  if (fitPx >= tierPx) return undefined;
  const fontPx = Math.max(MIN_FITTED_COUNT_PX, Math.floor(fitPx));
  return {
    fontSize: fontPx,
    lineHeight: `${Math.round(fontPx * FITTED_COUNT_LINE_RATIO)}px`,
  };
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
 * ResizeObserver fires. The canvas is adaptive rather than wrapped:
 * the squarified layout runs at every width, and the container's
 * aspect ratio grows continuously from the wide 16:9 at the old wrap
 * breakpoint to 1.2 — square plus a step, tall enough for the
 * electrified tiles' labels and counts in the squarified strip — at a
 * 390px viewport, all computed from the measured container width, so
 * tiles stay side by side and no width rearranges them abruptly.
 * Every value stays readable and unclipped: a count shrinks to its
 * tile's actual width instead of running past it, the share pill and
 * the icon chip drop only when the tile is too short to stack them
 * with the text, and a tile too small for text hides the layer
 * entirely — its tooltip and the figure's summary aria-label always
 * identify every category. Missing photos degrade to a color-only
 * tile, since the image is a plain CSS background layer.
 *
 * Hovering or keyboard-focusing a tile opens the shared cursor tooltip
 * with the tile's figures and its context sentence. At rest the
 * composition has one focal point: battery electric is electric and
 * everything else — hybrids included — runs on fuel, so on
 * hover-capable devices every tile but battery electric rests in the
 * neutral no-electric treatment and reveals its categorical hue on
 * hover or keyboard focus, while hover-less devices keep the full
 * categorical palette. The focus treatment lives in app/globals.css,
 * pure CSS media queries with no JavaScript device detection. Each
 * tile carries
 * its energy icons (fuel, electric, or both)
 * in its top-left corner, hidden when the tile is too small for them;
 * below sm the chip shrinks to 28px and moves to the top-right of
 * non-spacious tiles, opposite the bottom-anchored text column, and
 * the count and pill step one size down, so the tighter canvases keep
 * their full content without the chip colliding with the label or
 * count.
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
  // Adaptive canvas: with a width measured, the height is derived from
  // it and set inline, so the aspect grows smoothly as the viewport
  // narrows. Unmeasured, the container keeps the CSS aspect-video
  // fallback, which matches the nominal 16:9 of the server-painted
  // percentage layout; the measured height takes over as soon as the
  // ResizeObserver fires.
  const canvasHeight = measured
    ? Math.round(size.width * adaptiveCanvasAspect(size.width))
    : null;
  const tiles = buildTiles();
  const rects = squarifiedTreemap(
    tiles,
    measured ? size.width : REFERENCE_WIDTH,
    measured ? (canvasHeight as number) : REFERENCE_HEIGHT,
  );

  const summary = `Fleet by drivetrain: of ${formatNumber(withFuelData)} vehicles with fuel data, ${formatNumber(noElectricCount)} (${formatPercent(noElectricCount / withFuelData)}) have no electric drive and ${formatNumber(batteryElectric)} (${formatPercent(batteryElectric / withFuelData)}) are battery electric.`;

  return (
    <figure>
      <figcaption className="mb-3">
        <span className="block text-2xl font-extrabold leading-tight tracking-tight text-primary sm:text-3xl dark:text-white">
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
        // Absolute layout at every width. Tiles sit 3px inset with a
        // 12px radius, so the clip radius must clear their corner arcs
        // (which reach ~13.4px); 16px gives comfortable margin. The
        // aspect-video class is the unmeasured server fallback — the
        // nominal 16:9 of the percentage layout below — and the
        // measured inline height replaces it once the ResizeObserver
        // fires.
        className="relative w-full overflow-hidden rounded-2xl aspect-video"
        style={canvasHeight ? { height: canvasHeight } : undefined}
      >
        {rects.map((rect) => {
          const share = rect.count / withFuelData;
          const context = tileContext(rect);
          const formattedCount = formatNumber(rect.count);
          const textWidth = rect.width - TILE_GAP_PX;
          const textHeight = rect.height - TILE_GAP_PX;
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
            Count fit: the share tier bounds the count, then the fitted
            style shrinks it into the tile's actual width — clip-proof
            from a 390px viewport up, invisible on the wide layout
            where the tier always fits. The pill renders only when the
            tile is tall enough for label, count and wrapped pill; the
            chip only when its block clears the bottom-anchored text
            above it.
          */
          const tierClass = countSizeClass(share);
          const tierPx = COUNT_TIER_PX[tierClass];
          const countStyle = fittedCountStyle(
            formattedCount,
            tierPx,
            textWidth - 2 * (spacious ? SPACIOUS_COUNT_INSET_PX : COUNT_INSET_PX),
          );
          const countLinePx = Number(
            countStyle?.fontSize ?? COUNT_TIER_LINE_PX[tierClass],
          );
          const labelCountPx = 2 * COUNT_INSET_PX + 15 + 4 + countLinePx;
          const showPill = showText && textHeight >= MIN_PILL_TILE_HEIGHT_PX;
          const showChip =
            showIcons &&
            showText &&
            textHeight >= CHIP_CLEAR_PX + labelCountPx;

          /*
            Responsive tile treatment, via sm: pairs: below sm the chip
            shrinks to 28px at the top-right of non-spacious tiles,
            opposite the bottom-anchored text column, the pill steps
            one size down, and the text inset tightens to p-1; from sm
            up every value is the current one. The count carries its
            own fit style, so it keeps a single tier class.
          */
          const pillClass = "text-xs sm:text-sm";
          const chipPadClass = "p-1 sm:p-2";
          const iconSizeClass = "h-5 w-5 sm:h-10 sm:w-10";
          const chipPositionClass = spacious
            ? "top-3 right-3 sm:top-4 sm:left-4 sm:right-auto"
            : "top-2 right-2 sm:left-2 sm:right-auto";
          const textPadClass = spacious ? "p-3 sm:p-4" : "p-1 sm:p-2";

          const positionStyle: CSSProperties = measured
            ? {
                // The clamp keeps a min-size tile inside the canvas
                // when the squarify geometry parks its sub-pixel strip
                // past the right or bottom edge — the fuel cell share
                // is honest, but its tile must stay visible and
                // focusable.
                left: Math.min(rect.x, size.width - MIN_TILE_PX - 2 * TILE_INSET_PX),
                top: Math.min(rect.y, (canvasHeight as number) - MIN_TILE_PX - 2 * TILE_INSET_PX),
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
            // Per-key categorical tokens; the focus treatment in
            // app/globals.css resolves the live fill, ink, chip and
            // icon per state (neutral at rest, categorical on hover).
            "--fleet-tile-category": rect.colorToken,
            "--fleet-ink-category": rect.inkToken,
            "--fleet-chip-category": rect.chipToken,
            "--fleet-icon-category": rect.iconToken,
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
                  className={`chart-tooltip-trigger fleet-tile overflow-hidden absolute${
                    // Battery electric is the focal point: it never
                    // drops to the neutral rest treatment.
                    rect.key === "bev" ? " fleet-tile-focus" : ""
                  }`}
                  style={tileStyle}
                >
                  <div
                    aria-hidden="true"
                    className="fleet-tile-fill absolute inset-0"
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
                    className="fleet-tile-readability absolute inset-x-0 bottom-0"
                    style={{ height: gradientHeight }}
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
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <p
                          className={`font-black tracking-[-0.07em] tabular-nums ${tierClass}`}
                          style={countStyle}
                        >
                          {formatNumber(
                            Math.round(rect.count * countProgress),
                          )}
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
