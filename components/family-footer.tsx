import Link from "next/link";
import { FAMILY } from "@/family";
import { snapshot } from "@/data/snapshot";

/** Shared uppercase zone label of the footer credits and colophon. */
const zoneLabel = "text-xs font-semibold tracking-widest text-muted-foreground uppercase";

/** Underline-offset hover pattern shared by the footer text links. */
const footerLink = "text-muted-foreground underline underline-offset-4 hover:text-foreground";

/**
 * Three zones: the signature (product name, anchored to the launcher
 * hub), the credits (data attribution) and the colophon (source and
 * organization links). The optional extra prop lets a product slot a
 * link into the colophon, after the repository and organization links.
 * The optional disclaimerPath props in a Disclaimer link next to the
 * attribution; products without the page omit it and render as before.
 */
export function FamilyFooter({
  extra,
  disclaimerPath,
}: {
  extra?: React.ReactNode;
  disclaimerPath?: string;
}) {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 lg:py-12">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          {/*
            Signature. The product name is the anchor back to the
            launcher hub, with the family phrase as its muted caption.
          */}
          <div className="max-w-xl">
            <Link
              href={FAMILY.launcherUrl}
              className="text-lg font-extrabold tracking-tight text-foreground"
            >
              {FAMILY.productName}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              Part of the{" "}
              <Link href={FAMILY.launcherUrl} className={footerLink}>
                {FAMILY.launcherLabel}
              </Link>
            </p>
          </div>
          {/*
            Right-hand zones. Colophon first on phones, credits first on
            wide screens, with a hairline divider between the two.
          */}
          <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start lg:gap-10">
            <div className="max-w-xl">
              <p className={zoneLabel}>Data</p>
              <div className="mt-2 text-sm leading-snug text-muted-foreground">
                <p>
                  <Link
                    href={`${snapshot.source.url}/resource/${snapshot.source.datasets.base}`}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    RDW Open Data
                  </Link>{" "}
                  ({snapshot.source.license}), retrieved {snapshot.retrievedAt}.
                </p>
                <p className="mt-1">
                  The RDW offers no actuality guarantee; every figure reflects
                  the register state at the retrieval date.
                </p>
              </div>
              {disclaimerPath && (
                <Link href={disclaimerPath} className={`mt-2 block ${footerLink}`}>
                  Disclaimer
                </Link>
              )}
            </div>
            <div className="max-w-xl lg:border-l lg:border-border lg:pl-10">
              <p className={zoneLabel}>Colophon</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <Link href={FAMILY.sourceUrl} className={footerLink}>
                  GitHub
                </Link>
                <Link href={FAMILY.organizationUrl} className={footerLink}>
                  {FAMILY.organization}
                </Link>
                {extra}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
