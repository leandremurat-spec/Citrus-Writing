import { CommandCenter } from "@/components/command-center/command-center";

/**
 * Parallel-route fallback. It used to render `null`, which left 320px of empty panel on any
 * route the slot has no page for. The novel-root panel is the right thing to show: the codex
 * and the notes are still useful with no chapter open.
 */
export default function PanelDefault() {
  return <CommandCenter mentions={[]} chapter={null} status={null} />;
}
