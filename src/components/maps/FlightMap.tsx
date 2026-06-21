"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { FlightEvent, TelemetryPoint } from "@/types";

const droneIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#f5f3ec;border:4px solid #98b58a;box-shadow:0 0 0 6px rgba(152,181,138,.18)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function FlightMap({ telemetry, currentIndex, events }: { telemetry: TelemetryPoint[]; currentIndex: number; events: FlightEvent[] }) {
  const points = telemetry.map((point) => [point.latitude, point.longitude] as [number, number]);
  const current = telemetry[Math.min(currentIndex, telemetry.length - 1)] ?? telemetry[0];
  const center = points[0] ?? [43.6532, -79.3832];

  if (!points.length) {
    return <div className="flex h-[520px] items-center justify-center rounded-lg border border-[#303831] bg-[#111411] text-sm text-[#a9b0a6]">Map path requires latitude and longitude.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#303831] bg-[#111411]">
      <MapContainer center={center} zoom={15} scrollWheelZoom className="h-[520px] w-full">
        <TileLayer attribution="OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        <Polyline positions={points} pathOptions={{ color: "#98b58a", weight: 4, opacity: 0.9 }} />
        <CircleMarker center={points[0]} radius={7} pathOptions={{ color: "#c8d8bd", fillColor: "#98b58a", fillOpacity: 1 }}>
          <Popup>Start marker</Popup>
        </CircleMarker>
        <CircleMarker center={points[points.length - 1]} radius={7} pathOptions={{ color: "#d5a85f", fillColor: "#d5a85f", fillOpacity: 1 }}>
          <Popup>Landing marker</Popup>
        </CircleMarker>
        {events.map((event) => {
          const point = telemetry[event.telemetryIndex];
          if (!point) return null;
          return (
            <CircleMarker key={event.id} center={[point.latitude, point.longitude]} radius={5} pathOptions={{ color: "#f5f3ec", fillColor: "#171a18", fillOpacity: 0.9 }}>
              <Popup>{event.label}</Popup>
            </CircleMarker>
          );
        })}
        {current ? (
          <Marker position={[current.latitude, current.longitude]} icon={droneIcon}>
            <Popup>Replay position</Popup>
          </Marker>
        ) : null}
      </MapContainer>
    </div>
  );
}

function FitBounds({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [30, 30] });
  }, [map, points]);
  return null;
}
