import { useMemo, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import { matchingQuote } from "@/lib/replaceQuote";
import type { DocDetail, DocNote } from "@/types/scriptDoc";

const FLAG_FOCUS_ID = "local-compliance-flag-focus";

/** A flag's highlight is local navigation, never a saved reviewer comment or document edit. */
export function useScriptFlagFocus(doc: DocDetail | undefined, editor: RefObject<CollabEditorHandle | null>, notes: DocNote[]) {
  const [focus, setFocus] = useState<{ docId: string; note: DocNote; navigation: { id: string; seq: number } } | null>(null);
  const current = focus?.docId === doc?.id ? focus : null;
  const editorNotes = useMemo(() => current ? [...notes, current.note] : notes, [notes, current]);
  const clear = () => setFocus(null);
  const find = (terms: string[]) => {
    if (!doc) return;
    if (!doc.share_document_id) {
      if (!terms.some((term) => editor.current?.find(term))) toast.info("No matching passage in the current script. The flag may describe missing content or wording that has changed.");
      return;
    }
    const html = new DOMParser().parseFromString(doc.body_html, "text/html");
    const blocks = [...html.querySelectorAll("p,h1,h2,h3,li")].map((node) => node.textContent ?? "");
    const text = blocks.join("\n") || html.body.textContent || doc.body_text;
    const quote = terms.map((term) => matchingQuote(text, term)).find(Boolean);
    if (!quote) {
      clear();
      toast.info("No matching passage in the current script. The flag may describe missing content or wording that has changed.");
      return;
    }
    setFocus((previous) => ({
      docId: doc.id,
      navigation: { id: FLAG_FOCUS_ID, seq: (previous?.navigation.seq ?? 0) + 1 },
      note: { id: FLAG_FOCUS_ID, kind: "highlight", quote, start: 0, text: "", color: "#f59e0b",
        author_id: "", author_name: "Compliance flag", created_at: new Date().toISOString(), resolved: false, replies: [] },
    }));
  };
  return { find, clear, notes: editorNotes,
    activeId: current?.note.id, navigation: current?.navigation, isFocus: (id: string) => id === FLAG_FOCUS_ID };
}
