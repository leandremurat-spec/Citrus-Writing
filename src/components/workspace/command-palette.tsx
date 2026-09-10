"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CircleDot,
  Columns3,
  Download,
  FileText,
  Milestone,
  Moon,
  PanelLeft,
  PanelRight,
  Sun,
  Keyboard,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";

import { createArc, createChapter, createVolume } from "@/lib/actions/binder";
import { setChapterStatus } from "@/lib/actions/chapters";
import { CHAPTER_STATUSES, STATUS_META } from "@/lib/binder/status";
import { ROOT, flattenTree, suggestTitle, type BinderNode } from "@/lib/binder/tree";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { setBinderOpen, setCommandOpen, toggleFocusMode, useWorkspaceLayout } from "@/components/workspace/layout-store";
import { setPalette, usePalette } from "@/components/workspace/palette-store";
import { PALETTE_LIST, paletteSwatch, type Palette } from "@/lib/theme/palettes";

/**
 * ⌘K. `cmdk` was already in the bundle behind an unused primitive, which is why the palette
 * is built on it rather than on the Base UI menus the rest of the app uses.
 *
 * It is the one place every action in the workspace can be reached by name, and it is also
 * the answer to discoverability for the things that otherwise live in hover menus.
 */
export function CommandPalette({
  novelId,
  nodes,
  onExport,
}: {
  novelId: string;
  nodes: BinderNode[];
  onExport: () => void;
}) {
  const router = useRouter();
  const params = useParams<{ chapterId?: string }>();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const palette = usePalette();
  const { binderOpen, commandOpen } = useWorkspaceLayout();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const chapters = React.useMemo(() => flattenTree(nodes).filter((node) => node.type === "chapter"), [nodes]);

  const run = (action: () => void | Promise<void>) => () => {
    setOpen(false);
    void action();
  };

  const create = async (kind: "chapter" | "arc" | "volume") => {
    const title = suggestTitle(nodes, kind);
    const response =
      kind === "chapter"
        ? await createChapter({ novelId, parent: ROOT })
        : kind === "arc"
          ? await createArc({ novelId, title, parent: ROOT })
          : await createVolume({ novelId, title });
    if (!response.ok) {
      toast.error(response.error);
      return;
    }
    if (kind === "chapter" && "id" in response) router.push(`/novels/${novelId}/chapters/${response.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="overflow-hidden p-0 sm:max-w-lg">
        {/* A dialog needs both, and neither belongs on screen above a search field. */}
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search chapters and workspace commands.</DialogDescription>

        <Command loop>
          <CommandInput placeholder="Jump to a chapter, or type a command…" onClose={() => setOpen(false)} />
          <CommandList>
            <CommandEmpty>Nothing matches that.</CommandEmpty>

            {chapters.length > 0 && (
              <CommandGroup heading="Chapters">
                {chapters.map((chapter) => (
                  <CommandItem
                    key={chapter.id}
                    value={`chapter ${chapter.title}`}
                    onSelect={run(() => router.push(`/novels/${novelId}/chapters/${chapter.id}`))}
                  >
                    <FileText />
                    <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                    {chapter.id === params.chapterId && <span className="text-2xs text-subtle">open</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Create">
              <CommandItem value="new chapter" onSelect={run(() => create("chapter"))}>
                <FileText /> New chapter
              </CommandItem>
              <CommandItem value="new arc" onSelect={run(() => create("arc"))}>
                <Milestone /> New arc
              </CommandItem>
              <CommandItem value="new volume" onSelect={run(() => create("volume"))}>
                <BookOpen /> New volume
              </CommandItem>
            </CommandGroup>

            {params.chapterId && (
              <CommandGroup heading="This chapter">
                {CHAPTER_STATUSES.map((status) => {
                  const meta = STATUS_META[status];
                  return (
                    <CommandItem
                      key={status}
                      value={`set status ${meta.label}`}
                      onSelect={run(async () => {
                        const response = await setChapterStatus({ chapterId: params.chapterId!, status });
                        if (!response.ok) toast.error(response.error);
                      })}
                    >
                      <CircleDot /> Mark as {meta.label.toLowerCase()}
                    </CommandItem>
                  );
                })}
                <CommandItem value="export chapter" onSelect={run(onExport)}>
                  <Download /> Export this chapter…
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Workspace">
              <CommandItem value="toggle binder" onSelect={run(() => setBinderOpen(!binderOpen))}>
                <PanelLeft /> {binderOpen ? "Hide" : "Show"} the binder
              </CommandItem>
              <CommandItem value="toggle command centre panel" onSelect={run(() => setCommandOpen(!commandOpen))}>
                <PanelRight /> {commandOpen ? "Hide" : "Show"} the command centre
              </CommandItem>
              <CommandItem
                value="keyboard shortcuts help"
                onSelect={run(() => {
                  // The sheet owns its own shortcut; the palette just plays it back.
                  window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true, bubbles: true }));
                })}
              >
                <Keyboard /> Keyboard shortcuts
              </CommandItem>
              <CommandItem value="focus mode" onSelect={run(toggleFocusMode)}>
                <Columns3 /> Toggle focus mode
              </CommandItem>
              <CommandItem
                value="toggle theme light dark"
                onSelect={run(() => setTheme(theme === "light" ? "dark" : "light"))}
              >
                {theme === "light" ? <Moon /> : <Sun />} Switch to {theme === "light" ? "dark" : "light"} theme
              </CommandItem>
            </CommandGroup>

            {/* A row each rather than one cycling item: five palettes cycled blind is a
                slot machine, and the point of the palette is that you know which one you
                asked for. The swatch is the same one Settings draws, from the same data. */}
            <CommandGroup heading="Palette">
              {PALETTE_LIST.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`palette theme ${entry.label} ${entry.blurb}`}
                  onSelect={run(() => setPalette(entry.id))}
                >
                  <PaletteDot palette={entry} scheme={resolvedTheme === "dark" ? "dark" : "light"} />
                  {entry.label}
                  {entry.id === palette && <span className="ml-auto text-2xs text-subtle">current</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A palette in one 16px circle: the desk, the page lifted off it, and the two accents. Drawn
 * from `paletteSwatch()`, so it shows the colours the stylesheet actually paints rather than a
 * second set that happens to match today.
 *
 * `resolvedTheme` is read by the caller and passed in. It is undefined until next-themes has
 * mounted, but this subtree only exists once the dialog is open — which is client state — so
 * there is no server render for it to disagree with.
 */
function PaletteDot({ palette, scheme }: { palette: Palette; scheme: "light" | "dark" }) {
  const swatch = paletteSwatch(palette, scheme);
  return (
    <span
      aria-hidden
      className="relative size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-edge"
      style={{ background: swatch.ground }}
    >
      <span className="absolute inset-x-0 bottom-0 h-2" style={{ background: swatch.sheet }} />
      <span className="absolute bottom-[3px] left-[3px] size-1 rounded-full" style={{ background: swatch.press }} />
      <span className="absolute bottom-[3px] left-[7px] size-1 rounded-full" style={{ background: swatch.ochre }} />
    </span>
  );
}
