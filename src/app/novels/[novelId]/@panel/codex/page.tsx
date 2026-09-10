/**
 * The `@panel` slot for `/codex`. Resolving to nothing here — rather than falling back to
 * `@panel/default.tsx`'s Command Centre — is what lets `WorkspaceShell` drop the Command
 * Centre column entirely, so the Codex browser's own entries list and entry detail get that
 * width instead, matching the handoff's full-page Codex layout. See also
 * `@panel/codex/[entryId]/page.tsx`, its sibling for the other Codex route shape.
 */
export default function CodexPanelSlot() {
  return null;
}
