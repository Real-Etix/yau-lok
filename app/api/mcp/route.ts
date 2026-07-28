// Yau Lok as an MCP server.
//
// Toolhub gives agents Hong Kong's data; this gives them the *behaviour* built
// on top of it — which minibus to take, and exactly what to shout to get off.
// Minimal JSON-RPC 2.0 over HTTP (MCP Streamable HTTP), no SDK needed.

import { toolhubCall, toolhubConfigured } from "@/lib/toolhub-server";

const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "plan_minibus_journey",
    description:
      "Plan a Hong Kong public-transport journey between two places, ranked with green-minibus (GMB) options first. Returns duration, fare and the route code to board.",
    inputSchema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Starting place name, e.g. 'Shouson Hill Road'" },
        destination: { type: "string", description: "Destination place name, e.g. 'Causeway Bay Jaffe Road'" },
      },
      required: ["origin", "destination"],
    },
  },
  {
    name: "minibus_alight_plan",
    description:
      "For a Hong Kong minibus route and a destination stop, return the stop sequence, the distance at which a passenger should call out, and the exact colloquial Cantonese phrase to shout — Hong Kong minibuses have no bells or stop announcements.",
    inputSchema: {
      type: "object",
      properties: {
        route: { type: "string", description: "Route code, e.g. '4C'" },
        company: {
          type: "string",
          description: "Operator: gmb (green minibus), kmb, citybus, nlb",
          default: "gmb",
        },
        destination_stop: {
          type: "string",
          description: "Name (English or Chinese) of the stop to get off at",
        },
      },
      required: ["route", "destination_stop"],
    },
  },
];

const APPROACH_M = 400;
const ARRIVE_M = 150;

type RawStop = {
  seq: number;
  name_en: string;
  name_tc: string;
  lat: number;
  lng: number;
};

async function planMinibusJourney(origin: string, destination: string) {
  type Result = {
    duration_seconds: number;
    distance_meters: number;
    fare: { amount: number | null; segments: { mode: string; route_code: string }[] } | null;
  };
  const data = await toolhubCall<{ results: Result[] }>("/transport/route", {
    origin,
    destination,
  });
  const options = (data.results ?? []).map((r) => {
    const segments = r.fare?.segments ?? [];
    return {
      minutes: Math.round(r.duration_seconds / 60),
      km: +(r.distance_meters / 1000).toFixed(1),
      fare_hkd: r.fare?.amount ?? null,
      legs: segments.map((s) => ({ operator: s.mode, route: s.route_code })),
      has_minibus: segments.some((s) => s.mode === "gmb"),
    };
  });
  options.sort((a, b) =>
    a.has_minibus !== b.has_minibus
      ? a.has_minibus
        ? -1
        : 1
      : a.minutes - b.minutes,
  );
  return { options: options.slice(0, 5) };
}

async function minibusAlightPlan(
  route: string,
  company: string,
  destinationStop: string,
) {
  const dirs = ["outbound", "inbound"] as const;
  for (const direction of dirs) {
    try {
      const data = await toolhubCall<{
        results: { route_code: string; orig_en: string; dest_en: string; stops: RawStop[] }[];
      }>("/transport/transit/route/detail", { route, company, direction });
      const r = data.results?.[0];
      if (!r?.stops?.length) continue;
      const needle = destinationStop.toLowerCase();
      const stop = r.stops.find(
        (s) =>
          s.name_en?.toLowerCase().includes(needle) ||
          s.name_tc?.includes(destinationStop),
      );
      if (!stop) continue;
      return {
        route: `${company.toUpperCase()} ${r.route_code}`,
        direction,
        origin: r.orig_en,
        terminus: r.dest_en,
        destination_stop: {
          seq: stop.seq,
          name_en: stop.name_en,
          name_tc: stop.name_tc,
          lat: stop.lat,
          lng: stop.lng,
        },
        total_stops: r.stops.length,
        alert: {
          get_ready_within_meters: APPROACH_M,
          call_out_within_meters: ARRIVE_M,
          advice:
            "Call out as the bus approaches the stop — the driver needs a few seconds to pull in.",
        },
        say: {
          cantonese: "唔該，有落！",
          jyutping: "m4 goi1, jau5 lok6!",
          english: "Excuse me, getting off!",
          alternative_cantonese: "唔該，巴士站有落！",
          alternative_english: "Please stop at the bus stop ahead",
        },
      };
    } catch {
      // try the other direction
    }
  }
  throw new Error(
    `No stop matching "${destinationStop}" on ${company} route ${route}`,
  );
}

async function callTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "plan_minibus_journey":
      return planMinibusJourney(String(args.origin), String(args.destination));
    case "minibus_alight_plan":
      return minibusAlightPlan(
        String(args.route),
        String(args.company ?? "gmb"),
        String(args.destination_stop),
      );
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const { id, method, params } = body ?? {};
  const reply = (result: unknown) =>
    Response.json({ jsonrpc: "2.0", id, result });
  const fail = (code: number, message: string) =>
    Response.json({ jsonrpc: "2.0", id, error: { code, message } });

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "yau-lok", version: "1.0.0" },
      });

    case "notifications/initialized":
      return new Response(null, { status: 204 });

    case "tools/list":
      return reply({ tools: TOOLS });

    case "tools/call": {
      if (!toolhubConfigured()) {
        return fail(-32603, "Toolhub credentials not configured");
      }
      try {
        const data = await callTool(
          params?.name,
          (params?.arguments ?? {}) as Record<string, unknown>,
        );
        return reply({
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
      } catch (e) {
        return reply({
          content: [
            {
              type: "text",
              text: e instanceof Error ? e.message : "tool failed",
            },
          ],
          isError: true,
        });
      }
    }

    default:
      return fail(-32601, `Method not found: ${method}`);
  }
}

export async function GET() {
  return Response.json({
    name: "yau-lok",
    protocol: "mcp",
    protocolVersion: PROTOCOL_VERSION,
    transport: "streamable-http",
    tools: TOOLS.map((t) => t.name),
    hint: "POST JSON-RPC 2.0 here: initialize, tools/list, tools/call",
  });
}
