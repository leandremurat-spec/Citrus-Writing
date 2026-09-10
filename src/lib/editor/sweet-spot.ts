/**
 * The serial "sweet spot": chapters between `min` and `max` words (1,500–2,500 by default)
 * are the size feed readers like. Everything here is pure so the footer can recompute it on
 * every keystroke without flicker: the message depends only on the zone and a stable seed.
 */

export type SweetSpotZone = "empty" | "warming" | "building" | "close" | "sweet" | "over" | "far-over";

export interface SweetSpotState {
  zone: SweetSpotZone;
  /** 0..1 position of the count on a scale that ends a little past `max`. */
  progress: number;
  message: string;
  /** The short form the footer shows under the gauge: "1,438 to the sweet spot". */
  caption: string;
  /** Words still needed to reach `min` (0 when at or past it). */
  remaining: number;
  /** Words past `max` (0 when at or below it). */
  excess: number;
}

const MESSAGES: Record<SweetSpotZone, readonly string[]> = {
  empty: [
    "A blank page. Every serial starts exactly here.",
    "Nothing yet. The first sentence is allowed to be bad.",
  ],
  warming: [
    "Warming up. The first hundred words are the stubborn ones.",
    "Ink is flowing. Keep going, don't look back yet.",
  ],
  building: [
    "Good momentum. Keep the scene moving.",
    "Building nicely. Your readers are leaning in.",
  ],
  close: ["Almost there: {remaining} more words to the sweet spot.", "So close. {remaining} words and this chapter is feed-sized."],
  sweet: [
    "Sweet spot! This chapter is serial-sized.",
    "Perfect length for the feed. Readers will thank you.",
    "Right in the pocket. Land the ending whenever it feels right.",
  ],
  over: [
    "{excess} over the sweet spot. A natural break point may be hiding in here.",
    "Running long by {excess}. Not a problem, just a nudge.",
  ],
  "far-over": [
    "This is a double-length chapter. Splitting it in two is free, and so are cliffhangers.",
    "{excess} past the sweet spot. Two chapters would feed the schedule twice.",
  ],
};

function pick(list: readonly string[], seed: number): string {
  return list[Math.abs(seed) % list.length];
}

/** Small stable hash so each chapter gets its own flavour of message. */
export function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) | 0;
  return hash;
}

export function getSweetSpotState(count: number, min: number, max: number, seed = 0): SweetSpotState {
  const remaining = Math.max(0, min - count);
  const excess = Math.max(0, count - max);
  const scale = max * 1.25;
  const progress = Math.min(1, count / scale);

  let zone: SweetSpotZone;
  if (count === 0) zone = "empty";
  else if (count < min * 0.25) zone = "warming";
  else if (count < min * 0.7) zone = "building";
  else if (count < min) zone = "close";
  else if (count <= max) zone = "sweet";
  else if (count <= max * 1.25) zone = "over";
  else zone = "far-over";

  const template = pick(MESSAGES[zone], seed);
  const message = template
    .replace("{remaining}", remaining.toLocaleString("en-US"))
    .replace("{excess}", excess.toLocaleString("en-US"));

  // The footer says the number, not the sentiment. The sentiment moved to the panel, where
  // there is room for it and where it sits next to the figure it is about.
  const caption =
    remaining > 0
      ? `${remaining.toLocaleString("en-US")} to the sweet spot`
      : excess > 0
        ? `${excess.toLocaleString("en-US")} over the sweet spot`
        : "in the sweet spot";

  return { zone, progress, message, caption, remaining, excess };
}
