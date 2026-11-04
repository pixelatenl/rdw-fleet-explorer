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
/** Tiles smaller than this in either dimension hide their text layer. */
const MIN_TEXT_WIDTH_PX = 84;
const MIN_TEXT_HEIGHT_PX = 52;
/** Tiles smaller than this in either dimension hide their icon layer. */
const MIN_ICON_WIDTH_PX = 48;
const MIN_ICON_HEIGHT_PX = 40;
/** Energy icon size, in px. */
const ICON_PX = 40;
/**
 * Adaptive canvas anchors. The squarified layout runs at every width,
 * so the container's aspect ratio interpolates linearly between these
 * instead of dropping to a stacked wrap below the wide breakpoint: at
 * the wide anchor the canvas keeps the wide 16:9, and as the viewport
 * narrows the canvas grows taller, reaching square at the narrow
 * anchor and staying square below it. Both anchors are content-box
 * widths of this figure — the page container carries px-4 below sm
 * and px-6 from sm up — so 976 is the canvas at the 1024px viewport
 * where the old wrap used to start, and 358 the canvas at a 390px
 * viewport.
 */
const CANVAS_VIDEO_WIDTH_PX = 976;
const CANVAS_SQUARE_WIDTH_PX = 358;
/** The wide aspect ratio at and above the wide anchor. */
const CANVAS_ASPECT_VIDEO = 9 / 16;
/** The narrow aspect ratio at and below the narrow anchor. */
const CANVAS_ASPECT_SQUARE = 1;

/**
 * Height-to-width ratio for a measured canvas width: 16:9 at and above
 * the wide anchor, square at and below the narrow anchor, linearly
 * interpolated between, so crossing either anchor is continuous and
 * no width ever jumps the layout.
 */
function adaptiveCanvasAspect(canvasWidth: number): number {
  if (canvasWidth >= CANVAS_VIDEO_WIDTH_PX) return CANVAS_ASPECT_VIDEO;
  if (canvasWidth <= CANVAS_SQUARE_WIDTH_PX) return CANVAS_ASPECT_SQUARE;
  const step =
    (CANVAS_VIDEO_WIDTH_PX - canvasWidth) /
    (CANVAS_VIDEO_WIDTH_PX - CANVAS_SQUARE_WIDTH_PX);
  return (
    CANVAS_ASPECT_VIDEO +
    step * (CANVAS_ASPECT_SQUARE - CANVAS_ASPECT_VIDEO)
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
 * One step below countSizeClass, for the narrowest canvases: below sm
 * the tiles are tighter, so the count and the share pill each drop
 * one size to breathe.
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
 * ResizeObserver fires. The canvas is adaptive rather than wrapped:
 * the squarified layout runs at every width, and the container's
 * aspect ratio grows continuously from the wide 16:9 at the old wrap
 * breakpoint to square at a 390px viewport — computed from the
 * measured container width, so tiles stay side by side and no width
 * rearranges them abruptly. Tiles too small for their content degrade
 * layer by layer — the icon chip, then the text — instead of
 * truncating or colliding; the tooltip and the figure's summary
 * aria-label always identify every category. Missing photos degrade
 * to a color-only tile, since the image is a plain CSS background
 * layer.
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
            Responsive tile treatment, via sm: pairs: below sm the chip
            shrinks to 28px at the top-right of non-spacious tiles,
            opposite the bottom-anchored text column, the count and
            pill step one size down, and the text inset tightens to
            p-1; from sm up every value is the current one.
          */
          const countClass = `${compactCountSizeClass(share)} sm:${countSizeClass(share)}`;
          const pillClass = "text-xs sm:text-sm";
          const chipPadClass = "p-1 sm:p-2";
          const iconSizeClass = "h-5 w-5 sm:h-10 sm:w-10";
          const chipPositionClass = spacious
            ? "top-3 right-3 sm:top-4 sm:left-4 sm:right-auto"
            : "top-2 right-2 sm:left-2 sm:right-auto";
          const textPadClass = spacious ? "p-3 sm:p-4" : "p-1 sm:p-2";
          const showChip = showIcons;

          const positionStyle: CSSProperties = measured
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
                        <p className={`font-bold tabular-nums ${countClass}`}>
                          {formatNumber(Math.round(rect.count * countProgress))}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium tabular-nums ${pillClass}`}
                          style={{ backgroundColor: "var(--fleet-chip)" }}
                        >
                          {formatPercent(share)}
                        </span>
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
