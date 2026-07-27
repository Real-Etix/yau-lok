// Proxy for HKGAI Toolhub REST tools (keeps App-Key server-side).
// Example: POST /api/toolhub/transport/transit/route/search
//   body {"route":"5","company":"gmb"}
// forwards to https://toolhub.prod.hkchat.app/v1/transport/transit/route/search
// Response is Toolhub's unified envelope: { success, data, error, metadata }.

const TOOLHUB_BASE =
  process.env.HKGAI_TOOLHUB_URL ?? "https://toolhub.prod.hkchat.app/v1";
const APP_NAME = process.env.HKGAI_APP_NAME;
const APP_KEY = process.env.HKGAI_APP_KEY;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  if (!APP_NAME || !APP_KEY) {
    return Response.json(
      { error: "Toolhub not configured: set HKGAI_APP_NAME / HKGAI_APP_KEY" },
      { status: 501 },
    );
  }
  const { path } = await params;
  const safe = path.map(encodeURIComponent).join("/");
  const res = await fetch(`${TOOLHUB_BASE.replace(/\/+$/, "")}/${safe}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "App-Name": APP_NAME,
      "App-Key": APP_KEY,
    },
    body: JSON.stringify(await request.json()),
  });
  return new Response(await res.text(), {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
}
