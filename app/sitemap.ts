import type { MetadataRoute } from "next";
import { snapshot } from "@/data/snapshot";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://fleet.pixelate.nl",
      lastModified: new Date(snapshot.retrievedAt),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
