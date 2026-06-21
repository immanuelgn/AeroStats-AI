"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-states/EmptyState";
import { FlightCard } from "@/components/flights/FlightCard";
import { useUploadedData } from "@/lib/storage/DataProvider";

export default function FlightsPage() {
  const { flights } = useUploadedData();
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
        <h1 className="text-3xl font-semibold text-[#f5f3ec]">Flight library</h1>
        <p className="mt-2 text-sm text-[#a9b0a6]">Imported flights are stored in localStorage for this MVP.</p>
      </div>
      {!flights.length ? (
        <EmptyState title="No flights imported yet." body="Upload a CSV or JSON telemetry file to create your first flight card." />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#171a18] p-4 sm:flex-row">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, location, tag, or date" className="min-h-10 flex-1 rounded-md border border-[#303831] bg-[#111411] px-3 text-sm text-[#f5f3ec] outline-none focus:border-[#98b58a]" />
            <select value={risk} onChange={(event) => setRisk(event.target.value)} className="min-h-10 rounded-md border border-[#303831] bg-[#111411] px-3 text-sm text-[#f5f3ec]">
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
