"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Brain, CloudSun, Database, Home, Plane, Settings, Upload } from "lucide-react";
import { DataProvider, useUploadedData } from "@/lib/storage/DataProvider";

const links = [
  { href: "/", label: "Home", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/flights", label: "Flights", icon: Plane },
  { href: "/forecast", label: "Forecast", icon: CloudSun },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/model", label: "Model", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <ShellFrame>{children}</ShellFrame>
    </DataProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { flights, weatherMode } = useUploadedData();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0f1110]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#98b58a]/40 bg-[#98b58a]/12">
              <Activity className="h-4 w-4 text-[#c8d8bd]" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[#f5f3ec]">AeroStats AI</span>
              <span className="block text-xs text-[#a9b0a6]">Upload-ready telemetry pipeline</span>
            </span>
          </Link>
          <div className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#a9b0a6] md:flex">
            <Database className="h-3.5 w-3.5" />
            <span>{flights.length ? `${flights.length} stored flight${flights.length === 1 ? "" : "s"}` : "No uploaded data"}</span>
            <span className="h-1 w-1 rounded-full bg-[#303831]" />
            <span>Weather: {weatherMode}</span>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3 sm:px-6">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? "bg-[#f5f3ec] text-[#111411]" : "text-[#a9b0a6] hover:bg-white/[0.06] hover:text-[#f5f3ec]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-[#7f887d] sm:px-6">
        Weather integration prepared for Open-Meteo. Weather data is joined separately using flight GPS coordinates and timestamps.
      </footer>
    </div>
  );
}
