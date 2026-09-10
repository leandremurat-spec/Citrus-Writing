import { CommandCenter } from "@/components/command-center/command-center";

/** Right panel when no chapter is open: the whole codex (from the layout's provider). */
export default function NovelPanel() {
  return <CommandCenter mentions={[]} chapter={null} status={null} />;
}
