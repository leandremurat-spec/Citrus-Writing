/**
 * Encouragement for the daily goal.
 *
 * This used to be the sweet-spot line sitting off to one side of the footer, encouraging you
 * about a chapter while the number it sat beside was about a day. It now lives under the goal
 * it is talking about, and — the part that was missing — it changes when the goal is crossed,
 * instead of still urging you on past the finish line.
 *
 * The register is deliberately old: the things writers have told each other for a century,
 * not app copy. Pure, like sweet-spot.ts, so it can be recomputed on every keystroke.
 */

export type GoalZone = "none" | "started" | "halfway" | "closing" | "met" | "beyond";

export interface GoalState {
  zone: GoalZone;
  message: string;
  /** Words still needed to reach the goal (0 once met). */
  remaining: number;
  /** Words past the goal (0 until met). */
  over: number;
}

const MESSAGES: Record<GoalZone, readonly string[]> = {
  none: [
    "A messy page can be edited. A blank page cannot — keep going.",
    "Rome wasn’t built in a day. Neither was chapter one.",
    "The first sentence is allowed to be terrible.",
  ],
  started: [
    "Starting is the hard part, and it is behind you.",
    "Little strokes fell great oaks.",
    "A page a day is a book a year.",
  ],
  halfway: [
    "Past halfway. The second half is usually the quicker one.",
    "Well begun is half done — and you are past half.",
    "Keep the pen moving. Tomorrow is for fixing.",
  ],
  closing: [
    "{remaining} from today’s goal. That is one good scene.",
    "Nearly there — {remaining} to go.",
    "{remaining} left. Finish the thought and the day is yours.",
  ],
  met: [
    "Goal met. Everything after this is a gift to future you.",
    "That is the day’s work done. Stopping here still counts.",
    "Goal met. The streak is safe.",
  ],
  beyond: [
    "{over} past the goal. A good day at the desk.",
    "{over} over. Tomorrow’s you will be pleased.",
    "Double duty — {over} beyond what you set out to do.",
  ],
};

function pick(list: readonly string[], seed: number): string {
  return list[Math.abs(seed) % list.length];
}

export function getGoalState(written: number, goal: number, seed = 0): GoalState {
  const target = Math.max(1, goal);
  const remaining = Math.max(0, target - written);
  const over = Math.max(0, written - target);
  const ratio = written / target;

  let zone: GoalZone;
  if (written <= 0) zone = "none";
  else if (ratio >= 1.5) zone = "beyond";
  else if (ratio >= 1) zone = "met";
  else if (ratio >= 0.85) zone = "closing";
  else if (ratio >= 0.5) zone = "halfway";
  else zone = "started";

  const message = pick(MESSAGES[zone], seed)
    .replace("{remaining}", `${remaining.toLocaleString("en-US")} words`)
    .replace("{over}", `${over.toLocaleString("en-US")} words`);

  return { zone, message, remaining, over };
}
