import type { MetadataRoute } from "next";
import { indexPublicPages, siteUrl } from "@/app/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return indexPublicPages ? [{ url: siteUrl.href }] : [];
}
