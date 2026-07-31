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
  /** Pulse the destination marker (stop is coming up) */
  urgent?: boolean;
  /** Taller map for the riding phase */
  tall?: boolean;
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
  urgent,
  tall,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const routeLayerRef = useRef<(CircleMarker | Polyline)[]>([]);
  const busRef = useRef<Marker | null>(null);
  const accuracyRef = useRef<Circle | null>(null);
  const fittedStopsRef = useRef<Stop[] | null>(null);
  const ridingRef = useRef(riding);
  ridingRef.current = riding;
  const zoomedForRideRef = useRef(false);
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
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __map?: LeafletMap }).__map = map;
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Leaflet measures the container at init; if the layout settles afterwards
  // (fonts, flex sizing, phase switch) tiles gray out and fitBounds is wrong.
  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      // Don't yank the view back to the whole route while following the bus.
      if (ridingRef.current) return;
      const poly = routeLayerRef.current.find(
        (l) => "getBounds" in l,
      ) as Polyline | undefined;
      if (poly) map.fitBounds(poly.getBounds(), { padding: [20, 20] });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [ready]);

  // Switching between the waiting and riding layouts changes the map's box.
  // One immediate measure isn't enough: the flex column is still settling, so
  // Leaflet would request tiles for a stale width and leave the rest grey.
  // Measure now, next frame, and once more after the transition lands.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    const raf = requestAnimationFrame(() => map.invalidateSize());
    const t1 = setTimeout(() => map.invalidateSize(), 150);
    const t2 = setTimeout(() => map.invalidateSize(), 500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, tall]);

  // (Re)draw route line + stops when the route or picks change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || stops.length < 2) return;
    for (const layer of routeLayerRef.current) layer.remove();
    routeLayerRef.current = [];

    const line: [number, number][] =
      path.length >= 2 ? path : stops.map((s) => [s.lat, s.lng]);
    const poly = L.polyline(line, { color: "#12507e", weight: 5, opacity: 0.85 });
    poly.addTo(map);
    routeLayerRef.current.push(poly);

    for (const s of stops) {
      const isBoard = s.seq === boardingSeq;
      const isDest = s.seq === destinationSeq;
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: isBoard || isDest ? 8 : 4,
        color: isBoard ? "#12507e" : isDest ? "#d7263d" : "#12507e",
        fillColor: isBoard ? "#12507e" : isDest ? "#d7263d" : "#ffffff",
        fillOpacity: 1,
        weight: 2,
        className: isDest && urgent ? "stop-pulse" : undefined,
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
  }, [ready, stops, path, boardingSeq, destinationSeq, waitingEtaLabel, urgent]);

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
      zoomedForRideRef.current = false;
      return;
    }
    // GPS accuracy halo (live mode only)
    if (typeof accuracyM === "number" && accuracyM > 0) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle([position.lat, position.lng], {
          radius: accuracyM,
          color: "#12507e",
          weight: 1,
          fillColor: "#12507e",
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
          className: "bus-marker",
          html:
            '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" ' +
            'style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.45))">' +
            '<rect x="1" y="1" width="22" height="22" rx="7" fill="#d7263d" stroke="#fff" stroke-width="2"/>' +
            '<path d="M7 8.5h10v5.5H7z" fill="#fff"/>' +
            '<circle cx="9" cy="16" r="1.5" fill="#fff"/><circle cx="15" cy="16" r="1.5" fill="#fff"/>' +
            '</svg>',
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      busRef.current.setLatLng([position.lat, position.lng]);
    }
    // Boarding zooms in from the route overview to street level once, so the
    // rider can see the next couple of stops; after that just follow.
    if (!zoomedForRideRef.current) {
      zoomedForRideRef.current = true;
      // Not animated: position ticks every 250 ms, and the next panTo would
      // interrupt an in-flight zoom animation, stranding the map at the
      // route-overview zoom instead of street level.
      map.setView([position.lat, position.lng], 15, { animate: false });
    } else {
      map.panTo([position.lat, position.lng], { animate: true });
    }
  }, [ready, position, riding, accuracyM]);

  // Two elements on purpose: React styles the outer one, Leaflet owns the
  // inner one. Sharing a single div lets a React re-render overwrite the
  // classes Leaflet adds (leaflet-container et al), which silently breaks
  // tile positioning — the route line still draws, but the map goes white.
  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border-2 border-ink bg-[var(--rule)] ${
        tall ? "h-full min-h-40 flex-1" : "h-52"
      }`}
    >
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
