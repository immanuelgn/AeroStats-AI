"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, Brain, CloudSun, Database, Home, Plane, Settings, Upload } from "lucide-react";
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
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="sticky top-0 z-40 border-b border-black/[0.08] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icon.png" width={28} height={28} alt="" className="h-7 w-7 rounded-md" />
            <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">AeroStats AI</span>
          </Link>
          <div className="hidden items-center gap-2 text-xs text-[#6e6e73] lg:flex">
            <Database className="h-3.5 w-3.5" />
            <span>{flights.length ? `${flights.length} flight${flights.length === 1 ? "" : "s"} analyzed` : "Portfolio dataset awaiting first flight"}</span>
            <span className="h-1 w-1 rounded-full bg-[#d2d2d7]" />
            <span>Weather: {weatherMode}</span>
          </div>
        </div>
        <nav aria-label="Primary navigation" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2 sm:px-6">
          {links.map((link) => {
            const active = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  active ? "bg-[#1d1d1f] text-white" : "text-[#424245] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">{children}</main>
      <footer className="mx-auto max-w-6xl border-t border-black/[0.08] px-4 py-8 text-xs text-[#6e6e73] sm:px-6">
        AeroStats AI is a personal drone telemetry and machine-learning portfolio project. Weather data provided by Open-Meteo.
      </footer>
    </div>
  );
}
