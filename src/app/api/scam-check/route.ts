import { NextResponse } from "next/server";
import { callGeminiJSON, GeminiConfigError } from "@/lib/gemini";
import { logEvent } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ScamResult {
  verdict: "SCAM" | "SUSPICIOUS" | "LIKELY_SAFE";
  confidence: number; // 0-100
  summary: string;
  redFlags: { tactic: string; explanation: string }[];
  advice: string[];
}

function buildPrompt(message: string): string {
  return `You are a fraud analyst for a Nigerian bank. Analyse the message below for signs of a scam or social-engineering attempt. Focus on INTENT and manipulation tactics (false urgency, authority impersonation, requests a real bank would never make such as asking for OTP/PIN/BVN or full card details, unrealistic returns, suspicious links), not just keywords.

Return ONLY a JSON object with exactly these fields:
{
  "verdict": one of "SCAM" | "SUSPICIOUS" | "LIKELY_SAFE",
  "confidence": integer 0-100,
  "summary": one plain-language sentence a worried customer can understand,
  "redFlags": array of { "tactic": short label, "explanation": one sentence } (empty if none),
  "advice": array of 2-3 short plain-language actions the user should take
}

Be warm and clear, not technical. Nigerian context (banks: GTBank, Access, Zenith, UBA, Union Bank; NIBSS; BVN).

MESSAGE:
"""
${message.slice(0, 4000)}
"""`;
}

export async function POST(req: Request) {
  const body = await req.json();
  const message: string = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  }

  try {
    const result = await callGeminiJSON<ScamResult>(buildPrompt(message));

    await logEvent({
      type: "SCAM_CHECK",
      summary: `Scam Check: ${result.verdict} (${result.confidence}% confidence).`,
      tier:
        result.verdict === "SCAM"
          ? "HOLD"
          : result.verdict === "SUSPICIOUS"
            ? "SOFT_CHALLENGE"
            : "PASS",
      detail: { verdict: result.verdict, flags: result.redFlags?.length ?? 0 },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      return NextResponse.json(
        {
          error:
            "Scam Check needs a Gemini API key. Add GEMINI_API_KEY to the server environment to enable it.",
          configMissing: true,
        },
        { status: 503 }
      );
    }
    console.error("Scam Check failed:", err);
    return NextResponse.json(
      { error: "Sentinel couldn't analyse that message. Please try again." },
      { status: 502 }
    );
  }
}
