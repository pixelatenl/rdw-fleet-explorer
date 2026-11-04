import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FamilyHeader } from "@/components/family-header";
import { FamilyFooter } from "@/components/family-footer";
import { MethodDrawer } from "@/components/method-drawer";

const SITE_URL = "https://fleet.pixelate.nl";
const SITE_DESCRIPTION =
  "How electric is the Dutch fleet? Live aggregates from the complete RDW vehicle register, refreshed weekly and visualized by Pixelate.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dutch Fleet Electrification Explorer",
    template: "%s | Dutch Fleet Electrification Explorer",
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
  authors: [{ name: "Pixelate BV", url: "https://pixelate.nl" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Dutch Fleet Electrification Explorer",
    description:
      "Live aggregates from the complete RDW vehicle register, visualized by Pixelate.",
    type: "website",
    siteName: "fleet.pixelate.nl",
    url: "/",
    locale: "en",
    images: [
      {
        url: "/images/og.png",
        width: 1200,
        height: 630,
        alt: "How electric is the Dutch fleet? 19.5 percent of vehicles with fuel data run electric",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dutch Fleet Electrification Explorer",
    description: SITE_DESCRIPTION,
    images: ["/images/og.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

/*
  Theme colors mirror the --background tokens in globals.css:
  #eaf6f9 for light, #051214 for dark (the family hub's canvas).
*/
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#051214" },
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
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <div className="flex min-h-screen flex-col">
          <FamilyHeader />
          <main className="flex-1">{children}</main>
          <FamilyFooter extra={<MethodDrawer />} />
        </div>
      </body>
    </html>
  );
}
