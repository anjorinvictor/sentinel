/**
 * Minimal server-side Gemini client. We call the Generative Language REST API
 * directly with fetch — no SDK dependency, so there is nothing to break on
 * version drift and the exact request is easy to audit. The API key is read
 * from the server environment and NEVER shipped to the client.
 */

// Candidate models tried in order (first that works wins). A specific model can
// be forced with GEMINI_MODEL. This keeps Scam Check working across whatever
// model names are currently available to the key.
const MODEL_CANDIDATES = process.env.GEMINI_MODEL
  ? [process.env.GEMINI_MODEL]
  : [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-flash-latest",
      "gemini-1.5-flash",
      "gemini-pro-latest",
    ];

export class GeminiConfigError extends Error {}

/**
 * Send a prompt to Gemini and return the model's text response. Tries each
 * candidate model until one succeeds; throws with the last error otherwise.
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

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  });

  let lastError = "";
  for (const model of MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch (e) {
      lastError = `network error: ${(e as Error).message}`;
      continue;
    }

    if (res.ok) {
      const data = await res.json();
      const text: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
      lastError = "empty response";
      continue;
    }

    const detail = await res.text().catch(() => "");
    lastError = `model ${model} -> ${res.status}: ${detail.slice(0, 200)}`;

    // An invalid/expired key will fail identically for every model — stop early.
    if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(detail)) {
      throw new Error(`Gemini rejected the API key. ${detail.slice(0, 160)}`);
    }
    if (res.status === 403) {
      throw new Error(`Gemini access denied (403). ${detail.slice(0, 160)}`);
    }
    // Otherwise (404 model-not-found, 429, etc.) try the next candidate.
  }

  throw new Error(`Gemini call failed. ${lastError}`);
}

/** Call Gemini expecting JSON, and parse it defensively. */
export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const raw = await callGemini(prompt, { json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error("Could not parse Gemini JSON response.");
  }
}
