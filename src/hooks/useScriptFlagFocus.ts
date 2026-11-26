import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import type { CollabEditorHandle } from "@/components/scriptdoc/CollabEditor";
import type { DocDetail, ScriptFocusRequest } from "@/types/scriptDoc";

/** A flag's highlight is local navigation, never a saved reviewer comment or document edit. */
export function useScriptFlagFocus(doc: DocDetail | undefined, editor: RefObject<CollabEditorHandle | null>) {
  const sequence = useRef(0);
  const [focus, setFocus] = useState<{ docId: string; request: ScriptFocusRequest } | null>(null);
  const current = focus?.docId === doc?.id ? focus : null;
  const find = (terms: string[]) => {
    if (!doc) return;
    if (!doc.share_document_id || !terms.length) {
      if (!terms.some((term) => editor.current?.find(term))) toast.info("No matching passage in the current script. The flag may describe missing content or wording that has changed.");
      return;
    }
    setFocus({ docId: doc.id, request: { requestId: ++sequence.current, terms } });
  };
  return { find, request: current?.request };
}
