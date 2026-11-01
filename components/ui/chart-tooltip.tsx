"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/** Distance kept between the tooltip and the viewport edges, in px. */
const VIEWPORT_MARGIN = 8;
/** Gap between the tooltip and the element it points at, in px. */
const TOOLTIP_GAP = 8;

/** Class that must be part of the trigger's className for the focus ring. */
export const CHART_TOOLTIP_TRIGGER_CLASS = "chart-tooltip-trigger";

/**
 * Props to spread onto the bar, segment or track that triggers the
 * tooltip. The caller renders the trigger itself, so no element is
 * cloned or introspected across the server/client boundary: server-passed
 * elements arrive as opaque chunks in React 19.2+, which makes
 * cloneElement on them unsafe.
 */
export interface ChartTooltipTriggerProps {
  ref: (element: HTMLElement | SVGElement | null) => void;
  tabIndex: number;
  role: string;
  "aria-label": string;
  onFocus: () => void;
  onBlur: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPointerDown: (event: ReactPointerEvent) => void;
  onKeyDown: (event: ReactKeyboardEvent) => void;
}

export interface ChartTooltipProps {
  /** Heading line: the segment, fuel or type label, or the year. */
  label: string;
  /** Exact count, already formatted by the caller. */
  value: string;
  /** Optional share of the relevant total, already formatted. */
  percent?: string;
  /** Optional second value line, rendered under the first. */
  value2?: string;
  /**
   * Renders the trigger from the given props; active is true while the
   * tooltip is open, so the caller can highlight related visuals.
   * Callers that ignore active keep working unchanged.
   */
  children: (
    trigger: ChartTooltipTriggerProps,
    active: boolean,
  ) => ReactNode;
}

/**
 * Popover-styled tooltip for chart bars and segments, implemented without
 * a tooltip or positioning library. It appears on hover, keyboard focus
 * and tap, floats above the trigger (flipping below when the trigger sits
 * near the top of the viewport) and is clamped to the viewport edges so
 * it never overflows on narrow screens. All positioning happens in the
 * browser, only after user interaction, so server rendering and the
 * static export are unaffected. The popover tokens make it follow the
 * active theme, including while it is visible.
 */
export function ChartTooltip({
  label,
  value,
  percent,
  value2,
  children,
}: ChartTooltipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0, below: false });
  const triggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  function show() {
    const element = triggerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - TOOLTIP_GAP,
      below: false,
    });
    setOpen(true);
  }

  useLayoutEffect(() => {
    if (!open) return;

    // The tooltip can only be measured once it is rendered: clamp it
    // before paint, then keep it anchored while the page scrolls or resizes.
    function place() {
      const element = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const halfWidth = (tooltip?.offsetWidth ?? 0) / 2;
      const lowerBound = halfWidth + VIEWPORT_MARGIN;
      const upperBound = Math.max(
        window.innerWidth - halfWidth - VIEWPORT_MARGIN,
        lowerBound,
      );
      const below =
        rect.top - TOOLTIP_GAP - (tooltip?.offsetHeight ?? 0) <
        VIEWPORT_MARGIN;
      setPosition({
        x: Math.min(Math.max(rect.left + rect.width / 2, lowerBound), upperBound),
        y: below ? rect.bottom + TOOLTIP_GAP : rect.top - TOOLTIP_GAP,
        below,
      });
    }

    // Touch devices have no hover or reliable blur to dismiss the tooltip,
    // so any tap outside of the trigger closes it.
    function dismiss(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [open]);

  const trigger: ChartTooltipTriggerProps = {
    ref: (element) => {
      triggerRef.current = element;
    },
    tabIndex: 0,
    role: "img",
    "aria-label": `${label}: ${value}${percent ? ` (${percent})` : ""}${value2 ? `. ${value2}` : ""}`,
    onFocus: show,
    onBlur: () => setOpen(false),
    onMouseEnter: show,
    onMouseLeave: () => setOpen(false),
    onPointerDown: (event) => {
      // Touch and pen devices have no hover: tap opens the tooltip.
      if (event.pointerType !== "mouse") show();
    },
    onKeyDown: (event) => {
      if (event.key === "Escape") setOpen(false);
    },
  };

  return (
    <>
      {children(trigger, open)}
      {open &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            className="pointer-events-none fixed top-0 left-0 z-60 rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{
              transform: position.below
                ? `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, 0)`
                : `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -100%)`,
            }}
          >
            <p className="font-medium">{label}</p>
            <p className="mt-0.5 text-muted-foreground tabular-nums">
              {value}
              {percent ? ` · ${percent}` : ""}
            </p>
            {value2 && (
              <p className="mt-0.5 text-muted-foreground tabular-nums">
                {value2}
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
