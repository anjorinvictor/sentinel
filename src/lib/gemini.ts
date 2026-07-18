/**
 * Minimal server-side Gemini client. We call the Generative Language REST API
 * directly with fetch — no SDK dependency, so there is nothing to break on
 * version drift and the exact request is easy to audit. The API key is read
 * from the server environment and NEVER shipped to the client.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export class GeminiConfigError extends Error {}

/**
 * Send a prompt to Gemini and return the model's text response. When
 * `json` is true we ask Gemini to emit application/json and the caller parses it.
 */
export async function callGemini(
  prompt: string,
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiConfigError(
      "GEMINI_API_KEY is not set. Add it in your environment to enable AI features."
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned an empty response.");
  return text;
}

/** Call Gemini expecting JSON, and parse it defensively. */
export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const raw = await callGemini(prompt, { json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Occasionally a model wraps JSON in prose/markdown fences; recover the object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Could not parse Gemini JSON response.");
  }
}
