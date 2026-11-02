const PIXELS = [true, true, true, false, true, true, true, false, true];

/**
 * Family logo: the Open Data Project pixel grid, echoing
 * design/og-image.html and app/icon.svg. Filled cells use the
 * primary token so the mark stays brand green in both themes.
 * Decorative: the launcher link provides the accessible name.
 */
export function FamilyLogo() {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 grid-cols-3 gap-[4px]"
    >
      {PIXELS.map((filled, index) => (
        <span
          key={index}
          className={filled ? "rounded-full bg-primary" : "rounded-full"}
        />
      ))}
    </span>
  );
}
