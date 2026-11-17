/**
 * Input sanitisation for user-provided text that the bot echoes back
 * (e.g. the jio name that becomes the poll question).
 */

/** Telegram's limit for poll questions is 300 characters. */
export const MAX_POLL_QUESTION_LENGTH = 300;

/**
 * - removes control and invisible formatting characters (incl. bidi overrides
 *   that can be used to visually spoof text)
 * - collapses runs of whitespace/newlines into one space
 * - trims and caps the length (by code point, so emoji aren't split)
 */
export function sanitizeText(input: string, maxLength: number): string {
  const cleaned = input
    .normalize("NFC")
    // C0/C1 control chars, zero-width chars, bidi controls, BOM
    .replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁠-⁯﻿]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const chars = Array.from(cleaned);
  return chars.length > maxLength ? chars.slice(0, maxLength).join("").trimEnd() : cleaned;
}

/** Escape text for Telegram's HTML parse mode. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
