import { useRef, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { submissionService } from "@/services/submissionService";
import type { ContentType, SubmissionFile } from "@/types/submission";

interface PostTypeChangeOptions {
  contentType: ContentType;
  files: SubmissionFile[];
  idRef: RefObject<string | null>;
  saveChain: RefObject<Promise<string | null>>;
  busy: boolean;
  onRemove: (fileId: string) => void;
  onChange: (value: ContentType) => void;
  refreshScript: () => unknown;
}

/** Remove saved attachments before switching to another post type. */
export function usePostTypeChange({ contentType, files, idRef, saveChain: saveChainRef, busy, onRemove, onChange, refreshScript }: PostTypeChangeOptions) {
  const [changingPostType, setChangingPostType] = useState(false);
  const changingRef = useRef(false);

  const changePostType = async (value: ContentType) => {
    if (value === contentType || busy || changingRef.current) return;
    changingRef.current = true;
    setChangingPostType(true);
    // Serialize with autosaves so an older save cannot restore removed files.
    const clearFiles = saveChainRef.current.catch(() => null).then(async () => {
      const id = idRef.current;
      if (id) {
        for (const file of files) {
          await submissionService.removeFile(id, file.id);
          onRemove(file.id);
        }
      }
      return id;
    });
    saveChainRef.current = clearFiles;
    try {
      await clearFiles;
      onChange(value);
    } catch (error) {
      toast.error(`Couldn't clear the uploaded files. Post type unchanged: ${(error as Error).message}`);
    } finally {
      void refreshScript();
      changingRef.current = false;
      setChangingPostType(false);
    }
  };

  return { changingPostType, changePostType };
}
