import Link from "next/link";
import { FAMILY } from "@/family";
import { snapshot } from "@/data/snapshot";

/**
 * Shared family footer with the back link to the launcher hub and the
 * data attribution. Present on every product site in the family.
 */
export function FamilyFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1536px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm text-muted-foreground">
          <p>
            Data:{" "}
            <Link
              href={`${snapshot.source.url}/resource/${snapshot.source.datasets.base}`}
              className="underline underline-offset-4 hover:text-foreground"
            >
              RDW Open Data
            </Link>{" "}
            ({snapshot.source.license}), retrieved {snapshot.retrievedAt}.
          </p>
          <p className="mt-1">
            The RDW offers no actuality guarantee; every figure reflects the
            register state at the retrieval date.
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href={FAMILY.launcherUrl}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {FAMILY.launcherLabel}
          </Link>
          <Link
            href={FAMILY.organizationUrl}
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            {FAMILY.organization}
          </Link>
        </div>
      </div>
    </footer>
  );
}
