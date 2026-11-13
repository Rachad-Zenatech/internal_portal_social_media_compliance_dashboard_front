import { createContext, useContext, type ReactNode } from "react";

import { useSourceConfirmations, type SourceConfirmationsApi } from "@/hooks/useSourceConfirmations";

const Context = createContext<SourceConfirmationsApi | null>(null);

/** Gives the source rows inside it the post's saved calls on its sources and each source's standing with reviewers. */
export function SourceConfirmationsProvider({
  submissionId,
  urls,
  children,
}: {
  submissionId?: string | null;
  urls: string[];
  children: ReactNode;
}) {
  const api = useSourceConfirmations(submissionId, urls);
  return <Context.Provider value={api}>{children}</Context.Provider>;
}

/** The saved calls, or null outside a provider (then calls aren't saved). */
export function useSourceCalls(): SourceConfirmationsApi | null {
  return useContext(Context);
}
