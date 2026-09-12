/**
 * The one email shell: a Citrus Writing message, rendered as HTML and as plain text from a
 * single description of what the message says.
 *
 * ── Why one renderer rather than two files ────────────────────────────────────────────────
 *
 * Every transactional email is sent twice — once as HTML and once as text — and the client
 * picks one. Written as two templates they drift, and the half that drifts is always the text
 * one, because nobody looks at it. So `renderEmail` takes a structured `EmailContent` and emits
 * both from the same object: a paragraph added to the message appears in both or in neither.
 *
 * ── Why it is pure ────────────────────────────────────────────────────────────────────────
 *
 * No `server-only`, no React, no database — the same rule `lib/export/` follows, and for the
 * same reason: `npm run mail:preview` renders every message to a file without a dev server or a
 * connection. A template nobody can look at is a template nobody checks.
 *
 * ── Why email HTML looks like this ────────────────────────────────────────────────────────
 *
 * None of the app's own machinery reaches an inbox. Tailwind classes, custom properties, the
 * generated `palettes.css`, `<div>` layout and flexbox are all either stripped or unsupported
 * by at least one client that matters — Outlook's Word rendering engine being the reason for
 * most of it. So: tables for layout, every colour inline as a literal hex, and a `<style>`
 * block carrying only the two things it can afford to lose — the narrow-screen rules and the
 * dark-mode overrides. A client that strips it gets the light palette at 560px, which is a
 * legible email rather than a broken one.
 *
 * The hexes below are Citrus light and Citrus dark, copied *by value* out of
 * `lib/theme/palettes.ts` rather than imported from it. That is a deliberate exception to
 * "colour values live in palettes.ts and nowhere else" (CLAUDE.md, Conventions), and it is a
 * different decision from the UI inspector's: an email is not painted by this app, cannot read
 * a custom property, and must not change colour because someone retuned a rung six months from
 * now and never opened an inbox to check. `EMAIL_PALETTE` is the whole list, in one place, and
 * `npm run mail:preview` is how you look at it.
 *
 * ── Why the brand faces are not loaded ────────────────────────────────────────────────────
 *
 * Caprasimo and Figtree are self-hosted in the app, which is a claim the privacy policy makes
 * out loud — the typefaces are self-hosted, so no request leaves for Google. An email pulling a
 * webfont would break that claim on a surface nobody audits, and it would not work anyway:
 * Outlook ignores `@font-face` and Gmail strips it. Georgia carries the display line, which is
 * the closest an email-safe face gets to Caprasimo's warmth.
 */

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  The palette, flattened.                                                                    */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/** Citrus light and Citrus dark, the rungs an email actually paints. Values only, no ramps. */
export const EMAIL_PALETTE = {
  light: {
    /** The desk the card sits on — `--background`. */
    ground: "#f5ead8",
    /** The card — `--sheet` / `neutral-100`. */
    card: "#f9f4ed",
    /** `neutral-300`. Soft, and the only line on the card. */
    border: "#dcd3c4",
    /** `--foreground`. Headings. */
    ink: "#201e1d",
    /** `neutral-800`. Body copy — a shade off the heading, as in the app. */
    body: "#474238",
    /** `neutral-700` / `--subtle`. The footer and the fallback link. */
    dim: "#645c50",
    /** `--press`, the 700 rung. The button fill, and every link. */
    press: "#8c491a",
    /** `--on-accent`. Ink on a solid press fill. */
    onPress: "#f5ead8",
    /** `ochre-100` / `ochre-700` / `ochre-900` — the set-apart note. */
    noteBg: "#f0fae1",
    noteRule: "#56633f",
    noteInk: "#272e1b",
    /** `neutral-200` / `neutral-400` / `neutral-900` — the reader's own words, echoed back. */
    quoteBg: "#eee7db",
    quoteRule: "#c0b6a5",
    quoteInk: "#2e2b25",
    /** `ochre-700`. The eyebrow above the heading. */
    eyebrow: "#56633f",
  },
  dark: {
    ground: "#1e1813",
    card: "#2b241d",
    border: "#42382d",
    ink: "#f2e7d6",
    body: "#dbcdb8",
    dim: "#c0b09a",
    press: "#f0a874",
    onPress: "#231710",
    noteBg: "#1f2417",
    noteRule: "#b0bf88",
    noteInk: "#e7edd4",
    quoteBg: "#342c23",
    quoteRule: "#584c3e",
    quoteInk: "#f2e7d6",
    eyebrow: "#b0bf88",
  },
} as const;

const DISPLAY_FONT = "Georgia, 'Times New Roman', Times, serif";
const UI_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** The card is 560px because the messages are short. A wide column reads as a newsletter. */
const SHELL_WIDTH = 560;

const L = EMAIL_PALETTE.light;
const D = EMAIL_PALETTE.dark;

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  What a message is.                                                                         */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

export interface EmailAction {
  /** What the button says. A verb — "Set a new password", not "Click here". */
  label: string;
  url: string;
}

/** A short block set apart from the body: the reassurance, the caveat, the echoed message. */
export interface EmailNote {
  /** Optional lead-in, rendered bold on its own line. */
  heading?: string;
  /** Plain text. Line breaks are honoured; nothing else is interpreted. */
  text: string;
  /**
   * Whose words these are, which is the only thing the two tones mean.
   *
   * `note` is sage — the app speaking, set apart because it matters: the "didn't ask for this?"
   * reassurance. `quote` is neutral — the *reader's* own text, echoed back. Painting an echoed
   * message in the accent would dress a stranger's words up as ours, and in a support
   * confirmation that is the one distinction the panel exists to make.
   */
  tone?: "note" | "quote";
}

export interface EmailContent {
  /** The `<title>`, and the subject the caller will almost always reuse. */
  subject: string;
  /**
   * The inbox preview line, which sits beside the subject in most clients and is invisible in
   * the message itself. It must say something the subject does not — repeating the subject
   * wastes the one line a reader sees before deciding whether to open.
   */
  preheader: string;
  /** Sentence case, not shouted caps — the app's own `label-section` stance. */
  eyebrow: string;
  heading: string;
  /** Paragraphs above the button. */
  body: string[];
  action?: EmailAction;
  /** Paragraphs between the button and the note. */
  after?: string[];
  note?: EmailNote;
  /** The footer line saying why this message arrived. Every message owes one. */
  reason: string;
}

export interface RenderOptions {
  /**
   * Where the mark image and the footer links point. An email cannot use a relative path, so
   * this has to be absolute. Pass the request's own origin where there is one — the reset mail
   * already knows it — so a message sent from a preview deploy links back to that deploy.
   */
  origin: string;
  /** Named in the footer: the entity, where it is, and the inbox that answers. */
  sender: { name: string; entity: string; address: string; contactEmail: string };
}

export interface RenderedEmail {
  html: string;
  text: string;
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  Escaping. Every interpolated value goes through one of these two.                          */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Text destined for element content or an attribute value.
 *
 * A support confirmation echoes back what the writer typed, which makes this the one place in
 * the app where arbitrary user text is dropped into a markup document by hand. `&` first, or
 * the escapes escape each other.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A URL for an `href`.
 *
 * Escaping alone is not enough: `javascript:` in an anchor is a live hazard in the handful of
 * clients that render one, and a message built from a bad `origin` should fail visibly here
 * rather than ship a link nobody can explain. Anything that is not http(s) or mailto becomes
 * `#`, which is inert.
 */
export function safeUrl(value: string): string {
  const trimmed = value.trim();
  if (!/^(https?:|mailto:)/i.test(trimmed)) return "#";
  return escapeHtml(trimmed);
}

/** Plain text, wrapped for a terminal or a narrow client. A long URL is left whole. */
function wrapText(value: string, width = 72): string {
  const lines: string[] = [];
  for (const paragraph of value.split("\n")) {
    if (paragraph.length <= width) {
      lines.push(paragraph);
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      if (line && line.length + 1 + word.length > width) {
        lines.push(line);
        line = word;
      } else {
        line = line ? line + " " + word : word;
      }
    }
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

/** Plain text for an HTML body: escaped, with its own line breaks kept. */
function inlineText(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  The pieces.                                                                                */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * The `<style>` block: narrow screens, and dark mode.
 *
 * Both are expendable by design. A client that drops the block shows the light palette at a
 * fixed 560px, which is what most Outlook installs have always shown and is a perfectly good
 * email. Nothing structural lives here.
 *
 * The `!important` on every dark rule is not decoration — it is overriding the inline style on
 * the same element, which is the only way inline-styled email can have a dark mode at all.
 */
function styleBlock(): string {
  return `    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    a { color: ${L.press}; }
    @media only screen and (max-width: 600px) {
      .cw-shell { width: 100% !important; }
      .cw-gutter { padding-left: 16px !important; padding-right: 16px !important; }
      .cw-pad { padding: 24px !important; }
      .cw-heading { font-size: 24px !important; line-height: 30px !important; }
      .cw-button-link { display: block !important; }
    }
    @media (prefers-color-scheme: dark) {
      .cw-ground { background-color: ${D.ground} !important; }
      .cw-card { background-color: ${D.card} !important; border-color: ${D.border} !important; }
      .cw-heading, .cw-wordmark { color: ${D.ink} !important; }
      .cw-body { color: ${D.body} !important; }
      .cw-dim { color: ${D.dim} !important; }
      .cw-eyebrow { color: ${D.eyebrow} !important; }
      .cw-link { color: ${D.press} !important; }
      .cw-button { background-color: ${D.press} !important; }
      .cw-button-link { color: ${D.onPress} !important; }
      .cw-note { background-color: ${D.noteBg} !important; border-left-color: ${D.noteRule} !important; color: ${D.noteInk} !important; }
      .cw-quote { background-color: ${D.quoteBg} !important; border-left-color: ${D.quoteRule} !important; color: ${D.quoteInk} !important; }
      .cw-rule { border-top-color: ${D.border} !important; }
    }`;
}

/**
 * The button.
 *
 * Outlook's Word engine will not paint a background on an anchor and has never heard of a
 * border radius, so the pill is drawn for it in VML and hidden from everyone else — the
 * conditional-comment pair around each half is what keeps exactly one of them visible. VML has
 * no intrinsic sizing either, hence the width estimate: it only has to be close, since a pill a
 * little too wide still reads as a button and one too narrow clips the label.
 */
function button(action: EmailAction): string {
  const href = safeUrl(action.url);
  const label = escapeHtml(action.label);
  const vmlWidth = Math.max(220, Math.min(460, action.label.length * 10 + 64));

  return `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 10px;">
                <tr>
                  <td align="center" class="cw-button" bgcolor="${L.press}" style="background-color: ${L.press}; border-radius: 999px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${vmlWidth}px;" arcsize="50%" stroke="f" fillcolor="${L.press}">
                      <w:anchorlock/>
                      <center style="color:${L.onPress};font-family:${UI_FONT};font-size:15px;font-weight:bold;">${label}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a class="cw-button-link" href="${href}" style="display: inline-block; padding: 14px 30px; font-family: ${UI_FONT}; font-size: 15px; font-weight: 600; line-height: 20px; color: ${L.onPress}; text-decoration: none; border-radius: 999px;">${label}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;
}

function paragraphs(items: string[], firstMargin: number): string {
  return items
    .map(
      (item, index) =>
        `
                    <p class="cw-body" style="margin: ${index === 0 ? firstMargin : 14}px 0 0; font-family: ${UI_FONT}; font-size: 15px; line-height: 24px; color: ${L.body};">${inlineText(item)}</p>`,
    )
    .join("");
}

function noteBlock(note: EmailNote): string {
  const quote = note.tone === "quote";
  const bg = quote ? L.quoteBg : L.noteBg;
  const rule = quote ? L.quoteRule : L.noteRule;
  const ink = quote ? L.quoteInk : L.noteInk;
  const heading = note.heading
    ? `<strong style="display: block; margin-bottom: 8px; font-weight: 600;">${escapeHtml(note.heading)}</strong>`
    : "";

  return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 26px;">
                      <tr>
                        <td class="${quote ? "cw-quote" : "cw-note"}" bgcolor="${bg}" style="background-color: ${bg}; border-left: 3px solid ${rule}; border-radius: 12px; padding: 16px 18px; font-family: ${UI_FONT}; font-size: 14px; line-height: 22px; color: ${ink};">${heading}${inlineText(note.text)}</td>
                      </tr>
                    </table>`;
}

/* ────────────────────────────────────────────────────────────────────────────────────────── */
/*  The shell.                                                                                 */
/* ────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Renders one message to HTML and to plain text.
 *
 * There is no tracking pixel and there never should be. The privacy policy says there is no
 * analytics of any kind, and a 1×1 image in an email is analytics — it reports that a message
 * was opened, roughly from where, on what.
 */
export function renderEmail(content: EmailContent, options: RenderOptions): RenderedEmail {
  const { sender } = options;
  const site = options.origin.replace(/\/+$/, "");
  const siteHref = safeUrl(site);
  const mark = safeUrl(site + "/citrus-mark.png");
  const contactHref = safeUrl("mailto:" + sender.contactEmail);

  const actionBlock = content.action
    ? button(content.action) +
      `
                    <p class="cw-dim" style="margin: 4px 0 0; font-family: ${UI_FONT}; font-size: 13px; line-height: 20px; color: ${L.dim}; word-break: break-all;">Or paste this into your browser:<br /><a class="cw-link" href="${safeUrl(content.action.url)}" style="color: ${L.press};">${escapeHtml(content.action.url)}</a></p>`
    : "";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${escapeHtml(content.subject)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
${styleBlock()}
  </style>
</head>
<body class="cw-ground" style="margin: 0; padding: 0; width: 100%; background-color: ${L.ground};">

  <!-- The inbox preview line, then enough invisible filler that the client stops pulling body
       copy in after it. -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: ${L.ground};">${escapeHtml(content.preheader)}${"&#847;&zwnj;&nbsp;&#8199;&#65279;&#847;".repeat(30)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="cw-ground" style="background-color: ${L.ground};">
    <tr>
      <td align="center" class="cw-gutter" style="padding: 32px 24px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${SHELL_WIDTH}" class="cw-shell" style="width: ${SHELL_WIDTH}px; max-width: 100%;">

          <!-- Wordmark. The name is live text, so a blocked image costs nothing. -->
          <tr>
            <td style="padding-bottom: 20px;">
              <a href="${siteHref}" style="text-decoration: none;">
                <img src="${mark}" width="26" height="26" alt="" style="vertical-align: middle; width: 26px; height: 26px;" />
                <span class="cw-wordmark" style="vertical-align: middle; padding-left: 9px; font-family: ${DISPLAY_FONT}; font-size: 19px; font-weight: bold; letter-spacing: -0.01em; color: ${L.ink};">${escapeHtml(sender.name)}</span>
              </a>
            </td>
          </tr>

          <!-- The card: 28px radius against 32px of padding — a radius is paid for in padding. -->
          <tr>
            <td class="cw-card" bgcolor="${L.card}" style="background-color: ${L.card}; border: 1px solid ${L.border}; border-radius: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="cw-pad" style="padding: 32px;">
                    <p class="cw-eyebrow" style="margin: 0; font-family: ${UI_FONT}; font-size: 13px; font-weight: 600; line-height: 18px; color: ${L.eyebrow};">${escapeHtml(content.eyebrow)}</p>
                    <h1 class="cw-heading" style="margin: 8px 0 0; font-family: ${DISPLAY_FONT}; font-size: 27px; font-weight: bold; line-height: 34px; letter-spacing: -0.01em; color: ${L.ink};">${escapeHtml(content.heading)}</h1>${paragraphs(content.body, 16)}${actionBlock}${content.after ? paragraphs(content.after, 20) : ""}${content.note ? noteBlock(content.note) : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer: why it arrived, who sent it, where they are, how to reach a person. -->
          <tr>
            <td style="padding: 24px 8px 0;">
              <p class="cw-dim" style="margin: 0; font-family: ${UI_FONT}; font-size: 12px; line-height: 19px; color: ${L.dim};">${escapeHtml(content.reason)}</p>
              <p class="cw-rule cw-dim" style="margin: 14px 0 0; padding-top: 14px; border-top: 1px solid ${L.border}; font-family: ${UI_FONT}; font-size: 12px; line-height: 19px; color: ${L.dim};">
                ${escapeHtml(sender.entity)} &middot; ${escapeHtml(sender.address)}<br />
                <a class="cw-link" href="${contactHref}" style="color: ${L.press};">${escapeHtml(sender.contactEmail)}</a>
                &nbsp;&middot;&nbsp;<a class="cw-link" href="${siteHref}/legal/privacy" style="color: ${L.press};">Privacy</a>
                &nbsp;&middot;&nbsp;<a class="cw-link" href="${siteHref}/legal/terms" style="color: ${L.press};">Terms</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  /* The same message, for the clients — and the developers reading a terminal — who want it
     plain. Built from the same object, so it cannot describe a different email. */
  const lines: string[] = [sender.name.toUpperCase(), "", content.eyebrow, content.heading, ""];
  for (const item of content.body) lines.push(wrapText(item), "");
  if (content.action) lines.push(content.action.label + ":", content.action.url, "");
  if (content.after) for (const item of content.after) lines.push(wrapText(item), "");
  if (content.note) {
    if (content.note.heading) lines.push(content.note.heading);
    lines.push(wrapText(content.note.text), "");
  }
  lines.push("--", wrapText(content.reason), sender.entity + " · " + sender.address, sender.contactEmail);

  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
  return { html, text };
}
