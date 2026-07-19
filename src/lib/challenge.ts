/**
 * Behavioural challenge generation (pure, testable).
 *
 * When a transfer is challenged, instead of a password we ask something only the
 * real account owner could answer: "which of these have you sent money to
 * before?" The correct options are drawn from the user's REAL known-recipient
 * set; the decoys are Nigerian-style business/person names guaranteed NOT to be
 * in their history. This function only builds the options — persistence and
 * answer-checking happen server-side so the correct answer never reaches the client.
 */

/** Decoy names — plausible Nigerian payees the user has (almost certainly) never paid. */
export const DECOY_NAMES = [
  "Kola Ventures Ltd",
  "Swift Capital Ltd",
  "Bolaji Adeyemi",
  "Chidinma Okoro",
  "Emeka Traders",
  "Zenith Textiles Ltd",
  "Aisha Bello",
  "GreenLeaf Foods Ltd",
  "Tunde Motors",
  "Adaeze Stores",
  "Ngozi Nwosu",
  "Farouk Enterprises",
];

export interface ChallengeOption {
  id: string;
  label: string;
  isCorrect: boolean;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Minimum known recipients required to build a challenge. */
export const MIN_RECIPIENTS_FOR_CHALLENGE = 2;

/**
 * Build a 4-option challenge: 2 real recipients (isCorrect=true) + 2 decoys
 * (isCorrect=false), shuffled. Decoys are filtered so a name that happens to be
 * in the user's history is never used as a decoy. Returns null if there are not
 * enough real recipients or decoys to build a fair challenge (caller must fall
 * back to blocking — never crash).
 */
export function generateRecipientChallenge(
  known: { name: string }[],
  opts?: {
    decoys?: string[];
    random?: () => number;
    idFn?: () => string;
  }
): ChallengeOption[] | null {
  const random = opts?.random ?? Math.random;
  const decoyPool = opts?.decoys ?? DECOY_NAMES;
  const idFn =
    opts?.idFn ?? (() => Math.random().toString(36).slice(2, 12));

  const knownNamesLower = new Set(
    known.map((k) => k.name.trim().toLowerCase())
  );

  if (known.length < MIN_RECIPIENTS_FOR_CHALLENGE) return null;

  const reals = shuffle(known, random).slice(0, 2);

  const availableDecoys = shuffle(
    decoyPool.filter((d) => !knownNamesLower.has(d.trim().toLowerCase())),
    random
  ).slice(0, 2);

  if (availableDecoys.length < 2) return null;

  const options: ChallengeOption[] = [
    ...reals.map((r) => ({ id: idFn(), label: r.name, isCorrect: true })),
    ...availableDecoys.map((d) => ({ id: idFn(), label: d, isCorrect: false })),
  ];

  return shuffle(options, random);
}
