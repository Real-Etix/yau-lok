// Ask the open web a question the structured feeds can't answer —
// service hours, last departures, diversions, holiday timetables.
//
// Two HKGAI hubs in one call: Agenthub searches and scrapes, then Modelhub
// condenses the sourced material into one line a rider can act on.

import { chat, hkgaiConfigured } from "@/lib/hkgai";

const AGENT_URL =
  process.env.HKGAI_AGENT_URL ?? "https://search-agent.prod.hkchat.app/v1";
const APP_NAME = process.env.HKGAI_APP_NAME;
const APP_KEY = process.env.HKGAI_APP_KEY;

const SUMMARY_PROMPT = `You answer one practical question for a bus passenger in Hong Kong who does not read Chinese.
You are given web research (possibly Chinese source material). Reply in strict JSON:
{"answer":"<one or two short English sentences answering the question directly>","confident":<true|false>}
Rules:
- Lead with the concrete fact (times, yes/no). No preamble.
- If the sources disagree or don't cover it, say so plainly and set confident false.
- Never invent times or route numbers.`;

export async function POST(request: Request) {
  const { question } = await request.json();
  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "question required" }, { status: 400 });
  }
  if (!APP_NAME || !APP_KEY) {
    return Response.json(
      { error: "Agenthub not configured: set HKGAI_APP_NAME / HKGAI_APP_KEY" },
      { status: 501 },
    );
  }

  try {
    const res = await fetch(`${AGENT_URL.replace(/\/+$/, "")}/tool/search-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "App-Name": APP_NAME,
        "App-Key": APP_KEY,
      },
      body: JSON.stringify({ query: question }),
    });
    if (!res.ok) {
      return Response.json(
        { error: `Agenthub ${res.status}` },
        { status: 502 },
      );
    }
    const body = await res.json();
    const research: string = [body?.data?.reasoning, body?.data?.content]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 12000);
    // The search agent sometimes cites social posts for transport facts.
    // Show official/transport sources only — a bus timetable sourced to an
    // Instagram reel destroys more trust than showing no source at all.
    const TRUSTED =
      /(\.gov\.hk|hkemobility|td\.gov|16seats\.net|hkbus\.fandom|mtr\.com|kmb\.hk|citybus|nlb\.com|hongkongextras|openrice)/i;
    const JUNK = /(instagram|facebook|twitter|x\.com|tiktok|youtube|xiaohongshu|threads\.net)/i;
    const sources: string[] = (body?.data?.used_urls ?? [])
      .filter((u: string) => TRUSTED.test(u) && !JUNK.test(u))
      .slice(0, 3);

    if (!hkgaiConfigured()) {
      return Response.json({ answer: research.slice(0, 400), sources });
    }

    const raw = await chat([
      { role: "system", content: SUMMARY_PROMPT },
      { role: "user", content: `Question: ${question}\n\nResearch:\n${research}` },
    ]);
    const parsed = JSON.parse(
      raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
    );
    return Response.json({ ...parsed, sources });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Agenthub request failed" },
      { status: 502 },
    );
  }
}
