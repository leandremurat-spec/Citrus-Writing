"use client";

import * as React from "react";

import {
  contrast,
  describeElement,
  effectiveBackground,
  isLargeText,
  readTokens,
  scanPage,
  toRgb,
  tokensFor,
  type Finding,
  type TokenTable,
} from "@/lib/ui-debug/inspect";

/**
 * The UI inspector: **⌘/Ctrl + Shift + U** in `npm run dev`.
 *
 * What it is for. Spotting that something looks wrong is the easy half; the hard half in this
 * app is the second question — *which token is the right one instead?* Colour values live only
 * in `src/lib/theme/palettes.ts`, the ramps run by role rather than by lightness, 700 is the
 * text rung and 600 the graphical-mark rung, and every new pairing owes a line to
 * `scripts/theme-check.ts`. None of that is visible from a browser's own element panel, which
 * will happily report that a heading is `#8c491a` and leave you to work out that the name for
 * it is `--press-700`, and that reaching one rung lighter would drop it under 4.5:1.
 *
 * So this reports the *name* of what is painted, not only the value, and it measures the
 * pairings the project's own audit measures. Point it at something and it says: this is
 * `--ochre-400` on `--card`, 2.1:1, which is under the 3:1 floor for a graphical mark.
 *
 * Two modes, both off until asked for:
 *   · **Point** — hover anything for its box, its tokens and its contrast; space pins it.
 *   · **Scan** — every measurable fault on the page at once, click one to scroll to it.
 *
 * It measures and it names; it never writes a style. A fix belongs in the component, in a
 * class the rest of the app already uses, where the next person will find it.
 *
 * Two deliberate departures from the house rules, both because this panel has to stay legible
 * *while* the thing it is measuring is broken:
 *
 *   · **Its colours are literals, and none of them are palette tokens.** A tool that measured
 *     `--card` and also painted itself with `--card` would be unreadable in exactly the
 *     palette that needed checking, and worse, would invite you to read its own chrome as part
 *     of the page. It is deliberately not of this app's visual world.
 *   · **It is styled inline rather than with utilities.** Tailwind scans all of `src/`, so
 *     utilities named here would be compiled into the production stylesheet even though the
 *     component never ships — the same dead-rule trap CLAUDE.md records under the `source("../")`
 *     note. Inline styles cost the shipped CSS nothing.
 *
 * Never shipped: the root layout mounts it only when `NODE_ENV !== "production"`.
 */

const INK = "#e8eaed";
const DIM = "rgba(232,234,237,0.45)";
const FAINT = "rgba(232,234,237,0.3)";
const RULE = "1px solid rgba(255,255,255,0.1)";
const ACCENT = "#7dd3fc";
const GOOD = "#6ee7b7";
const BAD = "#fda4af";
const WARN = "#fcd34d";

const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 380,
  maxHeight: "calc(100vh - 24px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "#111418",
  color: INK,
  boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
  pointerEvents: "auto",
};

interface Reading {
  description: string;
  box: string;
  rows: { label: string; value: string; token: string | null; warn?: string }[];
  contrastLine: { ratio: number; floor: number; against: string } | null;
}

/**
 * The leading token name, with at most a couple of its synonyms. The shadcn slots alias each
 * other heavily — `--foreground` has seven — and a full list buries the one name worth reading.
 */
function formatToken(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  const rest = names.slice(1, 3).join(", ");
  const more = names.length > 3 ? `, +${names.length - 3}` : "";
  return `${names[0]} (= ${rest}${more})`;
}

/**
 * The ramp contract, stated back at you when a colour breaks it: 700 reads as text on every
 * ground, 600 clears 3:1 as the boundary of a graphical object, and nothing below 600 promises
 * either.
 */
function rampWarning(token: string | null, role: "text" | "mark"): string | undefined {
  if (!token) return undefined;
  const match = /^--(press|ochre|neutral)-(\d)00$/.exec(token.split(" ")[0]);
  if (!match) return undefined;
  const rung = Number(match[2]) * 100;
  if (role === "text" && rung < 700) return `rung ${rung} — below the 700 text rung`;
  if (role === "mark" && rung < 600) return `rung ${rung} — below the 600 graphical-mark rung`;
  return undefined;
}

function read(element: Element, tokens: TokenTable): Reading {
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  const rows: Reading["rows"] = [];

  const add = (label: string, value: string, role: "text" | "mark" | "none" = "none") => {
    if (!value || value === "none" || value === "rgba(0, 0, 0, 0)") return;
    const token = formatToken(tokensFor(tokens, value));
    rows.push({ label, value, token, warn: role === "none" ? undefined : rampWarning(token, role) });
  };

  add("color", style.color, "text");
  add("background", style.backgroundColor, "mark");
  if (style.borderTopWidth !== "0px") add("border", style.borderTopColor, "mark");
  if (style.outlineStyle !== "none") add("outline", style.outlineColor, "mark");
  rows.push({
    label: "font",
    value: `${style.fontSize} / ${style.fontWeight} ${style.fontFamily.split(",")[0].replace(/["']/g, "")}`,
    token: null,
  });
  if (style.borderRadius !== "0px") rows.push({ label: "radius", value: style.borderRadius, token: null });
  if (style.boxShadow !== "none") rows.push({ label: "shadow", value: style.boxShadow.slice(0, 64), token: null });

  const foreground = toRgb(style.color);
  const background = effectiveBackground(element);
  const hasOwnText = Array.from(element.childNodes).some(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim(),
  );

  return {
    description: describeElement(element),
    box: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
    rows,
    contrastLine:
      foreground && hasOwnText
        ? {
            ratio: contrast(foreground, background),
            floor: isLargeText(style) ? 3 : 4.5,
            against: formatToken(tokensFor(tokens, `rgb(${background.join(",")})`)) ?? `rgb(${background.join(", ")})`,
          }
        : null,
  };
}

export function UiInspector() {
  const [mode, setMode] = React.useState<"off" | "point" | "scan">("off");
  const [tokens, setTokens] = React.useState<TokenTable | null>(null);
  const [reading, setReading] = React.useState<Reading | null>(null);
  const [findings, setFindings] = React.useState<Finding[]>([]);
  const [highlight, setHighlight] = React.useState<DOMRect | null>(null);
  const [pinned, setPinned] = React.useState(false);

  /*
   * The token table is read once per activation, not once per hover: building it walks every
   * stylesheet, and it only changes when the theme or the palette does — either of which means
   * re-opening the inspector anyway.
   */
  const activate = React.useCallback((next: "point" | "scan") => {
    const table = readTokens();
    setTokens(table);
    setMode(next);
    setPinned(false);
    setReading(null);
    setHighlight(null);
    setFindings(next === "scan" ? scanPage(table) : []);
  }, []);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "u") {
        event.preventDefault();
        if (mode === "off") activate("point");
        else setMode("off");
        return;
      }
      if (mode === "off") return;
      if (event.key === "Escape") {
        setMode("off");
        setPinned(false);
      }
      // Space pins the current reading so the pointer can leave the element without losing it.
      if (event.key === " " && mode === "point") {
        event.preventDefault();
        setPinned((value) => !value);
      }
    };
    // Capture, so the editor's own key handling never swallows the toggle.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode, activate]);

  // Pinning simply stops listening, rather than listening and discarding: it is the same
  // amount of code and it does not have to mirror state into a ref to read it from a handler.
  React.useEffect(() => {
    if (mode !== "point" || pinned || !tokens) return;
    const onMove = (event: MouseEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!target || target.closest("[data-ui-inspector]")) return;
      setReading(read(target, tokens));
      setHighlight(target.getBoundingClientRect());
    };
    window.addEventListener("mousemove", onMove, true);
    return () => window.removeEventListener("mousemove", onMove, true);
  }, [mode, pinned, tokens]);

  if (mode === "off") return null;

  return (
    <div
      data-ui-inspector
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        pointerEvents: "none",
        font: '12px/1.45 ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {highlight && (
        <div
          style={{
            position: "absolute",
            left: highlight.left,
            top: highlight.top,
            width: highlight.width,
            height: highlight.height,
            border: `2px solid ${ACCENT}`,
            background: "rgba(125,211,252,0.12)",
          }}
        />
      )}

      <div style={panelStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, borderBottom: RULE, padding: "7px 10px" }}>
          <strong style={{ fontSize: 13 }}>UI inspector</strong>
          <span style={{ flex: 1 }} />
          <TabButton active={mode === "point"} onClick={() => activate("point")}>
            Point
          </TabButton>
          <TabButton active={mode === "scan"} onClick={() => activate("scan")}>
            Scan
          </TabButton>
          <button
            type="button"
            aria-label="Close the inspector"
            onClick={() => setMode("off")}
            style={{ background: "none", border: 0, color: DIM, cursor: "pointer", padding: "0 4px" }}
          >
            ✕
          </button>
        </div>

        <div style={{ minHeight: 0, flex: 1, overflowY: "auto" }}>
          {mode === "point" ? (
            <PointPanel reading={reading} pinned={pinned} />
          ) : (
            <ScanPanel findings={findings} onHover={setHighlight} />
          )}
        </div>

        <p style={{ borderTop: RULE, margin: 0, padding: "6px 10px", fontSize: 11, color: DIM }}>
          {mode === "point"
            ? "Space pins · Esc closes · every value is what the browser painted"
            : `${findings.length} measurable ${findings.length === 1 ? "fault" : "faults"} at this size · Esc closes`}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 6,
        border: 0,
        padding: "2px 8px",
        fontSize: 11,
        cursor: "pointer",
        background: active ? "rgba(125,211,252,0.22)" : "transparent",
        color: active ? ACCENT : DIM,
      }}
    >
      {children}
    </button>
  );
}

function PointPanel({ reading, pinned }: { reading: Reading | null; pinned: boolean }) {
  if (!reading) {
    return <p style={{ margin: 0, padding: "16px 12px", color: DIM }}>Move the pointer over anything on the page.</p>;
  }
  return (
    <div style={{ padding: "10px 12px" }}>
      {pinned && <p style={{ margin: "0 0 8px", color: ACCENT, fontSize: 11 }}>Pinned — space to release</p>}
      <p style={{ margin: "0 0 6px", color: "rgba(232,234,237,0.72)", wordBreak: "break-word" }}>
        {reading.description}
      </p>
      <p style={{ margin: "0 0 10px", color: DIM }}>{reading.box} px</p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {reading.rows.map((row, index) => (
            <tr key={index} style={{ verticalAlign: "top" }}>
              <td style={{ width: 72, padding: "2px 8px 2px 0", color: DIM }}>{row.label}</td>
              <td style={{ padding: "2px 0" }}>
                {row.token ? (
                  <>
                    <span style={{ fontFamily: "ui-monospace, monospace", color: GOOD }}>{row.token}</span>
                    <span style={{ marginLeft: 6, color: FAINT }}>{row.value}</span>
                  </>
                ) : (
                  <span style={{ color: "rgba(232,234,237,0.8)" }}>{row.value}</span>
                )}
                {row.warn && <div style={{ color: WARN }}>{row.warn}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {reading.contrastLine && (
        <p
          style={{
            margin: "10px 0 0",
            borderTop: RULE,
            paddingTop: 8,
            color: reading.contrastLine.ratio >= reading.contrastLine.floor ? GOOD : BAD,
          }}
        >
          {reading.contrastLine.ratio.toFixed(2)}:1 against{" "}
          <span style={{ fontFamily: "ui-monospace, monospace" }}>{reading.contrastLine.against}</span> — floor{" "}
          {reading.contrastLine.floor}:1
        </p>
      )}

      <p style={{ margin: "10px 0 0", borderTop: RULE, paddingTop: 8, fontSize: 11, color: DIM }}>
        Colour values belong in <Mono>src/lib/theme/palettes.ts</Mono>. A pairing the app did not have before owes a
        line to <Mono>scripts/theme-check.ts</Mono>.
      </p>
    </div>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: "ui-monospace, monospace" }}>{children}</span>;
}

const KIND_LABEL: Record<Finding["kind"], string> = {
  contrast: "contrast",
  clipped: "clipped",
  offscreen: "off-screen",
  "tap-target": "tap target",
  "off-palette": "off palette",
  radius: "corner",
};

function ScanPanel({ findings, onHover }: { findings: Finding[]; onHover: (rect: DOMRect | null) => void }) {
  if (findings.length === 0) {
    return (
      <p style={{ margin: 0, padding: "16px 12px", color: GOOD }}>
        Nothing measurably wrong on this page at this size.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {findings.map((finding, index) => (
        <li key={index} style={{ borderTop: index === 0 ? "none" : RULE }}>
          <button
            type="button"
            style={{
              display: "block",
              width: "100%",
              border: 0,
              background: "none",
              textAlign: "left",
              padding: "8px 12px",
              cursor: "pointer",
              color: "inherit",
              font: "inherit",
            }}
            onMouseEnter={() => onHover(finding.element.getBoundingClientRect())}
            onFocus={() => onHover(finding.element.getBoundingClientRect())}
            onClick={() => finding.element.scrollIntoView({ block: "center" })}
          >
            <span
              style={{
                display: "inline-block",
                marginBottom: 2,
                borderRadius: 4,
                background: "rgba(255,255,255,0.1)",
                padding: "1px 6px",
                fontSize: 10,
                color: DIM,
              }}
            >
              {KIND_LABEL[finding.kind]}
            </span>
            <span style={{ display: "block", color: "rgba(232,234,237,0.85)", wordBreak: "break-word" }}>
              {finding.message}
            </span>
            {finding.hint && (
              <span style={{ display: "block", marginTop: 2, fontSize: 11, color: DIM }}>{finding.hint}</span>
            )}
            <span
              style={{
                display: "block",
                marginTop: 4,
                fontFamily: "ui-monospace, monospace",
                fontSize: 10,
                color: FAINT,
                wordBreak: "break-word",
              }}
            >
              {describeElement(finding.element)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
