/**
 * Checks the export engine against a document that exercises every node and mark the editor
 * can produce, plus the artifacts a Google Docs paste leaves behind.
 * Run: npm run export:check
 */
import { exportChapter, exportChapters, type ExportChaptersOptions, type ExportOptions } from "../src/lib/export";
import type { DocNode } from "../src/lib/editor/word-count";

const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) return;
  failures.push(detail ? `${label}\n    ${detail}` : label);
}

function contains(haystack: string, needle: string, label: string) {
  check(label, haystack.includes(needle), `expected to find: ${JSON.stringify(needle)}`);
}

function absent(haystack: string, needle: string, label: string) {
  check(label, !haystack.includes(needle), `expected NOT to find: ${JSON.stringify(needle)}`);
}

const text = (value: string, marks?: { type: string; attrs?: Record<string, unknown> }[]): DocNode => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});

// Word-processor residue, built from code points so the fixture stays reviewable in plain ASCII.
const NBSP = String.fromCharCode(0x00a0);
const ZERO_WIDTH = String.fromCharCode(0x200b);
const SOFT_HYPHEN = String.fromCharCode(0x00ad);

const doc: DocNode = {
  type: "doc",
  content: [
    // Leading blank paragraphs: padding an author left behind.
    { type: "paragraph" },
    { type: "paragraph" },
    { type: "heading", attrs: { level: 2 }, content: [text("The Ninth Pier")] },
    {
      type: "paragraph",
      content: [
        { type: "mention", attrs: { id: "c1", label: "Wren Ashcombe" } },
        text(`${NBSP}counted${ZERO_WIDTH} the${SOFT_HYPHEN} steps, `),
        text("slowly", [{ type: "italic" }]),
        text(" and "),
        text("deliberately", [{ type: "bold" }]),
        text(". "),
        text("Struck out", [{ type: "strike" }]),
        text(" "),
        text("underlined", [{ type: "underline" }]),
        text(" "),
        text("a link", [{ type: "link", attrs: { href: "https://example.com/tide" } }]),
        text("."),
      ],
    },
    { type: "horizontalRule" },
    {
      type: "blockquote",
      content: [{ type: "paragraph", content: [text("Put it back, he said.")] }],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [text("Rope")] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [text("A church door")] }] },
      ],
    },
    {
      type: "orderedList",
      content: [{ type: "listItem", content: [{ type: "paragraph", content: [text("Gate three held")] }] }],
    },
    // Markdown landmines: characters that would otherwise be read as formatting.
    { type: "paragraph", content: [text("- not a list, and 2 * 3 = 6 with an _underscore_")] },
    { type: "paragraph", content: [text("Line one"), { type: "hardBreak" }, text("line two")] },
    // HTML landmines.
    { type: "paragraph", content: [text('5 < 6 & "quoted" > 4')] },
    { type: "paragraph" },
    { type: "paragraph" },
  ],
};

const base: ExportOptions = { format: "html", includeTitle: false, title: "Chapter 1", sceneBreak: "hr" };

// ---------- HTML ----------
const html = exportChapter(doc, base);
console.log("--------- HTML ---------\n" + html.text + "\n");

contains(html.text, "<h2>The Ninth Pier</h2>", "HTML: heading");
contains(html.text, "<em>slowly</em>", "HTML: italic");
contains(html.text, "<strong>deliberately</strong>", "HTML: bold");
contains(html.text, "<s>Struck out</s>", "HTML: strike");
contains(html.text, "<u>underlined</u>", "HTML: underline");
contains(html.text, '<a href="https://example.com/tide">a link</a>', "HTML: link");
contains(html.text, "<hr />", "HTML: scene break");
contains(html.text, "<blockquote>", "HTML: blockquote");
contains(html.text, "<li>Rope</li>", "HTML: list item is flat, not paragraph-wrapped");
contains(html.text, "<br />", "HTML: hard break");
contains(html.text, "Wren Ashcombe counted the steps", "HTML: mention becomes a plain name");
contains(html.text, "5 &lt; 6 &amp; \"quoted\" &gt; 4", "HTML: text is escaped");

absent(html.text, "@Wren", "HTML: the @ sigil is stripped");
absent(html.text, NBSP, "HTML: non-breaking spaces are normalised");
absent(html.text, ZERO_WIDTH, "HTML: zero-width characters are removed");
absent(html.text, SOFT_HYPHEN, "HTML: soft hyphens are removed");
absent(html.text, "class=", "HTML: no classes");
absent(html.text, "style=", "HTML: no inline styles");
absent(html.text, "data-", "HTML: no data attributes");
absent(html.text, "<div", "HTML: no wrapper divs");
absent(html.text, "<span", "HTML: no spans");
check("HTML: leading blank paragraphs are trimmed", !html.text.startsWith("<p><br /></p>"), html.text.slice(0, 40));
check("HTML: trailing blank paragraphs are trimmed", !html.text.trimEnd().endsWith("<p><br /></p>"));

// ---------- HTML options ----------
const withTitle = exportChapter(doc, { ...base, includeTitle: true });
contains(withTitle.text, "<h2>Chapter 1</h2>", "HTML: optional title is an h2, not an h1");
absent(withTitle.text, "<h1", "HTML: nothing emits an h1 — the platform already has one");
check(
  "HTML: title adds to the word count",
  withTitle.wordCount === html.wordCount + 2,
  `${withTitle.wordCount} vs ${html.wordCount}`,
);

const asterisks = exportChapter(doc, { ...base, sceneBreak: "asterisks" });
contains(asterisks.text, "<p>* * *</p>", "HTML: asterisk scene break");
absent(asterisks.text, "<hr />", "HTML: asterisk break replaces the rule");

// ---------- Markdown ----------
const md = exportChapter(doc, { ...base, format: "markdown" });
console.log("--------- Markdown ---------\n" + md.text + "\n");

contains(md.text, "## The Ninth Pier", "MD: heading");
contains(md.text, "*slowly*", "MD: italic");
contains(md.text, "**deliberately**", "MD: bold");
contains(md.text, "~~Struck out~~", "MD: strike");
contains(md.text, "<u>underlined</u>", "MD: underline falls back to inline HTML");
contains(md.text, "[a link](https://example.com/tide)", "MD: link");
contains(md.text, "---", "MD: scene break");
contains(md.text, "> Put it back", "MD: blockquote");
contains(md.text, "- Rope", "MD: bullet list");
contains(md.text, "1. Gate three held", "MD: ordered list");
contains(md.text, "Line one  \nline two", "MD: hard break survives as two trailing spaces");
contains(md.text, "\\- not a list", "MD: a line starting with '-' is escaped");
contains(md.text, "\\_underscore\\_", "MD: underscores are escaped");
contains(md.text, "2 \\* 3", "MD: asterisks are escaped");
absent(md.text, "@Wren", "MD: the @ sigil is stripped");
absent(md.text, NBSP, "MD: non-breaking spaces are normalised");
absent(md.text, ZERO_WIDTH, "MD: zero-width characters are removed");
check(
  "MD: underline warning is reported",
  md.warnings.some((warning) => warning.includes("underline")),
  JSON.stringify(md.warnings),
);
check(
  "MD: mention warning is reported",
  md.warnings.some((warning) => warning.includes("@mentions")),
  JSON.stringify(md.warnings),
);

// ---------- multi-chapter (an arc, a volume, or a whole serial in one pass) ----------
const chapterOne: DocNode = { type: "doc", content: [{ type: "paragraph", content: [text("First chapter.")] }] };
const chapterTwo: DocNode = { type: "doc", content: [{ type: "paragraph", content: [text("Second chapter.")] }] };
const items = [
  { title: "Chapter 1: Lamplighter's Hour", doc: chapterOne },
  { title: "Chapter 2: What the Tide Returns", doc: chapterTwo },
];
const multiBase: ExportChaptersOptions = { format: "html", sceneBreak: "hr", separator: "heading" };

const headings = exportChapters(items, multiBase);
console.log("--------- Multi-chapter (headings) ---------\n" + headings.text + "\n");
contains(headings.text, "<h2>Chapter 1: Lamplighter's Hour</h2>", "Multi HTML: first chapter title as heading");
contains(headings.text, "<h2>Chapter 2: What the Tide Returns</h2>", "Multi HTML: second chapter title as heading");
contains(headings.text, "First chapter.", "Multi HTML: first chapter body");
contains(headings.text, "Second chapter.", "Multi HTML: second chapter body");
check(
  "Multi HTML: word count sums every chapter",
  headings.wordCount === exportChapter(chapterOne, { ...base, includeTitle: true, title: items[0].title }).wordCount +
    exportChapter(chapterTwo, { ...base, includeTitle: true, title: items[1].title }).wordCount,
  `${headings.wordCount}`,
);

const sceneBreaks = exportChapters(items, { ...multiBase, separator: "sceneBreak" });
absent(sceneBreaks.text, "<h2>", "Multi HTML (scene break mode): no chapter titles");
contains(sceneBreaks.text, "<hr />", "Multi HTML (scene break mode): a break sits between chapters");
check(
  "Multi HTML (scene break mode): exactly one break for two chapters",
  sceneBreaks.text.split("<hr />").length - 1 === 1,
  sceneBreaks.text,
);

const multiMd = exportChapters(items, { ...multiBase, format: "markdown" });
contains(multiMd.text, "## Chapter 1: Lamplighter's Hour", "Multi MD: first chapter title as heading");
contains(multiMd.text, "## Chapter 2: What the Tide Returns", "Multi MD: second chapter title as heading");

// ---------- a list item holding more than one paragraph ----------
// The schema allows it (`paragraph block*`) and a word-processor paste is how it arrives, so
// it belongs in the fixture the paste artifacts are already tested against.
const twoParaItem: DocNode = {
  type: "doc",
  content: [
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            { type: "paragraph", content: [text("first para")] },
            { type: "paragraph", content: [text("second para")] },
          ],
        },
        { type: "listItem", content: [{ type: "paragraph", content: [text("only para")] }] },
      ],
    },
  ],
};
const nested = exportChapter(twoParaItem, base);
contains(nested.text, "<li><p>first para</p><p>second para</p></li>", "HTML: multi-paragraph list item keeps its <p> pairs");
contains(nested.text, "<li>only para</li>", "HTML: single-paragraph list item is still unwrapped");
absent(nested.text, "para</p><p>second para</li>", "HTML: no unbalanced <p> left inside a list item");
check(
  "HTML: <p> and </p> counts match",
  (nested.text.match(/<p>/g) ?? []).length === (nested.text.match(/<\/p>/g) ?? []).length,
  nested.text,
);

// ---------- a link destination that cannot go bare ----------
// `autolink` is on, so URLs become links without the writer marking them up: a space or a
// parenthesis in one must not be able to break the surrounding Markdown.
const awkwardLink: DocNode = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [text("planet", [{ type: "link", attrs: { href: "https://e.com/Mercury_(planet) x" } }])],
    },
  ],
};
const awkwardMd = exportChapter(awkwardLink, { ...base, format: "markdown" });
contains(awkwardMd.text, "[planet](<https://e.com/Mercury_(planet) x>)", "MD: awkward destination uses the <> form");
const plainLinkMd = exportChapter(
  { type: "doc", content: [{ type: "paragraph", content: [text("tide", [{ type: "link", attrs: { href: "https://example.com/tide" } }])] }] },
  { ...base, format: "markdown" },
);
contains(plainLinkMd.text, "[tide](https://example.com/tide)", "MD: an ordinary destination stays bare");

// ---------- empty document ----------
const empty = exportChapter({ type: "doc", content: [{ type: "paragraph" }] }, base);
check("Empty chapter exports as an empty string", empty.text === "", JSON.stringify(empty.text));
check("Empty chapter counts zero words", empty.wordCount === 0);

// ---------- plain text ----------
// The third format, and the one most easily got wrong by treating it as "Markdown minus the
// symbols". It escapes nothing, carries no emphasis, and keeps only the structure that
// survives without markup.
const plain = exportChapter(doc, { ...base, format: "text" });

contains(plain.text, "Wren Ashcombe counted the steps", "TEXT: mention becomes a plain name");
absent(plain.text, "@Wren", "TEXT: the @ sigil is stripped");
absent(plain.text, "<p>", "TEXT: no markup at all");
absent(plain.text, "**", "TEXT: bold carries no asterisks");
absent(plain.text, NBSP, "TEXT: non-breaking spaces are normalised");
absent(plain.text, ZERO_WIDTH, "TEXT: zero-width characters are removed");
// The one that separates plain text from Markdown: prose punctuation is never escaped, so a
// writer's own asterisks and underscores arrive exactly as typed.
absent(plain.text, String.fromCharCode(0x5c), "TEXT: nothing is backslash-escaped");
contains(plain.text, "5 < 6 & \"quoted\" > 4", "TEXT: angle brackets and quotes are left alone");
contains(plain.text, "• ", "TEXT: bullet list items keep a bullet");

const plainTitled = exportChapter(doc, { ...base, format: "text", includeTitle: true });
check(
  "TEXT: the title is its own first line, unmarked",
  plainTitled.text.startsWith("Chapter 1\n"),
  JSON.stringify(plainTitled.text.slice(0, 30)),
);

const plainLink = exportChapter(
  {
    type: "doc",
    content: [
      { type: "paragraph", content: [text("the tide", [{ type: "link", attrs: { href: "https://example.com/tide" } }])] },
    ],
  },
  { ...base, format: "text" },
);
contains(plainLink.text, "the tide (https://example.com/tide)", "TEXT: a link keeps its address in brackets");

const plainAutolink = exportChapter(
  {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [text("https://example.com/tide", [{ type: "link", attrs: { href: "https://example.com/tide" } }])],
      },
    ],
  },
  { ...base, format: "text" },
);
check(
  "TEXT: an autolinked URL is not repeated after itself",
  (plainAutolink.text.match(/example.com/g) ?? []).length === 1,
  plainAutolink.text,
);

const plainMulti = exportChapters(
  [
    { title: "One", doc: { type: "doc", content: [{ type: "paragraph", content: [text("First.")] }] } },
    { title: "Two", doc: { type: "doc", content: [{ type: "paragraph", content: [text("Second.")] }] } },
  ],
  { format: "text", sceneBreak: "asterisks", separator: "sceneBreak" },
);
contains(plainMulti.text, "* * *", "TEXT: a scene break between chapters is bare asterisks");
absent(plainMulti.text, String.fromCharCode(0x5c) + "*", "TEXT: the scene break is not escaped");

// ---------- report ----------
if (failures.length > 0) {
  console.error(`\n${failures.length} export check(s) failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(
    `All export checks passed. HTML ${html.wordCount} words, Markdown ${md.wordCount} words, plain text ${plain.wordCount} words.`,
  );
}
