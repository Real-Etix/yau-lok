// Server-side Toolhub access. The lib/toolhub.ts helpers are client-side and
// call our /api/toolhub proxy with relative URLs; route handlers and the MCP
// server need to reach Toolhub directly.

const BASE =
  process.env.HKGAI_TOOLHUB_URL ?? "https://toolhub.prod.hkchat.app/v1";
const APP_NAME = process.env.HKGAI_APP_NAME;
const APP_KEY = process.env.HKGAI_APP_KEY;

export function toolhubConfigured(): boolean {
  return Boolean(APP_NAME && APP_KEY);
}

export async function toolhubCall<T = unknown>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  if (!APP_NAME || !APP_KEY) {
    throw new Error("Toolhub not configured (HKGAI_APP_NAME / HKGAI_APP_KEY)");
  }
  const res = await fetch(`${BASE.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "App-Name": APP_NAME,
      "App-Key": APP_KEY,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  if (!res.ok || payload.success === false) {
    throw new Error(payload?.error?.message ?? `Toolhub ${res.status}`);
  }
  return payload.data as T;
}
