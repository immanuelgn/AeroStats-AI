import type { Metadata } from "next";
import { AppShell } from "@/components/providers/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "AeroStats AI",
  description: "A personal drone telemetry and machine-learning project for replaying flights, validating predictions, and improving analysis over time.",
  applicationName: "AeroStats AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
