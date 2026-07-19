import { describe, it, expect } from "vitest";
import {
  generateRecipientChallenge,
  DECOY_NAMES,
} from "./challenge";

const KNOWN = [
  { name: "Chicken Republic" },
  { name: "Bolt Nigeria" },
  { name: "MTN VTU" },
  { name: "Shoprite" },
  { name: "Mama Okafor" },
  { name: "PiggyVest" },
];

describe("generateRecipientChallenge", () => {
  it("returns 4 options: exactly 2 correct (from real history) and 2 decoys (not in history)", () => {
    const knownNames = new Set(KNOWN.map((k) => k.name));
    // Run many times because selection is random.
    for (let i = 0; i < 100; i++) {
      const options = generateRecipientChallenge(KNOWN);
      expect(options).not.toBeNull();
      expect(options!).toHaveLength(4);

      const correct = options!.filter((o) => o.isCorrect);
      const decoys = options!.filter((o) => !o.isCorrect);
      expect(correct).toHaveLength(2);
      expect(decoys).toHaveLength(2);

      // Every correct option is a real recipient from history.
      for (const c of correct) expect(knownNames.has(c.label)).toBe(true);
      // Every decoy is NOT in history, and comes from the decoy pool.
      for (const d of decoys) {
        expect(knownNames.has(d.label)).toBe(false);
        expect(DECOY_NAMES).toContain(d.label);
      }
    }
  });

  it("never uses a known recipient as a decoy (even if a decoy name is also in history)", () => {
    // "Kola Ventures Ltd" is a decoy name; put it in the user's history too.
    const known = [
      { name: "Kola Ventures Ltd" },
      { name: "Chicken Republic" },
      { name: "Bolt Nigeria" },
    ];
    for (let i = 0; i < 50; i++) {
      const options = generateRecipientChallenge(known)!;
      const decoyLabels = options.filter((o) => !o.isCorrect).map((o) => o.label);
      expect(decoyLabels).not.toContain("Kola Ventures Ltd");
    }
  });

  it("returns null when there are fewer than 2 known recipients (fail-safe)", () => {
    expect(generateRecipientChallenge([])).toBeNull();
    expect(generateRecipientChallenge([{ name: "Only One" }])).toBeNull();
  });
});
