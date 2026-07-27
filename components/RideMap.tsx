"use client";

// Live route map (Leaflet + OpenStreetMap tiles, imperative — no react-leaflet).
// Shows the route line, all stops, boarding/destination highlights, and the
// moving minibus (the user's phone position while on board).

import { useEffect, useRef, useState } from "react";
import type {
  Map as LeafletMap,
  Circle,
  CircleMarker,
  Marker,
  Polyline,
} from "leaflet";
import type { LatLng } from "@/lib/geo";
import type { Stop } from "@/hooks/useRideTracker";

type Props = {
  stops: Stop[];
  path: [number, number][];
  position: LatLng | null;
  boardingSeq: number;
  destinationSeq: number | null;
  /** Only show + follow the bus marker while on board */
  riding: boolean;
  /** ETA label pinned to the boarding stop while waiting (no fake bus) */
  waitingEtaLabel?: string | null;
  /** GPS accuracy radius in meters (live mode only) — drawn around the bus */
  accuracyM?: number | null;
};

export default function RideMap({
  stops,
  path,
  position,
  boardingSeq,
  destinationSeq,
  riding,
  waitingEtaLabel,
  accuracyM,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<(CircleMarker | Polyline)[]>([]);
  const busRef = useRef<Marker | null>(null);
  const accuracyRef = useRef<Circle | null>(null);
  const fittedStopsRef = useRef<Stop[] | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  // Map creation is async (dynamic import) — draw effects wait on this.
  const [ready, setReady] = useState(false);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;
      const map = L.map(containerRef.current, { zoomControl: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      map.setView([22.28, 114.16], 12);
      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)draw route line + stops when the route or picks change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || stops.length < 2) return;
    for (const layer of routeLayerRef.current) layer.remove();
    routeLayerRef.current = [];

    const line: [number, number][] =
      path.length >= 2 ? path : stops.map((s) => [s.lat, s.lng]);
    const poly = L.polyline(line, { color: "#0f766e", weight: 4, opacity: 0.8 });
    poly.addTo(map);
    routeLayerRef.current.push(poly);

    for (const s of stops) {
      const isBoard = s.seq === boardingSeq;
      const isDest = s.seq === destinationSeq;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isBoard || isDest ? 8 : 4,
        color: isBoard ? "#4f46e5" : isDest ? "#dc2626" : "#0f766e",
        fillColor: isBoard ? "#818cf8" : isDest ? "#f87171" : "#ffffff",
        fillOpacity: 1,
        weight: 2,
      });
      if (isBoard && waitingEtaLabel) {
        marker.bindTooltip(waitingEtaLabel, {
          permanent: true,
          direction: "top",
          offset: [0, -8],
        });
      } else {
        marker.bindTooltip(
          `${s.seq}. ${s.name.en}${isBoard ? " (get on)" : isDest ? " (get off)" : ""}`,
        );
      }
      marker.addTo(map);
      routeLayerRef.current.push(marker);
    }
    // Zoom to the route only when the route itself changes — ETA label
    // refreshes must not yank the viewport.
    if (fittedStopsRef.current !== stops) {
      fittedStopsRef.current = stops;
      map.fitBounds(poly.getBounds(), { padding: [20, 20] });
    }
  }, [ready, stops, path, boardingSeq, destinationSeq, waitingEtaLabel]);

  // Move the minibus marker; follow it while riding.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!riding || !position) {
      busRef.current?.remove();
      busRef.current = null;
      accuracyRef.current?.remove();
      accuracyRef.current = null;
      return;
    }
    // GPS accuracy halo (live mode only)
    if (typeof accuracyM === "number" && accuracyM > 0) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle([position.lat, position.lng], {
          radius: accuracyM,
          color: "#4f46e5",
          weight: 1,
          fillColor: "#818cf8",
          fillOpacity: 0.15,
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng([position.lat, position.lng]);
        accuracyRef.current.setRadius(accuracyM);
      }
    } else {
      accuracyRef.current?.remove();
      accuracyRef.current = null;
    }
    if (!busRef.current) {
      busRef.current = L.marker([position.lat, position.lng], {
        icon: L.divIcon({
          className: "",
          html: '<div style="font-size:22px;line-height:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🚐</div>',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      busRef.current.setLatLng([position.lat, position.lng]);
    }
    map.panTo([position.lat, position.lng], { animate: true });
  }, [ready, position, riding, accuracyM]);

  return (
    <div
      ref={containerRef}
      className="h-56 w-full rounded-2xl border border-slate-200"
    />
  );
}
