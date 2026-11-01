/**
 * Family configuration for the Pixelate data product family.
 * The launcher URL is a one-place change once the launcher site ships.
 */
export const FAMILY = {
  organization: "Pixelate BV",
  organizationUrl: "https://pixelate.nl",
  productName: "Dutch Fleet Electrification Explorer",
  /**
   * Launcher website of the Open Data Project, which will gather all the
   * open data projects. Points to pixelate.nl until the launcher ships.
   */
  launcherUrl: "https://pixelate.nl",
  launcherLabel: "Open Data Project",
} as const;
