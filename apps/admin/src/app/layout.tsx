import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MarginLab — Experimentation & Profit Optimization",
  description: "A/B testing, price experiments, and profit analytics for Shopify merchants",
  robots: "noindex, nofollow", // Embedded app — should not be indexed
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
