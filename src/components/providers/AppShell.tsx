"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BarChart3, Brain, CloudSun, Database, Home, Plane, Settings, Upload } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";
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
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/icon.png" width={36} height={36} alt="" className="h-9 w-9 rounded-lg" priority />
            <span className="text-sm font-semibold tracking-tight text-[#1d1d1f]">AeroStats AI</span>
          </Link>
          <div className="hidden items-center gap-2 text-xs text-[#6e6e73] lg:flex">
            <Database className="h-3.5 w-3.5" />
            <span>{flights.length ? `${flights.length} flight${flights.length === 1 ? "" : "s"} analyzed` : "Portfolio dataset awaiting first flight"}</span>
            <span className="h-1 w-1 rounded-full bg-[#d2d2d7]" />
            <WeatherStatus mode={weatherMode} />
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
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="max-w-2xl space-y-2">
            <p>AeroStats AI is a personal drone telemetry and machine-learning portfolio project. Weather data provided by Open-Meteo.</p>
            <p>DJI and DJI Fly are trademarks of DJI. AeroStats AI is independent and is not affiliated with or endorsed by DJI.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/immanuelgn/AeroStats-AI"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View the AeroStats AI repository on GitHub"
              title="GitHub repository"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.12] text-[#1d1d1f] hover:border-[#0071e3] hover:bg-[#f5f5f7] hover:text-[#0071e3]"
            >
              <FaGithub className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href="https://www.linkedin.com/in/immanuelgnanaseelan/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Immanuel Gnanaseelan on LinkedIn"
              title="LinkedIn profile"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/[0.12] text-[#0a66c2] hover:border-[#0a66c2] hover:bg-[#0a66c2]/[0.06]"
            >
              <FaLinkedin className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function WeatherStatus({ mode }: { mode: "disabled" | "mock" | "open-meteo" }) {
  const active = mode === "open-meteo";
  const testing = mode === "mock";
  const label = active ? "Open-Meteo active" : testing ? "Testing mode" : "Disabled";

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
        {active ? <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34c759] opacity-60 motion-reduce:animate-none" /> : null}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? "bg-[#34c759]" : testing ? "bg-[#ff9f0a]" : "bg-[#86868b]"}`} />
      </span>
      <span>Weather: {label}</span>
    </span>
  );
}
