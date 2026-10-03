import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NiveshFlow | Personal Finance Management",
  description:
    "A secure personal finance management SaaS with OTP auth, recovery, roles, and admin-ready workflows.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
