import type { Metadata } from "next";

export const siteName = "NiveshFlow";
export const siteTitle = "NiveshFlow | Personal Finance & Expense Tracker";
export const siteDescription =
  "Manage accounts, track income and expenses, monitor debt, and plan savings goals with NiveshFlow, your private personal finance workspace.";

export function getSiteUrl(): URL {
  const configured = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const fallback = "https://niveshflow.netlify.app";
  try {
    const url = new URL(configured || fallback);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username || url.password ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    ) {
      throw new Error("Invalid site URL");
    }
    return new URL(url.origin);
  } catch {
    throw new Error("APP_URL must be an HTTP(S) origin without credentials, using HTTPS in production.");
  }
}

export const siteUrl = getSiteUrl();
// Netlify preview builds must not compete with the production website in search.
export const indexPublicPages = !process.env.CONTEXT || process.env.CONTEXT === "production";
export const privateRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  noarchive: true,
};

export const defaultMetadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: { default: siteTitle, template: `%s | ${siteName}` },
  description: siteDescription,
  robots: privateRobots,
  openGraph: {
    type: "website",
    siteName,
    locale: "en_IN",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const homeMetadata: Metadata = {
  title: { absolute: siteTitle },
  description: siteDescription,
  alternates: { canonical: siteUrl.href },
  robots: indexPublicPages
    ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } }
    : privateRobots,
  openGraph: { ...defaultMetadata.openGraph, url: siteUrl.href },
};

export function privatePageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: privateRobots,
    openGraph: { ...defaultMetadata.openGraph, title: `${title} | ${siteName}`, description },
    twitter: { ...defaultMetadata.twitter, title: `${title} | ${siteName}`, description },
  };
}

export function getSiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl.href}#website`,
        url: siteUrl.href,
        name: siteName,
        description: siteDescription,
        inLanguage: "en-IN",
      },
      {
        "@type": "WebApplication",
        "@id": `${siteUrl.href}#application`,
        url: siteUrl.href,
        name: siteName,
        description: siteDescription,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript and an internet connection",
        featureList: [
          "Account and wallet management",
          "Income and expense tracking",
          "Cash flow visualization",
          "Debt and repayment tracking",
          "Upcoming bills and savings goals",
        ],
        isPartOf: { "@id": `${siteUrl.href}#website` },
      },
    ],
  };
}

export function serializeStructuredData(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
