"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { FlightCard } from "@/components/flights/FlightCard";
import { useUploadedData } from "@/lib/storage/DataProvider";

export default function FlightsPage() {
  const { flights, backendSyncing } = useUploadedData();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const filtered = useMemo(() => {
    return flights.filter((flight) => {
      const haystack = [flight.name, flight.metadata.locationLabel, ...flight.tags].join(" ").toLowerCase();
      const riskScore = flight.metrics.riskScore ?? 0;
      const riskMatch = risk === "all" || (risk === "low" && riskScore <= 42) || (risk === "medium" && riskScore > 42 && riskScore <= 68) || (risk === "high" && riskScore > 68);
      return haystack.includes(query.toLowerCase()) && riskMatch;
    });
  }, [flights, query, risk]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">Flight library</h1>
        <p className="mt-2 text-sm text-[#6e6e73]">My flight history, searchable by date, location, tags, and calculated risk.</p>
      </div>
      <section className="rounded-lg border border-black/[0.08] bg-[#f5f5f7] p-5">
        <h2 className="text-lg font-semibold text-[#1d1d1f]">What this page does</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6e6e73]">
          Flights is the archive of every uploaded DJI flight record. Each card opens a full replay with the map path, timeline, battery and speed charts, weather joins, and model-generated insights for that specific flight.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Explainer title="Replay" body="See the route, takeoff, landing, and key telemetry moments on the map." />
          <Explainer title="Compare" body="Review distance, duration, battery used, drain rate, and risk estimate." />
          <Explainer title="Learn" body="Use each flight as training history so predictions improve as the dataset grows." />
        </div>
      </section>
      {backendSyncing && !flights.length ? (
        <section className="rounded-lg border border-black/[0.08] bg-white p-8 text-center">
          <p className="text-sm font-medium text-[#0066cc]">Syncing saved flight records</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#1d1d1f]">Loading the shared Supabase dataset.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6e6e73]">
            New browsers do not have my local cache yet, so AeroStats AI is pulling the stored flights from the backend.
          </p>
        </section>
      ) : !flights.length ? (
        <EmptyState title="No flights imported yet." body="My first supported flight log will create the initial replay, metrics, and model-training record." />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-black/[0.08] bg-[#ffffff] p-4 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, location, tag, or date" className="min-h-10 flex-1 rounded-md border border-[#d2d2d7] bg-[#ffffff] px-3 text-sm text-[#1d1d1f] outline-none focus:border-[#0071e3]" />
            <select value={risk} onChange={(event) => setRisk(event.target.value)} className="min-h-10 rounded-md border border-[#d2d2d7] bg-[#ffffff] px-3 text-sm text-[#1d1d1f]">
              <option value="all">All risk levels</option>
              <option value="low">Low risk</option>
              <option value="medium">Medium risk</option>
              <option value="high">High risk</option>
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {filtered.map((flight) => <FlightCard key={flight.id} flight={flight} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Explainer({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md bg-white p-4 ring-1 ring-black/[0.06]">
      <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#6e6e73]">{body}</p>
    </div>
  );
}
