# Sentinel

**It knows you, so it protects you.**

Sentinel is an AI security & personalization layer for digital banking, built for
**HackX 6.0** (powered by Union Bank & ECX). Its thesis: **personalization *is*
security.** One per-user behavioural model — the "financial fingerprint" — is
learned from a user's transaction history, and that *same* model both personalizes
their banking and protects them in real time.

## What's real vs. simulated (read this first)

We are honest about the boundary:

- **Simulated:** the *bank environment*. There is no live bank feed. We seed a
  coherent 90-day transaction history for a demo persona (Amina Okafor) into a real
  Postgres database. This stands in for what a bank would provide via API.
- **Real:** Sentinel's *intelligence layer*.
  - The **scoring engine** (`src/lib/scoring/`) computes every risk score from the
    user's actual stored transactions using real statistics (z-scores, hour-of-day
    distributions, recipient-set membership, velocity). No hardcoded naira
    thresholds stand in for learned behaviour.
  - The **fingerprint** shown in the Trust Panel is literally the engine's output on
    the seeded rows — computed at seed time by the same `computeProfile()` the app uses.
  - **Scam Check** and the plain-language explanations call a real LLM (Google Gemini)
    server-side.

## Architecture: two engines, one brain

- **Deterministic engine** — pure, testable TypeScript in [`src/lib/scoring/`](src/lib/scoring).
  Turns transaction history into a fingerprint and scores proposed transfers against
  it, returning a 0–100 score, a tier (PASS / SOFT_CHALLENGE / HOLD), and the
  **itemized reasons** behind every point. Fast, auditable, explainable.
- **Generative engine** — Google Gemini, called only from server-side API routes in
  `src/app/api/`, for semantic scam analysis and warm plain-language phrasing.

Deterministic where reliability and auditability matter; generative where language
understanding matters.

### The scoring model (defensible math)

Four signals, each computed from the user's real history, combined as a weighted
average scaled to 0–100:

| Signal | How it's computed | Weight |
|--------|-------------------|--------|
| **Amount** | z-score of the amount vs the user's real mean/std of past transfers; mapped to severity on [2σ, 5σ] | 0.35 |
| **Recipient** | is the payee in the learned known-recipient set? new = 1, known = 0 | 0.25 |
| **Time** | `1 − count[hour]/max(count)` from the user's real hour-of-day histogram | 0.20 |
| **Velocity** | transfers in the trailing hour vs the user's own baseline rate | 0.20 |

Tiers: `PASS < 35 ≤ SOFT_CHALLENGE < 65 ≤ HOLD`. Below `MIN_HISTORY` transactions
the engine returns **unprotected** rather than guess — which is what makes the
"delete my profile degrades protection" demo real.

Calibration (unit-tested):

- ₦5,000 → a known vendor at 2 PM → **score 0 → PASS**
- ₦120,000 → a known payee at 2 PM → **score 35 → SOFT_CHALLENGE**
- ₦350,000 → a new payee at 1:47 AM → **score 80 → HOLD**

## Tech stack

Next.js (App Router) + TypeScript · Tailwind CSS v4 + shadcn/ui · Recharts ·
lucide-react · Prisma ORM · Postgres (Supabase) · Google Gemini · deployed on Vercel.

## Local setup

```bash
npm install
cp .env.example .env          # then fill in real values (see below)
npm run db:push               # create tables in your Supabase database
npm run db:seed               # seed Amina's 90-day history + fingerprint
npm run dev                   # http://localhost:3000
```

### Environment variables

All are server-only secrets (never exposed to the client). See `.env.example`.

| Var | What | Where to get it |
|-----|------|-----------------|
| `DATABASE_URL` | Supabase pooled connection (port 6543, `?pgbouncer=true`) | Supabase → Connect → ORMs → Prisma |
| `DIRECT_URL` | Supabase direct connection (port 5432), for migrations/seed | same place |
| `GEMINI_API_KEY` | Google Gemini API key | https://aistudio.google.com |

## Testing

```bash
npm test        # Vitest unit tests for the scoring engine
```

## The three pillars

1. **The Financial Fingerprint** — the learned model (typical amount, active hours,
   known recipients, velocity).
2. **The Guardian** — real-time transaction scoring + Scam Check (LLM).
3. **The Trust Panel** — see/edit/delete everything the fingerprint knows, including
   "delete my entire profile", which visibly degrades protection and can be restored.

---

Sentinel · HackX 6.0. The bank environment is simulated; Sentinel's intelligence is real.
