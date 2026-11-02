"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  snapshot,
  electricVehicles,
  batteryElectric,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";
import {
  squarifiedTreemap,
  type TreemapInputItem,
} from "@/lib/treemap";

/** Below this container width the treemap falls back to a vertical stack. */
const MOBILE_BREAKPOINT = 640;
/** Nominal ratio units for the pre-measurement (server) layout, 16:9. */
const REFERENCE_WIDTH = 1600;
const REFERENCE_HEIGHT = 900;
/** The smallest tile (fuel cell hybrid) stays visible at this size. */
const MIN_TILE_PX = 8;
/** Spacing between tiles; each tile is inset by half of this per side. */
const TILE_GAP_PX = 6;
const TILE_INSET_PX = TILE_GAP_PX / 2;
/** Stack-mode tile heights are proportional, clamped to this minimum. */
const MIN_STACK_TILE_PX = 64;
/** Nominal total height of the mobile stack before clamping. */
const STACK_TOTAL_PX = 440;
/** Tiles smaller than this in either dimension hide their text layer. */
const MIN_TEXT_WIDTH_PX = 84;
const MIN_TEXT_HEIGHT_PX = 52;
/** Count-up: short delay, then two seconds of slow-to-fast easing. */
const COUNT_UP_DELAY_MS = 300;
const COUNT_UP_MS = 2000;

interface FleetTile extends TreemapInputItem {
  /** Per-key text color token, chosen for contrast on the tile fill. */
  inkToken: string;
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
      colorToken: "var(--chart-5)",
      inkToken: "var(--fleet-ink-no-electric)",
      image: "/images/gas-station-ali-mkumbwa.jpg",
    },
    {
      key: "bev",
      label: "Battery electric",
      count: countOf("bev"),
      colorToken: "var(--drivetrain-bev)",
      inkToken: "var(--fleet-ink-bev)",
      image: "/images/ev-charging-chuttersnap.jpg",
    },
    {
      key: "novc-hev",
      label: "Full hybrid",
      count: countOf("novc-hev"),
      colorToken: "var(--drivetrain-hev)",
      inkToken: "var(--fleet-ink-novc-hev)",
      image: "/images/hybrid-car-ivan-kazlouskij.jpg",
    },
    {
      key: "ovc-hev",
      label: "Plug-in hybrid",
      count: countOf("ovc-hev"),
      colorToken: "var(--drivetrain-phev)",
      inkToken: "var(--fleet-ink-ovc-hev)",
      image: "/images/hybrid-car-ivan-kazlouskij.jpg",
    },
    {
      key: "fchv",
      label: "Fuel cell hybrid",
      count: countOf("fchv"),
      colorToken: "var(--drivetrain-fchv)",
      inkToken: "var(--fleet-ink-fchv)",
    },
  ];
}

/** Count typography scales with the tile's share of the fleet, not by key. */
function countSizeClass(share: number): string {
  if (share > 0.5) return "text-5xl";
  if (share > 0.07) return "text-3xl";
  if (share > 0.05) return "text-2xl";
  return "text-xl";
}

/**
 * The info strip line for the active tile, with every figure derived
 * from the snapshot. Null renders the neutral default line; the fuel
 * cell tile appends its fuel coverage facts, omitting any clause whose
 * snapshot entry is missing.
 */
function stripLine(activeKey: string | null, tiles: FleetTile[]): string {
  const withFuelData = snapshot.totals.vehiclesWithFuelData;
  const fallback = `Every tile is part of ${formatNumber(withFuelData)} vehicles with fuel data.`;
  if (activeKey === null) return fallback;

  const tile = tiles.find((entry) => entry.key === activeKey);
  if (!tile) return fallback;

  const fleetShare = formatPercent(tile.count / withFuelData);
  if (tile.key === "fchv") {
    let line = `${tile.label}: ${formatNumber(tile.count)} vehicles, ${fleetShare} of the fleet.`;
    const fuelCellTotal = snapshot.fuelCellByFuel.reduce(
      (sum, entry) => sum + entry.count,
      0,
    );
    if (fuelCellTotal > 0) {
      const hydrogen = snapshot.fuelCellByFuel.find(
        (entry) => entry.key === "waterstof",
      );
      const petrol = snapshot.fuelCellByFuel.find(
        (entry) => entry.key === "benzine",
      );
      const clauses: string[] = [];
      if (hydrogen) clauses.push(`${formatNumber(hydrogen.count)} list hydrogen`);
      if (petrol) clauses.push(`${formatNumber(petrol.count)} list petrol`);
      if (clauses.length > 0) {
        line += ` Across all ${formatNumber(fuelCellTotal)} fuel cell vehicles, ${clauses.join(" and ")} as a fuel.`;
      }
    }
    return line;
  }
  if (tile.key === "no-electric") {
    return `${tile.label}: ${formatNumber(tile.count)} vehicles, ${fleetShare} of the fleet.`;
  }
  return `${tile.label}: ${formatNumber(tile.count)} vehicles, ${fleetShare} of the fleet and ${formatPercent(tile.count / electricVehicles)} of the ${formatNumber(electricVehicles)} vehicles with electric drive.`;
}

/**
 * Squarified treemap of the Dutch fleet by drivetrain, covering every
 * vehicle with fuel data. Tiles are positioned by the pure squarify
 * function in src/lib/treemap.ts: percentage coordinates from nominal
 * ratio units until the container is measured, exact pixels once the
 * ResizeObserver fires. Below 640 px the layout becomes a vertical stack
 * of full-width tiles in descending order. Missing photos degrade to a
 * color-only tile, since the image is a plain CSS background layer.
 *
 * Tiles open no tooltip: hovering or keyboard-focusing a tile updates the
 * always-visible info strip below the treemap (a polite live region),
 * and Escape clears back to the default line.
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
  // The strip follows whichever tile the pointer rests on or the keyboard
  // focuses; focus wins so keyboard users are never overridden by hover.
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const activeKey = focusKey ?? hoverKey;

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
  const stack = measured && size.width < MOBILE_BREAKPOINT;
  const tiles = buildTiles();
  const rects = squarifiedTreemap(
    tiles,
    measured ? size.width : REFERENCE_WIDTH,
    measured ? size.height : REFERENCE_HEIGHT,
  );

  const summary = `Fleet by drivetrain: of ${formatNumber(withFuelData)} vehicles with fuel data, ${formatNumber(noElectricCount)} (${formatPercent(noElectricCount / withFuelData)}) have no electric drive and ${formatNumber(batteryElectric)} (${formatPercent(batteryElectric / withFuelData)}) are battery electric.`;

  function handleTileKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "Escape") {
      setFocusKey(null);
      setHoverKey(null);
    }
  }

  return (
    <figure>
      <div
        ref={containerRef}
        role="img"
        aria-label={summary}
        className={`relative w-full overflow-hidden rounded-xl${
          stack ? " flex flex-col gap-1.5" : " aspect-[4/5] sm:aspect-[16/9]"
        }`}
      >
        {rects.map((rect) => {
          const share = rect.count / withFuelData;
          const stackHeight = Math.max(
            MIN_STACK_TILE_PX,
            share * STACK_TOTAL_PX,
          );
          const textWidth = stack ? (size?.width ?? 0) : rect.width - TILE_GAP_PX;
          const textHeight = stack
            ? stackHeight
            : rect.height - TILE_GAP_PX;
          const showText =
            textWidth >= MIN_TEXT_WIDTH_PX && textHeight >= MIN_TEXT_HEIGHT_PX;
          const spacious = textHeight >= 128;
          const gradientHeight = spacious
            ? "50%"
            : textHeight >= 80
              ? "70%"
              : "100%";

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
            "--fleet-tile-edge": `color-mix(in oklab, ${rect.colorToken} 75%, var(--fleet-tile-edge-mix))`,
            "--fleet-tile-ink": rect.inkToken,
          } as CSSProperties;

          return (
            <div
              key={rect.key}
              tabIndex={0}
              role="img"
              aria-label={`${rect.label}: ${formatNumber(rect.count)} (${formatPercent(share)})`}
              onFocus={() => setFocusKey(rect.key)}
              onBlur={() => setFocusKey(null)}
              onMouseEnter={() => setHoverKey(rect.key)}
              onMouseLeave={() => setHoverKey(null)}
              onKeyDown={handleTileKeyDown}
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
              {showText ? (
                <div
                  className={`relative flex h-full flex-col justify-end gap-1 ${
                    spacious ? "p-3 sm:p-4" : "p-2"
                  }`}
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
                      className={`font-semibold tabular-nums ${countSizeClass(share)}`}
                    >
                      {formatNumber(Math.round(rect.count * countProgress))}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums"
                      style={{
                        backgroundColor: `color-mix(in oklab, ${rect.colorToken} 22%, transparent)`,
                      }}
                    >
                      {formatPercent(share)}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div
        role="status"
        aria-live="polite"
        className="mt-3 border-t py-2.5 text-xs text-muted-foreground"
      >
        {stripLine(activeKey, tiles)}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Vehicles by drivetrain, sized by count. Hybrid drivetrains are
        grouped by their recorded hybrid class.
      </figcaption>
    </figure>
  );
}
