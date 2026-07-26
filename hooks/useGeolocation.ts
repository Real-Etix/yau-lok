"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { position, error };
}
