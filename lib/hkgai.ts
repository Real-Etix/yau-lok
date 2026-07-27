// Server-side HKGAI Studio client (Modelhub is OpenAI-compatible).
// Set credentials in .env.local — see .env.example.

// Accept the base URL with or without the /v1 suffix.
const BASE_URL = process.env.HKGAI_BASE_URL
  ? process.env.HKGAI_BASE_URL.replace(/\/+$/, "").replace(/\/v1$/, "") + "/v1"
  : undefined;
const API_KEY = process.env.HKGAI_API_KEY;
const CHAT_MODEL = process.env.HKGAI_CHAT_MODEL ?? "hkgai-v1";

export function hkgaiConfigured(): boolean {
  return Boolean(BASE_URL && API_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chat(messages: ChatMessage[]): Promise<string> {
  if (!BASE_URL || !API_KEY) {
    throw new Error(
      "HKGAI not configured: set HKGAI_BASE_URL and HKGAI_API_KEY in .env.local",
    );
  }
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: CHAT_MODEL, messages, temperature: 0.3 }),
  });
  if (!res.ok) {
    throw new Error(`HKGAI chat failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.choices[0].message.content as string;
}
