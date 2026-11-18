import { useState, type Ref } from "react";
import { ChevronDown, Highlighter, Loader2, MessageSquarePlus } from "lucide-react";

import CollabEditor, { type CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import ScriptMirrorEditor from "@/components/scriptdoc/ScriptMirrorEditor";
import SharedEditorFrame from "@/components/scriptdoc/SharedEditorFrame";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { LiveProvider } from "@/lib/scriptDocLive";
import type { DocNote } from "@/types/scriptDoc";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", hex: "#eab308" },
  { label: "Green", hex: "#22c55e" },
  { label: "Blue", hex: "#3b82f6" },
  { label: "Pink", hex: "#ec4899" },
  { label: "Purple", hex: "#a855f7" },
  { label: "Orange", hex: "#f97316" },
  { label: "Red", hex: "#ef4444" },
  { label: "Teal", hex: "#14b8a6" },
];

/** Highlight color palette (preset swatches + custom color picker). */
function HighlightColorMenu({
  color,
  onPick,
}: {
  color: string;
  onPick: (hex: string, applyNow: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-1.5"
          title="Choose highlight colour"
          onMouseDown={(e) => e.preventDefault()}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-2.5" onOpenAutoFocus={(e) => e.preventDefault()}>
        <p className="mb-2 text-[11px] font-medium text-muted-foreground">Highlight colour</p>
        <div className="grid grid-cols-4 gap-1.5">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              title={c.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(c.hex, true);
                setOpen(false);
              }}
              className={`h-6 w-full rounded border transition-transform hover:scale-105 ${
                color.toLowerCase() === c.hex ? "ring-2 ring-foreground ring-offset-1" : "border-border"
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="color"
              value={color}
              onChange={(e) => onPick(e.target.value, false)}
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
            />
            <span>Custom</span>
          </label>
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-2 text-[11px]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(color, true);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Highlight and Comment, in the editor's toolbar. */
function NoteButtons({ onStart }: { onStart: (kind: "highlight" | "comment", color?: string) => void }) {
  const [color, setColor] = useState("#eab308");
  const pick = (hex: string, applyNow: boolean) => {
    setColor(hex);
    if (applyNow) onStart("highlight", hex);
  };
  return (
    <>
      <div className="flex items-center">
        <Button size="sm" variant="ghost" className="h-8 pr-1.5" onMouseDown={(e) => e.preventDefault()} onClick={() => onStart("highlight", color)}>
          <Highlighter className="mr-1 h-4 w-4" />
          <span>Highlight</span>
          <span className="ml-1.5 h-2.5 w-2.5 rounded-full border border-border/80" style={{ backgroundColor: color }} />
        </Button>
        <HighlightColorMenu color={color} onPick={pick} />
      </div>
      <Button size="sm" variant="ghost" className="h-8" onMouseDown={(e) => e.preventDefault()} onClick={() => onStart("comment")}>
        <MessageSquarePlus className="mr-1 h-4 w-4" />
        Comment
      </Button>
    </>
  );
}

/** The script page itself, once the live connection is up (until then, a short wait). */
export default function DocEditorColumn({
  provider,
  ready,
  editorRef,
  user,
  editable,
  canNote,
  seedHtml,
  notes,
  activeNoteId,
  onChange,
  onSelectNote,
  onStartNote,
  sharedDocId,
  sharedReadOnly,
  goToNote,
  onEmbedSelection,
  mirrorHtml,
  bar,
}: {
  provider: LiveProvider | null;
  ready: boolean;
  editorRef: Ref<CollabEditorHandle>;
  user: { id: string; name: string; color: string };
  editable: boolean;
  canNote: boolean;
  seedHtml: string | null;
  notes: DocNote[];
  activeNoteId: string | null;
  onChange: () => void;
  onSelectNote: (id: string) => void;
  onStartNote: (kind: "highlight" | "comment", color?: string) => void;
  /** This script's id when it is edited in the Share Document portal: that editor is shown here instead of this one. */
  sharedDocId?: string | null;
  sharedReadOnly?: boolean;
  goToNote?: { id: string; seq: number } | null;
  onEmbedSelection?: (sel: { quote: string; start: number } | null) => void;
  /** For a reviewer of a script written in the Share Document portal: its text, shown read-only to highlight and comment on. */
  mirrorHtml?: string | null;
  /** A strip above the shared editor (see EditorLayoutBar). */
  bar?: React.ReactNode;
}) {
  if (sharedDocId) {
    return (
      <div className="flex min-h-[24rem] min-w-0 flex-1 flex-col">
        {bar}
        <SharedEditorFrame
          docId={sharedDocId}
          readOnly={sharedReadOnly}
          notes={notes}
          activeNoteId={activeNoteId}
          goToNote={goToNote}
          onSelectionChange={onEmbedSelection}
          onSelectNote={onSelectNote}
          toolbarExtra={canNote && sharedReadOnly ? <NoteButtons onStart={onStartNote} /> : undefined}
        />
      </div>
    );
  }
  if (mirrorHtml != null) {
    return (
      <div className="flex min-h-[24rem] min-w-0 flex-1 flex-col">
        {bar}
        <ScriptMirrorEditor
          ref={editorRef}
          html={mirrorHtml}
          notes={notes}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
          toolbarExtra={canNote && <NoteButtons onStart={onStartNote} />}
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-[24rem] min-w-0 flex-1 flex-col">
      {provider && ready ? (
        <CollabEditor
          ref={editorRef}
          key={provider.doc.guid}
          provider={provider}
          user={user}
          editable={editable}
          seedHtml={seedHtml}
          notes={notes}
          activeNoteId={activeNoteId}
          onChange={onChange}
          onSelectNote={onSelectNote}
          toolbarExtra={canNote && <NoteButtons onStart={onStartNote} />}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Connecting to the live script…
        </div>
      )}
    </div>
  );
}
