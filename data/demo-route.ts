// Demo route for indoor demos: approximate stops along a Causeway Bay →
// Happy Valley run. Coordinates are approximate — for the live pitch,
// replace with a real route via lib/toolhub.ts getBusRoute() (see README).
import type { Stop } from "@/hooks/useRideTracker";

export const DEMO_ROUTE_NAME = "Demo GMB · Causeway Bay → Happy Valley";

export const DEMO_STOPS: Stop[] = [
  { seq: 1, name: { en: "Percival Street", tc: "波斯富街" }, lat: 22.2795, lng: 114.1830 },
  { seq: 2, name: { en: "Times Square", tc: "時代廣場" }, lat: 22.2783, lng: 114.1821 },
  { seq: 3, name: { en: "Canal Road Flyover", tc: "堅拿道天橋" }, lat: 22.2770, lng: 114.1815 },
  { seq: 4, name: { en: "Wong Nai Chung Road", tc: "黃泥涌道" }, lat: 22.2735, lng: 114.1826 },
  { seq: 5, name: { en: "Racecourse", tc: "馬場" }, lat: 22.2710, lng: 114.1836 },
  { seq: 6, name: { en: "Happy Valley Terminus", tc: "跑馬地總站" }, lat: 22.2680, lng: 114.1845 },
];
