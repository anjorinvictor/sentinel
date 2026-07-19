# Sentinel

**It knows you, so it protects you.**

Sentinel is an AI security & personalization layer for digital banking, built for
**HackX 6.0** (powered by Union Bank & ECX, Nigeria). Its thesis: **personalization
*is* security.** One per-user behavioural model — the "financial fingerprint" — is
learned from a user's transaction history, and that *same* model both personalizes
their banking and protects them in real time. These are not two systems; they are one.

- 🔗 **Live app:** https://sentinel-tawny-three.vercel.app
- 📦 **Repo:** https://github.com/anjorinvictor/sentinel
- 👤 **Demo persona:** Amina Okafor · Union Bank · Naira (₦)

---

## What's real vs. simulated (read this first)

We are honest about the boundary, because the judging brief demands "zero hardcoded
dummy scripts mimicking real backend operations":

- **Simulated:** the *bank environment*. There is no live bank feed. We seed a
  coherent 90-day transaction history for the demo persona into a real Postgres
  database. This stands in for what a bank would expose via API.
- **Real:** Sentinel's *intelligence layer*.
  - The **scoring engine** (`src/lib/scoring/`) computes every risk score from the
    user's actual stored transactions using real statistics — z-scores, hour-of-day
    distributions, recipient-set membership, velocity. **No hardcoded naira
    thresholds** stand in for learned behaviour.
  - The **fingerprint** shown in the Trust Panel is literally the engine's output on
    the seeded rows — computed by the same `computeProfile()` the app scores against.
  - The **behavioural challenge** questions are generated from the user's *real*
    recipient history; the correct answer is never sent to the client.
  - **Scam Check** calls a real LLM (Google Gemini) server-side and parses its response.

---

## The three pillars

1. **The Financial Fingerprint** — the learned per-user model: typical amount
   (mean/std/median), active hours (hour-of-day histogram, anchored to WAT), known
   recipients, and transaction velocity.
2. **The Guardian** — real-time transaction scoring, a fingerprint-derived behavioural
   challenge, and Scam Check (LLM intent analysis).
3. **The Trust Panel** — see/edit/delete everything the fingerprint knows, including
   **"delete my entire profile"**, which visibly degrades protection (the Guardian can
   no longer score) and can be rebuilt from history with **Restore**.

## The five screens

| Screen | What it does |
|--------|--------------|
| **Dashboard** | Balance, "Sentinel is active and learning" status, 3 real personalized insights, spending-by-category donut, recent transactions with risk badges. |
| **Transfer** | Real-time scoring on every transfer. Low-risk passes instantly; risky transfers open a Security Challenge with an animated score gauge, itemized reasons, the behavioural challenge, and 24h cooling-off. |
| **Scam Check** | Paste a suspicious message → real Gemini intent analysis → verdict (SCAM / SUSPICIOUS / LIKELY SAFE) + itemized red flags + what to do. |
| **Trust Panel** | The learned fingerprint in human-readable form (typical amount, active-hours chart, known recipients, categories, rhythm), each editable/deletable, plus the delete/restore-profile centerpiece and an audit log. |
| **Activity** | A filterable timeline of every action Sentinel took, with score, reason, and outcome. Active cooling-off holds can be cancelled here. |

---

## How to test it (for judges)

Open the [live app](https://sentinel-tawny-three.vercel.app) and go to **Transfer**.
It has two demo preset buttons. Four outcomes to see:

1. **Frictionless pass** — click **Safe transfer** → **Review & send**. Instant green
   success, no OTP. (A normal payment to a known vendor at a normal hour.)
2. **Challenge → verified → released** — enter a mid-size transfer to a known payee
   (e.g. **PiggyVest**, `9901234567`, **Providus Bank**, **₦120,000**) → **Review &
   send** → **This is really me** → tick the **real recipients** you recognise (not the
   decoys like "Kola Ventures Ltd") → **Verify** → transfer released.
3. **Challenge → wrong answer → blocked** — same as above but tick the decoy names →
   one retry, then "we've kept your money safe."
4. **Highest risk → verified → 24h cooling-off** — click **Risky transfer** (₦350,000
   to a new payee at 1:47 AM) → score **80 / Blocked** → **This is really me** → pick
   the real recipients → **Verify** → held for 24 hours (not sent). Cancel it from
   **Activity**.

Then try **Scam Check** (use the example chips, and a normal message to see it clear as
safe), and **Trust Panel → Delete profile** (watch the Dashboard and Transfer lose
protection) → **Restore**.

> The demo data is shared and mutable. If it looks changed, it can be reset by
> re-running `npm run db:seed`.

---

## Architecture: two engines, one brain

- **Deterministic engine** — pure, testable TypeScript in
  [`src/lib/scoring/`](src/lib/scoring). Turns transaction history into a fingerprint
  and scores proposed transfers, returning a 0–100 score, a tier
  (PASS / SOFT_CHALLENGE / HOLD), and the **itemized reasons** behind every point.
  Fast, auditable, explainable — what regulators and dispute teams need.
- **Generative engine** — Google Gemini, called only from server-side API routes in
  `src/app/api/`, for semantic scam analysis.

Deterministic where reliability and auditability matter; generative where language
understanding matters.

### The scoring model (defensible math)

Four signals, each computed from the user's real history, combined as a weighted
average scaled to 0–100:

| Signal | How it's computed | Weight |
|--------|-------------------|--------|
| **Amount** | z-score of the amount vs the user's real mean/std of past transfers; severity mapped on [2σ, 5σ] (only the high tail is risky) | 0.35 |
| **Recipient** | is the payee in the learned known-recipient set? new = 1, known = 0 | 0.25 |
| **Time** | `1 − count[hour] / max(count)` from the user's real hour-of-day histogram (anchored to WAT) | 0.20 |
| **Velocity** | transfers in the trailing hour vs the user's own baseline rate | 0.20 |

Tiers: `PASS < 35 ≤ SOFT_CHALLENGE < 65 ≤ HOLD`. Below `MIN_HISTORY` transactions the
engine returns **unprotected** rather than guess — which is what makes the "delete my
profile degrades protection" demo real.

**Calibration** — the unit tests assert, on a controlled fixture: ₦5,000 to a known
vendor → PASS; a large amount to a known payee → SOFT_CHALLENGE; ₦350,000 to a new
payee at 1:47 AM → **80 → HOLD**. On the live seeded persona the same three cases score
~**7.5 / ~42.5 / 80**.

### The behavioural challenge (two-layer defense)

When a transfer is challenged, instead of an OTP (which a scammer coaches the victim
through), Sentinel asks something only the account owner knows:

- **Layer 1 — fingerprint-derived challenge:** *"Which of these have you sent money to
  before?"* — 2 real recipients drawn from the user's history + 2 decoys guaranteed not
  in it, shuffled. The correct answer is stored server-side only and never reaches the
  client. Generation is a pure, unit-tested function.
- **Layer 2 — outcome routing by risk tier:** wrong answer → one retry, then hard-block
  ("we've kept your money safe"); correct + medium risk → release; correct + **highest**
  risk → verified but routed to a **24-hour cooling-off** hold (removes the scammer's
  urgency), cancellable from Activity.

**Fail-safe by design (fail closed):** too few known recipients, a missing/expired
challenge, or any endpoint error all result in the transfer staying **blocked** — a
security product must never fail open.

---

## Tech stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 + shadcn-style UI · Recharts ·
lucide-react · Prisma ORM · Postgres on **Supabase** · **Google Gemini** (server-side) ·
deployed on **Vercel**. Unit tests with **Vitest**.

## Local setup

```bash
npm install
cp .env.example .env          # then fill in real values (see below)
npm run db:push               # create tables in your Supabase database
npm run db:seed               # seed Amina's 90-day history + fingerprint
npm run dev                   # http://localhost:3000
```

### Environment variables

All are **server-only secrets** (never exposed to the client — a security product must
never leak its keys). See `.env.example`.

| Var | What | Where to get it |
|-----|------|-----------------|
| `DATABASE_URL` | Supabase pooled connection (port 6543, `?pgbouncer=true`) | Supabase → Connect → ORMs → Prisma |
| `DIRECT_URL` | Supabase direct connection (port 5432), for migrations/seed | same place |
| `GEMINI_API_KEY` | Google Gemini API key (enables Scam Check) | https://aistudio.google.com |

## Testing

```bash
npm test        # Vitest — scoring engine + challenge generation
```

Covers: fingerprint statistics; the normal / soft / fraud scoring cases; each signal;
reason ordering; the unprotected (too-little-history) path; and challenge generation
(correct options come from real history, decoys never appear in history).

## Project structure

```
src/
  lib/scoring/        deterministic engine (profile, signals, score, WAT time, tests)
  lib/challenge.ts    behavioural-challenge generator (+ tests)
  lib/data.ts         server data access over Prisma
  lib/gemini.ts       server-side Gemini REST client
  app/                the five screens (Dashboard, Transfer, Scam Check, Trust Panel, Activity)
  app/api/            score · transfer · challenge · challenge/verify · cooloff/cancel
                      · scam-check · profile (delete/restore) · recipient
prisma/               schema + coherent 90-day seed
```

---

Sentinel · HackX 6.0. **The bank environment is simulated; Sentinel's intelligence is real.**
