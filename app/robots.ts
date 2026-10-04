import type { MetadataRoute } from "next";
import { indexPublicPages, siteUrl } from "@/app/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    // Pages remain crawlable so search engines can read their noindex metadata.
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    ...(indexPublicPages ? { sitemap: new URL("/sitemap.xml", siteUrl).href } : {}),
  };
}
