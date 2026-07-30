// Taxi fare estimation and polyline decoding.

/**
 * Hong Kong URBAN (red) taxi scale, as published by the Transport Department
 * following the July 2024 increase. Kept as data, not scattered constants, so
 * it is easy to check against td.gov.hk and correct in one place.
 *
 * VERIFY BEFORE RELYING ON IT: fare scales change by government order, and a
 * wrong figure shown to a passenger mid-ride is worse than no figure.
 */
export const URBAN_TAXI = {
  flagfallHkd: 29,
  flagfallCoversMeters: 2000,
  /** charged per 200 m (or per minute of waiting) */
  incrementMeters: 200,
  /** higher rate until the meter reaches the step-down threshold */
  earlyIncrementHkd: 2.1,
  stepDownAtHkd: 102.5,
  lateIncrementHkd: 1.4,
};

export type FareEstimate = {
  low: number;
  high: number;
  /** metered fare for the distance alone, before traffic and extras */
  base: number;
};

/**
 * Estimate a metered fare from driving distance. Returns a RANGE, because the
 * meter also ticks while stationary — Hong Kong traffic, lights and queues can
 * add a lot — and tolls, luggage and pet surcharges are excluded entirely.
 */
export function estimateUrbanFare(
  distanceMeters: number,
  durationSeconds?: number,
): FareEstimate {
  const s = URBAN_TAXI;
  let fare = s.flagfallHkd;
  let remaining = Math.max(0, distanceMeters - s.flagfallCoversMeters);

  while (remaining > 0) {
    const rate = fare < s.stepDownAtHkd ? s.earlyIncrementHkd : s.lateIncrementHkd;
    fare += rate;
    remaining -= s.incrementMeters;
  }
  const base = Math.round(fare * 10) / 10;

  // Rough allowance for time spent not moving. Assume a free-flow speed of
  // 30 km/h; anything slower is meter-ticking time.
  const freeFlowSeconds = (distanceMeters / 1000 / 30) * 3600;
  const slowSeconds = Math.max(0, (durationSeconds ?? freeFlowSeconds) - freeFlowSeconds);
  const waitingCharge = (slowSeconds / 60) * s.earlyIncrementHkd;

  return {
    base,
    low: Math.round(base),
    high: Math.round(base + waitingCharge + base * 0.15),
  };
}

/** Decode a Google-encoded polyline into [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}
