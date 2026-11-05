import { Drawer } from "@/components/drawer";
import { FAMILY } from "@/family";

/*
  The Disclaimer, presented in the family's drawer instead of a page:
  the intro rides the drawer's description lead, the sections stay
  under the panel title. The copy is fixed legal text and renders
  verbatim; nothing in it can go stale, because no figure appears.
*/
const INTRO = `This site, part of the ${FAMILY.launcherLabel} by ${FAMILY.organization}, publishes informational data visualizations derived from public open data, including the RDW vehicle register. It exists to make public data legible; it is not a source of official figures.`;

/** Section-title treatment at drawer scale. */
const sectionTitle =
  "text-lg font-extrabold leading-tight tracking-tight text-primary dark:text-white";

/**
 * The Disclaimer drawer of the family, mounted from the footer's
 * colophon. A server component like the method drawer: the sections
 * render into the panel body at build time, so the legal copy ships
 * in the static HTML even while the drawer is closed.
 */
export function DisclaimerDrawer() {
  return (
    <Drawer label="Disclaimer" title="Disclaimer" description={INTRO}>
      <div className="flex flex-col gap-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h3 className={sectionTitle}>Informational purpose</h3>
          <p className="mt-1">
            All content is general information for informational and
            educational purposes. Nothing on this site is professional, legal,
            financial, or technical advice, and it should not be relied upon
            as such.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>No warranty</h3>
          <p className="mt-1">
            Content is provided as is, without warranty of any kind. Figures
            reflect the state of the source registers at the stated retrieval
            date. Administrative registers are live systems that contain
            errors, omissions, and inconsistencies; despite the care taken in
            aggregation, figures may be incomplete or mistaken. No
            representation is made as to accuracy, completeness, timeliness,
            or fitness for any particular purpose.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>Liability</h3>
          <p className="mt-1">
            To the extent permitted by applicable law, {FAMILY.organization}{" "}
            accepts no liability for any direct or indirect damage arising
            from the use of, or reliance on, the content of this site.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>AI-generated text</h3>
          <p className="mt-1">
            Texts marked AI insight are generated automatically from the same
            verified aggregates that power the charts. The feature is
            experimental; such texts may contain errors and never replace the
            underlying data.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>External links</h3>
          <p className="mt-1">
            This site links to third-party sites, including the RDW and
            GitHub. We have no control over their content and accept no
            responsibility for it.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>Governing law</h3>
          <p className="mt-1">
            This disclaimer and the use of this site are governed by Dutch
            law.
          </p>
        </section>
        <section>
          <h3 className={sectionTitle}>Privacy, briefly</h3>
          <p className="mt-1">
            There is almost nothing to disclose. This site sets no cookies,
            runs no analytics or tracking, collects no personal data, and
            stores nothing about you on any server. The only thing it
            remembers is your theme preference, which lives in your own
            browser&apos;s local storage and never leaves your device.
          </p>
        </section>
      </div>
    </Drawer>
  );
}
