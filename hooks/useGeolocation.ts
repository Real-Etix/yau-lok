"use client";

import { useEffect, useState } from "react";
import type { LatLng } from "@/lib/geo";

export function useGeolocation(enabled: boolean) {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device");
      return;
    }
    if (!window.isSecureContext) {
      setError("GPS needs HTTPS — open the deployed URL, not a LAN address");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setError(null);
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setAccuracy(p.coords.accuracy);
      },
      (e) => setError(e.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { position, accuracy, error };
}

/**
 * Keep the screen awake while active (mobile browsers suspend JS + GPS when
 * the screen sleeps — fatal mid-ride). Re-acquires on tab re-focus.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // e.g. low battery mode — non-fatal
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
