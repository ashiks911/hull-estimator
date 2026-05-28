import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hull Resistance Estimator",
  description: "Estimate ship hull resistance and effective power",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
