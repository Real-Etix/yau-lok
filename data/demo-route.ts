// Demo route for indoor demos: approximate stops along a Causeway Bay →
// Happy Valley run. Coordinates are approximate — for the live pitch,
// replace with real stops fetched via lib/gmb.ts (see README).
import type { GmbStop } from "@/lib/gmb";

export const DEMO_ROUTE_NAME = "Demo GMB · Causeway Bay → Happy Valley";

export const DEMO_STOPS: GmbStop[] = [
  { stopId: 1, seq: 1, name: { en: "Percival Street", tc: "波斯富街" }, lat: 22.2795, lng: 114.1830 },
  { stopId: 2, seq: 2, name: { en: "Times Square", tc: "時代廣場" }, lat: 22.2783, lng: 114.1821 },
  { stopId: 3, seq: 3, name: { en: "Canal Road Flyover", tc: "堅拿道天橋" }, lat: 22.2770, lng: 114.1815 },
  { stopId: 4, seq: 4, name: { en: "Wong Nai Chung Road", tc: "黃泥涌道" }, lat: 22.2735, lng: 114.1826 },
  { stopId: 5, seq: 5, name: { en: "Racecourse", tc: "馬場" }, lat: 22.2710, lng: 114.1836 },
  { stopId: 6, seq: 6, name: { en: "Happy Valley Terminus", tc: "跑馬地總站" }, lat: 22.2680, lng: 114.1845 },
];
