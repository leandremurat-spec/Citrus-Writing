import * as React from "react";

/**
 * Turns `*starred words*` into bold, and nothing else.
 *
 * This exists so the marketing copy in `src/content/site-copy.ts` can stay plain strings that
 * anyone can edit, while the pricing bullets and figure captions keep the emphasis the design
 * puts on them. Before this, those lines were JSX fragments with `<strong>` inline, which meant
 * rewording one sentence involved editing a component.
 *
 * Deliberately not Markdown. A Markdown parser would be a dependency, and it would also give
 * the copy file a dozen syntaxes nobody asked for — links, headings, lists — every one of which
 * is a way to break the layout from a file that is meant to be safe to edit. One rule, and an
 * unmatched star is simply a star.
 */
export function Emphasis({ text }: { text: string }) {
  // Split on the starred runs, keeping them: "a *b* c" -> ["a ", "*b*", " c"].
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={index}>{part.slice(1, -1)}</strong>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}
