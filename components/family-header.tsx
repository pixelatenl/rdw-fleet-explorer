import Link from "next/link";
import { FAMILY } from "@/family";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shared family header, present on every product site in the family.
 * Carries the Pixelate wordmark and the back link to the launcher hub.
 */
export function FamilyHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href={FAMILY.organizationUrl}
            className="font-semibold tracking-tight"
            title="Pixelate"
          >
            Pixelate
          </Link>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
          <span className="hidden text-sm text-muted-foreground sm:block">
            {FAMILY.productName}
          </span>
        </div>
        <nav className="flex items-center gap-1" aria-label="Site">
          <Link
            href={FAMILY.launcherUrl}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {FAMILY.launcherLabel}
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
