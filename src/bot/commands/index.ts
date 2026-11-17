import type { Command } from "../command";
import { helpCommand, startCommand } from "./help";
import { jioCommand } from "./jio";

/**
 * THE COMMAND REGISTRY — the one place to plug in new commands.
 *
 * To add a command:
 *   1. Create src/bot/commands/<name>.ts exporting a `Command`
 *   2. Add it to this array
 *   3. Run `npm run setup:webhook` so Telegram's "/" menu updates
 *
 * See docs/EXTENDING.md for a worked example.
 */
export const commands: readonly Command[] = [jioCommand, helpCommand, startCommand];

export function findCommand(name: string, list: readonly Command[] = commands): Command | undefined {
  return list.find((c) => c.name === name);
}
