import type { Metadata } from "next";
import "./globals.css";
import { FamilyHeader } from "@/components/family-header";
import { FamilyFooter } from "@/components/family-footer";

export const metadata: Metadata = {
  title: {
    default: "Dutch Fleet Electrification Explorer",
    template: "%s | Dutch Fleet Electrification Explorer",
  },
  description:
    "How fast is the Netherlands going electric? Live aggregates from the complete RDW vehicle register, visualized by Pixelate.",
  keywords: [
    "electric vehicles",
    "Netherlands",
    "RDW open data",
    "fleet electrification",
    "data visualization",
    "EV statistics",
  ],
  authors: [{ name: "Pixelate BV", url: "https://pixelate.nl" }],
  openGraph: {
    title: "Dutch Fleet Electrification Explorer",
    description:
      "Live aggregates from the complete RDW vehicle register, visualized by Pixelate.",
    type: "website",
    siteName: "fleet.pixelate.nl",
  },
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
          <FamilyFooter />
        </div>
      </body>
    </html>
  );
}
