import type { Ref } from "react";
import { Highlighter, Loader2, MessageSquarePlus } from "lucide-react";

import CollabEditor, { type CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import ScriptMirrorEditor from "@/components/scriptdoc/ScriptMirrorEditor";
import SharedEditorFrame from "@/components/scriptdoc/SharedEditorFrame";
import { Button } from "@/components/ui/button";
import type { LiveProvider } from "@/lib/scriptDocLive";
import type { DocNote } from "@/types/scriptDoc";

/** Highlight and Comment, in the editor's toolbar. */
function NoteButtons({ onStart }: { onStart: (kind: "highlight" | "comment") => void }) {
  return (
    <>
      <Button size="sm" variant="ghost" className="h-8" onMouseDown={(e) => e.preventDefault()} onClick={() => onStart("highlight")}>
        <Highlighter className="mr-1 h-4 w-4" />
        Highlight
      </Button>
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
  onStartNote: (kind: "highlight" | "comment") => void;
  /** This script's id when it is edited in the Share Document portal: that editor is shown here instead of this one. */
  sharedDocId?: string | null;
  /** For a reviewer of a script written in the Share Document portal: its text, shown read-only to highlight and comment on. */
  mirrorHtml?: string | null;
  /** A strip above the shared editor (see EditorLayoutBar). */
  bar?: React.ReactNode;
}) {
  if (sharedDocId) {
    return (
      <div className="flex min-h-[24rem] min-w-0 flex-1 flex-col">
        {bar}
        <SharedEditorFrame docId={sharedDocId} />
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
