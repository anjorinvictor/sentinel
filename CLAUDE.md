# CLAUDE.md — Sentinel

This file is the persistent context for this project. Read it fully at the start of every session before writing code.

## What we're building

**Sentinel** — an AI security & personalization layer for digital banking, built for the **HackX 6.0** hackathon (powered by Union Bank & ECX, Nigeria). This is a 7-day build; the submission deadline is **Sunday July 19, 2026, 11:59 PM WAT**. Only the top 5 of 13 teams advance to pitch to Union Bank executives.

### The core thesis (this governs every decision)
**Personalization IS security.** One per-user behavioral model — the user's "financial fingerprint" — is learned from their transaction history, and that *same model* does two jobs at once:
1. **Personalizes** the banking experience (insights, nudges).
2. **Protects** the user (real-time anomaly scoring on transactions + scam detection).

The better the model knows the user, the smoother AND safer their banking becomes. These are not two systems — they are one system. Every feature must reinforce this thesis. If a feature doesn't serve personalization, protection, or transparency, it does not belong in this build.

## The three pillars (this is the ENTIRE product — do not add a fourth)

1. **The Financial Fingerprint** — a per-user behavioral model learned from that user's stored transaction history: typical amount (mean + stddev), active hours (hour-of-day distribution), known recipients (the set they've paid), and transaction velocity (frequency). Everything else consumes this.

2. **The Guardian** — two parts:
   - **Transaction scoring**: every transfer is scored in real time against the user's own fingerprint. Matches their pattern → passes with zero friction. Violates it on multiple dimensions → held before money moves, with a plain-language explanation. High-risk tiers offer a **24-hour cooling-off** option (removes the scammer's urgency weapon).
   - **Scam Check**: user pastes a suspicious message; an LLM analyzes *intent* (false urgency, impersonation, unrealistic returns, credential requests) and returns a verdict + itemized red flags in plain language.

3. **The Trust Panel** — shows the user everything the fingerprint knows about them, in human-readable form, with real edit/delete controls. Includes the **"delete my entire profile"** feature that visibly degrades protection when removed and restores it when rebuilt — this is our centerpiece demo proving the personalization data IS the protection.

## CRITICAL RULES (violating these loses the hackathon)

- **NO FAKE LOGIC.** The judging brief explicitly says: *"zero hardcoded dummy scripts mimicking real backend operations."* The scoring engine MUST compute from the user's actual stored transaction history. That means: z-score of the transaction amount against the user's real mean/stddev; checking the transaction hour against the user's real hour-of-day distribution; checking the recipient against the user's real known-recipient set; checking velocity against real recent transaction timestamps. **NO hardcoded thresholds standing in for learned behavior** (no `if (amount > 100000) return "fraud"`). Every score must be traceable to real arithmetic on real data, and I must be able to defend every line to a technical judge.

- **The AI calls must be real.** Scam Check and the plain-language explanations use a real LLM API call with a real prompt and real parsing of the response. No canned/hardcoded "AI" responses.

- **Explainability is mandatory.** Every score returns not just a number but the itemized reasons that produced it (which signals fired, and by how much). The bank needs auditability; the UI needs to show *why*.

- **Every intervention explains itself in warm, plain language.** Never a cryptic block. Security that cares, not security that accuses.

- **Honesty about simulation.** We simulate the *bank environment* (seeded transaction history, demo accounts). Sentinel's intelligence layer is fully real. The README, slides, and video must state this plainly. Never present simulated data as a live bank feed.

## Tech stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Charts:** Recharts
- **Icons:** lucide-react
- **Database:** Postgres via Neon (hosted — NOT SQLite; Vercel's filesystem is ephemeral). Use Prisma as the ORM for clean, auditable data access.
- **AI:** Google Gemini API, called **server-side only** (API key must never reach the client — a security product leaking its key is unacceptable). All AI calls go through Next.js API route handlers / server actions.
- **Deploy:** Vercel (frontend + API routes), Neon (DB).

## Architecture principle: two engines, one brain

- **Deterministic engine** (the scoring): pure TypeScript functions, fully testable, fully explainable. Lives in `/src/lib/scoring/`. This is where amount/time/recipient/velocity signals are computed and combined into a score + reasons. Write unit tests for this — it's our Technical Quality centerpiece.
- **Generative engine** (the LLM): Gemini, for scam-message semantic analysis and for phrasing anomaly explanations conversationally. Lives behind server-side API routes in `/src/app/api/`.

Deterministic where reliability and auditability matter; generative where language understanding matters.

## Design spec

Match the approved Lovable design (screenshots are the visual target):
- Dark theme: deep navy/charcoal base (#0B1220-ish background, #131C2E-ish cards)
- Single accent: warm gold/amber (#F0B429-ish) for primary actions and the Sentinel brand; a teal/cyan for "safe/verified" states
- Persistent left sidebar: **Dashboard, Transfer, Scam Check, Trust Panel, Activity**. Brand lockup at top: "Sentinel / UNION BANK" with a shield icon.
- Header strip: "SENTINEL · PERSONAL BANKING"
- Generous whitespace, rounded cards, soft shadows, smooth micro-interactions. Premium fintech feel.
- Currency: Naira (₦). Persona: **Amina Okafor**, Union Bank, realistic Nigerian recipients (Chicken Republic, PiggyVest, family members), realistic Nigerian banks (GTBank, Access, Zenith, UBA, Union Bank).
- Risk states: green "Normal" / amber "Reviewed" / red "Blocked". Show the anomaly score as an animated gauge on the challenge modal.

## Screens

1. **Dashboard** — balance card, "Sentinel is active and learning" status (days learned, transactions protected), 3 personalized AI insight cards, spending-by-category donut, recent transactions with risk badges.
2. **Transfer** — transfer form; on submit, real scoring. Low-risk → instant success with a brief "Sentinel verified" flash, no OTP. High-risk → full Security Challenge modal with animated score gauge, itemized reasons, named scam-pattern warning where relevant, and Cancel / "This is me" / 24h cooling-off actions. Include demo preset buttons to trigger safe vs risky instantly.
3. **Scam Check** — paste box, 3 example-scam chips (fake account suspension, investment 600%-in-9-days, fake BVN link), real LLM analysis → verdict (SCAM/SUSPICIOUS/LIKELY SAFE) + itemized red flags + "what you should do".
4. **Trust Panel** — the learned fingerprint shown human-readably (typical amount + range, active-hours bar chart, known recipients, categories, rhythm), each editable/deletable for real, a "why was this flagged" audit log, and the **delete-entire-profile** feature that degrades protection (Dashboard shows "no profile", Transfer can't score) with a Restore button.
5. **Activity / Protection Log** — filterable timeline of every Sentinel action (scored / flagged / scam check / cooling off / profile edit) with score, reason, outcome.

## Honest scope discipline

Only 40 of 100 judging points are code (Technical Quality + Execution). The other 60 are Idea Implementation, UX, and Presentation. So: build the real engine, deploy EARLY (get a live Vercel URL up on day 1 and keep it green), keep the three pillars tight, and don't add features. A working, beautiful, well-explained product beats a broken brilliant one.

## Build order (enforce this)

1. DB schema + seed a realistic, coherent 90-day transaction history for Amina (the stated fingerprint averages must actually match the seeded data).
2. The real scoring engine + unit tests. **This is built before UI polish.**
3. Gemini integration (Scam Check + explanations), server-side.
4. The five screens, wired to real endpoints.
5. Deploy hardening, README (architecture + how to test + what's real vs simulated).
6. Slides + 3-minute demo video (record the delete-profile-degrades-protection moment).

## Working agreement with me (the developer)

- Explain what you're about to do before large changes; I need to understand and defend this code.
- After building the scoring engine, walk me through the math so I can explain it to judges.
- Keep commits small and meaningful with clear messages (commit history is judged).
- When you hit a design decision with tradeoffs, surface it to me rather than silently picking.
- Never fake data to make something look done. If something isn't wired, say so.
