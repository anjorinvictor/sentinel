/**
 * Sentinel deterministic scoring engine — public surface.
 *
 * Two engines, one brain (CLAUDE.md): this is the deterministic half. Pure,
 * testable TypeScript that turns a user's real transaction history into a
 * behavioural fingerprint and scores proposed transfers against it, always
 * returning the itemized reasons behind the number.
 */
export * from "./types";
export { computeProfile, recipientKey } from "./profile";
export {
  amountSignal,
  timeSignal,
  recipientSignal,
  velocitySignal,
  clamp,
} from "./signals";
export {
  scoreTransaction,
  scoreFromHistory,
  SIGNAL_WEIGHTS,
  TIER_THRESHOLDS,
  MIN_HISTORY,
} from "./score";
