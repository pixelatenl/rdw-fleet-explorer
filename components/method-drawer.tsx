"use client";

import { useEffect, useRef, useState } from "react";
import { snapshot } from "@/data/snapshot";

const PANEL_ID = "method-drawer-panel";

/**
 * Drawer holding the Method and sources text, opened from the family
 * footer. A plain client component: no animation library, no Radix.
 * The panel stays mounted (hidden plus inert when closed) so the
 * method text ships in the static HTML for search engines.
 */
export function MethodDrawer() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // While open: lock body scroll, close on Escape, and move focus
  // into the panel. Cleanup runs on close and on unmount.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openDrawer() {
    setOpen(true);
  }

  function closeDrawer() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Manual focus trap: Tab and Shift+Tab wrap inside the panel.
  function handleTab(event: React.KeyboardEvent) {
    if (event.key !== "Tab") return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrawer}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        Method and sources
      </button>

      <div
        hidden={!open}
        inert={!open}
        aria-hidden={!open}
        onClick={closeDrawer}
        className="fixed inset-0 z-[60] bg-black/50"
      />

      <div
        ref={panelRef}
        id={PANEL_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby="method-drawer-title"
        hidden={!open}
        inert={!open}
        aria-hidden={!open}
        tabIndex={-1}
        onKeyDown={handleTab}
        className="fixed inset-y-0 right-0 z-[60] flex w-[480px] max-w-[90vw] flex-col border-l border-border bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div>
            <h2 id="method-drawer-title" className="text-xl font-semibold tracking-tight">
              Method and sources
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every figure on this page is a server-side aggregation of the
              official register, embedded at build time.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close"
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <svg
              className="size-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-6">
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li>
              Source: RDW Open Data, datasets{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                {snapshot.source.datasets.base}
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                {snapshot.source.datasets.fuel}
              </code>
              , license {snapshot.source.license}.
            </li>
            <li>
              Snapshot date: {snapshot.retrievedAt}. The register reflects
              the current state only, so time series on this page are built
              from what is on the road today.
            </li>
            <li>
              Aggregations are computed with server-side queries against
              the RDW API; no raw vehicle records are stored or published.
              No personal owner data exists in this source.
            </li>
            <li>
              The heavy turn: SoQL averages of{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                massa_ledig_voertuig
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                cilinderinhoud
              </code>{" "}
              per first-admission-year cohort of passenger cars from 1975
              on. The mass averages cover all passenger cars including
              electric vehicles, the engine-size averages cover only
              vehicles with a recorded{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                cilinderinhoud
              </code>
              , and cohorts under 1,000 vehicles are excluded.
            </li>
            <li>
              The fuel cell coverage is a SoQL count of distinct{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                kenteken
              </code>{" "}
              per recorded fuel over the fuel cell hybrid classes{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                NOVC-FCHV
              </code>{" "}
              and{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                OVC-FCHV
              </code>
              . Hydrogen fuel cell vehicles carry a{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                Waterstof
              </code>{" "}
              row without a matching{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-foreground">
                Elektriciteit
              </code>{" "}
              row, which is why the electric split counts only the
              electricity-listing portion.
            </li>
            <li>
              Entry year is the first registration in the Netherlands,
              so imported used vehicles count in the year they arrived,
              not their build year. Because the register holds the
              current state only, older bars shrink through attrition,
              not through declining registrations.
            </li>
            <li>
              Figures include all vehicle types unless stated otherwise;
              trailers and similar vehicles without fuel data are excluded
              from fuel-based shares. The fuel-data total covers all motor
              vehicles, mopeds and motorcycles included, so the drivetrain
              figures are motor vehicle figures, not car figures.
            </li>
            <li className="text-xs">
              Photo by{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/@chuttersnap"
              >
                CHUTTERSNAP
              </a>{" "}
              on{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/photos/electric-vehicle-charging-cable-plugged-into-car-xJLsHl0hIik"
              >
                Unsplash
              </a>
              .
            </li>
            <li className="text-xs">
              Photo by{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/@ivankazlouskij"
              >
                Ivan Kazlouskij
              </a>{" "}
              on{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/photos/a-close-up-of-a-cars-logo-TgtwqlglS-s"
              >
                Unsplash
              </a>
              .
            </li>
            <li className="text-xs">
              Photo by{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/@mkumbwajr"
              >
                Ali Mkumbwa
              </a>{" "}
              on{" "}
              <a
                className="underline underline-offset-2 hover:text-foreground"
                href="https://unsplash.com/photos/a-man-pumping-gas-into-his-car-at-a-gas-station-BK20Ws-wSFc"
              >
                Unsplash
              </a>
              .
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
