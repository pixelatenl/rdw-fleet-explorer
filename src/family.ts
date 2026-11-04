/**
 * Family configuration for the Pixelate data product family.
 * The launcher URL is a one-place change once the launcher site ships.
 */
export const FAMILY = {
  organization: "Pixelate BV",
  organizationUrl: "https://pixelate.nl",
  productName: "Dutch Fleet Electrification Explorer",
  /** Short site name used for og:site_name. */
  siteName: "fleet.pixelate.nl",
  /**
   * Canonical production URL of this product site. The canonical meta
   * tag, the Open Graph URL and the crawl files all resolve against it,
   * so a domain move is a one-place change here.
   */
  siteUrl: "https://fleet.pixelate.nl",
  /**
   * Launcher website of the Open Data Project, which gathers all the
   * open data projects.
   */
  launcherUrl: "https://opendata.pixelate.nl/",
  launcherLabel: "Open Data Project",
  /**
   * Source repository of this product, linked from the shared family
   * footer so the site points at the code that builds it.
   */
  sourceUrl: "https://github.com/pixelatenl/rdw-fleet-explorer",
} as const;
