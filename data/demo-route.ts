// Real GMB 4C snapshot (HKGAI Toolhub transit_route_detail), bundled so the
// app has a correct route offline and before any lookup. Reload live data
// any time with the route-code box.
import type { Stop } from "@/hooks/useRideTracker";

export const DEMO_ROUTE_NAME = "GMB 4C · Aberdeen (Shek Pai Wan) → Causeway Bay (Cannon Street)";

export const DEMO_STOPS: Stop[] = [
  { seq: 1, name: { en: "Shek Pai Wan Estate Public Transport Interchange", tc: "石排灣邨公共運輸交匯處" }, lat: 22.249805, lng: 114.157383 },
  { seq: 2, name: { en: "Nam Ning Street, outside Hoi Tsing Court", tc: "南寧街,海晶閣外" }, lat: 22.248930, lng: 114.153880 },
  { seq: 3, name: { en: "No.178 Aberdeen Main Road", tc: "香港仔大道178號" }, lat: 22.248995, lng: 114.155685 },
  { seq: 4, name: { en: "Wong Chuk Hang Road, house no. 23", tc: "黃竹坑道23號" }, lat: 22.248564, lng: 114.163514 },
  { seq: 5, name: { en: "49 Wong Chuk Hang Road", tc: "黃竹坑道49號" }, lat: 22.249367, lng: 114.167707 },
  { seq: 6, name: { en: "Wong Chuk Hang Road, Eastbound Bus Bay Near Aberdeen Tunnel", tc: "黃竹坑道, 近香港仔隧道巴士站" }, lat: 22.249942, lng: 114.175487 },
  { seq: 7, name: { en: "Lockhart Road, outside Causeway Bay Plaza Phase 1", tc: "駱克道,銅鑼灣廣場一期外" }, lat: 22.280479, lng: 114.182614 },
  { seq: 8, name: { en: "Near President Theatre, Cannon Street", tc: "景隆街,近總統戲院" }, lat: 22.281466, lng: 114.183550 },
];
