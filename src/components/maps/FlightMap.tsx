"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type { FlightEvent, TelemetryPoint } from "@/types";

const droneIcon = L.divIcon({
  className: "",
  html: '<div style="width:18px;height:18px;border-radius:50%;background:#1d1d1f;border:4px solid #0071e3;box-shadow:0 0 0 6px rgba(0,113,227,.18)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function FlightMap({
  telemetry,
  currentIndex,
  events,
  heightClassName = "h-[520px]",
}: {
  telemetry: TelemetryPoint[];
  currentIndex: number;
  events: FlightEvent[];
  heightClassName?: string;
}) {
  const points = telemetry.map((point) => [point.latitude, point.longitude] as [number, number]);
  const current = telemetry[Math.min(currentIndex, telemetry.length - 1)] ?? telemetry[0];
  const center = points[0] ?? [43.6532, -79.3832];

  if (!points.length) {
    return <div className={`flex ${heightClassName} items-center justify-center rounded-lg border border-[#d2d2d7] bg-[#ffffff] text-sm text-[#6e6e73]`}>Map path requires latitude and longitude.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#d2d2d7] bg-[#ffffff]">
      <MapContainer center={center} zoom={15} scrollWheelZoom className={`${heightClassName} w-full`}>
        <TileLayer attribution="OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={points} />
        <Polyline positions={points} pathOptions={{ color: "#0071e3", weight: 4, opacity: 0.9 }} />
        <CircleMarker center={points[0]} radius={7} pathOptions={{ color: "#0066cc", fillColor: "#0071e3", fillOpacity: 1 }}>
          <Popup>Start marker</Popup>
        </CircleMarker>
        <CircleMarker center={points[points.length - 1]} radius={7} pathOptions={{ color: "#0071e3", fillColor: "#0071e3", fillOpacity: 1 }}>
          <Popup>Landing marker</Popup>
        </CircleMarker>
        {events.map((event) => {
          const point = telemetry[event.telemetryIndex];
          if (!point) return null;
          return (
            <CircleMarker key={event.id} center={[point.latitude, point.longitude]} radius={5} pathOptions={{ color: "#1d1d1f", fillColor: "#ffffff", fillOpacity: 0.9 }}>
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
