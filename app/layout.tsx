import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FamilyHeader } from "@/components/family-header";
import { FamilyFooter } from "@/components/family-footer";
import { MethodDrawer } from "@/components/method-drawer";
import { DisclaimerDrawer } from "@/components/disclaimer-drawer";
import { FAMILY } from "@/family";
import {
  snapshot,
  electricShareOfFuelVehicles,
  formatNumber,
  formatPercent,
} from "@/data/snapshot";

/*
  Site metadata, derived at build time from the committed snapshot —
  the same derived-not-hardcoded rule the page follows, so the numbers
  in the meta tags can never go stale between weekly rebuilds. The
  title names the product in under sixty characters; the description
  carries the register total and the electric-drive share, formatted
  and rounded exactly as the page renders them, and lands in the
  150-to-160-character band on the current snapshot. Every figure is
  computed in this module scope at build time through Next's static
  metadata path: no runtime code, no pipeline calls, no numbers
  copied by hand.
*/
const SITE_TITLE = `${FAMILY.productName} | ${FAMILY.organization}`;
const SITE_DESCRIPTION = `${formatPercent(electricShareOfFuelVehicles)} of the ${formatNumber(
  snapshot.totals.vehiclesWithFuelData,
)} Dutch vehicles with fuel data run electric — live aggregates from the complete ${formatNumber(
  snapshot.totals.vehicles,
)}-vehicle RDW register, refreshed weekly.`;

/*
  A stable alt for the Open Graph image: the image itself carries no
  figures, so neither layer can go stale between rebuilds — the
  derived description carries the numbers instead.
*/
const OG_IMAGE_ALT = `The ${FAMILY.productName} in the Pixelate family's dark display style: the product name, its question, and the RDW open-data credit.`;

export const metadata: Metadata = {
  metadataBase: new URL(FAMILY.siteUrl),
  title: {
    default: SITE_TITLE,
    template: `%s | ${FAMILY.productName}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "electric vehicles",
    "Netherlands",
    "RDW open data",
    "fleet electrification",
    "data visualization",
    "EV statistics",
  ],
  authors: [{ name: FAMILY.organization, url: FAMILY.organizationUrl }],
  // Next normalizes the site root to its slashless form
  // (https://fleet.pixelate.nl), which URLs resolve identically, so
  // the canonical and og:url stay on the metadata path instead of a
  // duplicated raw tag.
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    siteName: FAMILY.siteName,
    url: "/",
    locale: "en",
    images: [
      {
        url: "/images/og.png",
        width: 1200,
        height: 630,
        alt: OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/images/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/*
  Structured data in the page head, one node per file the static
  export serves. The Dataset node is the honest type for a page built
  from aggregates: the attribution states that the aggregates derive
  from the RDW open data (opendata.rdw.nl), the license is the CC0 the
  source carries, the repository is where the site's code lives, and
  dateModified is the snapshot's retrieval date. The WebSite node is
  minimal: the product and its canonical URL.
*/
const datasetJsonLd = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Dutch fleet aggregates from the RDW vehicle register",
  description: SITE_DESCRIPTION,
  url: FAMILY.siteUrl,
  isAccessibleForFree: true,
  license: "https://creativecommons.org/publicdomain/zero/1.0/",
  creator: {
    "@type": "Organization",
    name: FAMILY.organization,
    url: FAMILY.organizationUrl,
  },
  provider: {
    "@type": "Organization",
    name: "RDW (Rijksdienst voor het Wegverkeer)",
    url: "https://opendata.rdw.nl",
  },
  sameAs: FAMILY.sourceUrl,
  dateModified: snapshot.retrievedAt,
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: FAMILY.productName,
  url: FAMILY.siteUrl,
};

/*
  Theme colors mirror the --background tokens in globals.css:
  #eaf6f9 for light, #0f353d for dark.
*/
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f353d" },
  ],
};

/*
  Applies the persisted theme before first paint to avoid a flash of the
  wrong theme. Defaults to the operating system preference.
*/
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("pixelate-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <FamilyHeader />
          <main className="flex-1">{children}</main>
          <FamilyFooter
            extra={<MethodDrawer />}
            disclaimer={<DisclaimerDrawer />}
          />
        </div>
      </body>
    </html>
  );
}
