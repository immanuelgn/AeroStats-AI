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
        <h1 className="text-3xl font-semibold text-[#1d1d1f]">Flight library</h1>
        <p className="mt-2 text-sm text-[#6e6e73]">My flight history, searchable by date, location, tags, and calculated risk.</p>
      </div>
      {!flights.length ? (
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
