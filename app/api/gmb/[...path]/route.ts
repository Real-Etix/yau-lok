// Proxy for the HK government GMB real-time API (avoids browser CORS issues).
const UPSTREAM = "https://data.etagmb.gov.hk";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const safe = path.map(encodeURIComponent).join("/");
  const res = await fetch(`${UPSTREAM}/${safe}`, {
    headers: { Accept: "application/json" },
    // Route/stop geometry rarely changes; cache for an hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    return Response.json(
      { error: `GMB upstream ${res.status}` },
      { status: res.status },
    );
  }
  return Response.json(await res.json());
}
