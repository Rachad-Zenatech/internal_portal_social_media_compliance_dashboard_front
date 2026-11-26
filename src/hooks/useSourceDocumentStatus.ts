import { useEffect, useState } from "react";
import { submissionService } from "@/services/submissionService";

type Status = "PROCESSING" | "COMPLETED" | "FAILED" | "UNKNOWN" | "MISSING";

export function useSourceDocumentStatus(submissionId: string, fileId: string | null) {
  const [status, setStatus] = useState<Status>("PROCESSING");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fileId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    setStatus("PROCESSING");
    setError("");
    const poll = async () => {
      try {
        const submission = await submissionService.get(submissionId);
        if (cancelled) return;
        const file = submission.files.find((item) => item.id === fileId);
        if (!file) { setStatus("MISSING"); return; }
        const next = file.doc_text_status ?? "PROCESSING";
        setStatus(next);
        setError(file.doc_text_error ?? "");
        if (next === "COMPLETED" || next === "FAILED") return;
      } catch {
        if (cancelled) return;
        setStatus("UNKNOWN");
      }
      timer = setTimeout(poll, 5000);
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [submissionId, fileId]);

  return { status, error };
}
