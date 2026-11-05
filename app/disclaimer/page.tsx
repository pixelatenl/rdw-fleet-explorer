import type { Metadata } from "next";
import { FAMILY } from "@/family";

/*
  The limits of these figures, in the family's typographic system.
  The copy is fixed legal text: every section body renders verbatim,
  so nothing here can go stale and no figure appears on the page.
  The title rides the layout's `%s | ${product}` template, just like
  the site's root metadata with its absolute canonical.
*/
const PAGE_DESCRIPTION =
  "The limits of these figures: informational purpose, no warranty, no liability, and almost no privacy to disclose.";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: PAGE_DESCRIPTION,
  alternates: {
    canonical: "/disclaimer",
  },
  openGraph: {
    url: "/disclaimer",
  },
};

/*
  The section-title and muted-description treatments the charts and
  cards already speak with, lifted onto a plain reading page under one
  display-voice heading.
*/
const sectionTitle =
  "text-2xl font-extrabold leading-tight tracking-tight text-primary sm:text-3xl dark:text-white";
const description = "text-base leading-relaxed text-muted-foreground sm:text-lg";

export default function DisclaimerPage() {
  return (
    <div className="mx-auto max-w-[1536px] px-4 py-10 sm:px-6 sm:py-16">
      <div className="max-w-[62ch]">
        <h1 className="text-[clamp(2.5rem,1.7rem+2vw,4rem)] font-black uppercase leading-[0.95] tracking-[-0.055em]">
          Disclaimer
        </h1>
        <p className={`mt-6 ${description}`}>
          This site, part of the{' '}
          {FAMILY.launcherLabel} by {FAMILY.organization}, publishes
          informational data visualizations derived from public open data,
          including the RDW vehicle register. It exists to make public data
          legible; it is not a source of official figures.
        </p>

        <section className="mt-10">
          <h2 className={sectionTitle}>Informational purpose</h2>
          <p className={`mt-2 ${description}`}>
            All content is general information for informational and
            educational purposes. Nothing on this site is professional, legal,
            financial, or technical advice, and it should not be relied upon
            as such.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>No warranty</h2>
          <p className={`mt-2 ${description}`}>
            Content is provided as is, without warranty of any kind. Figures
            reflect the state of the source registers at the stated retrieval
            date. Administrative registers are live systems that contain
            errors, omissions, and inconsistencies; despite the care taken in
            aggregation, figures may be incomplete or mistaken. No
            representation is made as to accuracy, completeness, timeliness,
            or fitness for any particular purpose.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>Liability</h2>
          <p className={`mt-2 ${description}`}>
            To the extent permitted by applicable law, {FAMILY.organization}{" "}
            accepts no liability for any direct or indirect damage arising
            from the use of, or reliance on, the content of this site.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>AI-generated text</h2>
          <p className={`mt-2 ${description}`}>
            Texts marked AI insight are generated automatically from the same
            verified aggregates that power the charts. The feature is
            experimental; such texts may contain errors and never replace the
            underlying data.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>External links</h2>
          <p className={`mt-2 ${description}`}>
            This site links to third-party sites, including the RDW and GitHub.
            We have no control over their content and accept no responsibility
            for it.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>Governing law</h2>
          <p className={`mt-2 ${description}`}>
            This disclaimer and the use of this site are governed by Dutch
            law.
          </p>
        </section>

        <section className="mt-10">
          <h2 className={sectionTitle}>Privacy, briefly</h2>
          <p className={`mt-2 ${description}`}>
            There is almost nothing to disclose. This site sets no cookies,
            runs no analytics or tracking, collects no personal data, and
            stores nothing about you on any server. The only thing it
            remembers is your theme preference, which lives in your own
            browser&apos;s local storage and never leaves your device.
          </p>
        </section>
      </div>
    </div>
  );
}
