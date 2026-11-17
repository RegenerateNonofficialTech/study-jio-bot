/**
 * Bot behaviour settings that aren't secrets. Edit freely.
 */

/** The fixed options every /jio poll starts with. Members can add more. */
export const DEFAULT_JIO_OPTIONS: readonly string[] = [
  "Morning",
  "Lunch at 12pm (or suggest)",
  "Afternoon",
  "Dinner",
];

export const JIO_POLL_SETTINGS = {
  /** Required: Telegram doesn't allow adding options to anonymous polls. */
  isAnonymous: false,
  /** People can usually make more than one slot. */
  allowsMultipleAnswers: true,
  /** The core feature: members can add their own time slots. */
  allowAddingOptions: true,
  /** Members can change their vote when plans change. */
  allowsRevoting: true,
} as const;

/** Minimum time between two /jio polls in the same chat (anti-spam). */
export const JIO_COOLDOWN_MS = 10_000;

/** Max accepted webhook body size. Telegram updates are small. */
export const MAX_BODY_BYTES = 64 * 1024;
