/**
 * Family configuration for the Pixelate data product family.
 * The launcher URL is a one-place change once the launcher site ships.
 */
export const FAMILY = {
  organization: "Pixelate BV",
  organizationUrl: "https://pixelate.nl",
  productName: "Dutch Fleet Electrification Explorer",
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
