import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { landing } from "@/content/site-copy";

/**
 * The card that appears when someone shares a link to this app.
 *
 * It exists because the audience for a webserial tool lives in places that render link
 * previews — Royal Road's forums, r/webfiction, writing Discords — and a link with no card is a
 * bare blue URL that people scroll past. This is the cheapest acquisition work available, and
 * it was missing entirely.
 *
 * ── Why the colours are imported rather than written ──────────────────────────
 *
 * They come from `lib/theme/palettes.ts`, the same source the stylesheet is generated from, so
 * the card cannot drift into being a slightly different cream from the site it links to. That
 * is the rule the rest of this app already follows; there is no reason for an image to be the
 * exception just because it is rendered somewhere else.
 *
 * ── Why there is no Caprasimo here ────────────────────────────────────────────
 *
 * `next/font/google` downloads the display face at build time and serves it from this domain,
 * which is what lets the privacy policy say a page load makes no request to Google — but it
 * does not hand the bytes back for use in an `ImageResponse`. Fetching the family at render
 * time to get them would put a request to Google back into the app, in the one place nobody
 * would think to look for it. The card uses weight and scale for emphasis instead, which is a
 * smaller loss than a footnote that is no longer true.
 */

export const runtime = "nodejs";
export const alt = landing.meta.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f9f4ed";
const PAPER = "#f5ead8";
const INK = "#201e1d";
const PRESS = "#8c491a";
const SAGE = "#56633f";
const SUBTLE = "#645c50";

export default async function OpengraphImage() {
  // Read from disk rather than fetched over HTTP: at build time there is no server to fetch
  // from, and at request time it would be this app making a round trip to itself.
  const mark = await readFile(path.join(process.cwd(), "public", "citrus-mark.png"));
  const markSrc = "data:image/png;base64," + mark.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* The same decorative disc the marketing pages park top-right. */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "#e6ecd8",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} width={52} height={52} alt="" />
          <div style={{ fontSize: 34, fontWeight: 700, color: INK, letterSpacing: "-0.01em" }}>
            Citrus Writing
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 82,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.04,
              letterSpacing: "-0.035em",
            }}
          >
            <div>{landing.hero.headlineLine1}</div>
            <div style={{ color: PRESS }}>{landing.hero.headlineLine2}</div>
          </div>

          <div style={{ fontSize: 29, color: SUBTLE, maxWidth: 880, lineHeight: 1.35 }}>
            The workspace for webnovels and serials — the chapter as the unit of work, the arc as
            the unit of story.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, color: SAGE }}>
          <div
            style={{
              display: "flex",
              background: CREAM,
              border: `2px solid ${SAGE}`,
              borderRadius: 999,
              padding: "8px 22px",
              fontWeight: 600,
            }}
          >
            citruswritinglab.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}
