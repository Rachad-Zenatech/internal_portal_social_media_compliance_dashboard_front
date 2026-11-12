import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";

// "check": a compliance, sentiment or public mood check, which can take from seconds to minutes.
export type JobType = "document" | "database" | "upload" | "generic" | "check";

export type GlobalProgressJob = {
  id: string;
  title: string;
  jobId?: string;
  description?: string;
  type?: JobType;
  link_url?: string;
  submissionId?: string;
  fileId?: string;
  trackKind?: "doc_text" | "transcript";
  /** When it started, for "running for 0:42". */
  startedAt?: number;
  /** The page it was started on (path and query), so clicking it while it runs goes back there. */
  startedFrom?: string;
};

/** Where clicking a running job goes: a check back to the page it was started on (the step it runs on), anything else
 * to its own link (an upload's post), else where it started. */
export function jobHref(job: GlobalProgressJob): string | undefined {
  return job.type === "check" ? job.startedFrom ?? job.link_url : job.link_url ?? job.startedFrom;
}

type GlobalProgressContextType = {
  activeJobs: GlobalProgressJob[];
  addJob: (
    title: string,
    promise: Promise<any>,
    options?: {
      description?: string;
      type?: JobType;
      link_url?: string;
      submissionId?: string;
      trackKind?: "doc_text" | "transcript";
      /** Said in a message when it finishes, so people who went elsewhere know (with a link to link_url). */
      doneMessage?: string;
    }
  ) => void;
  removeJob: (id: string) => void;
};

const GlobalProgressContext = createContext<GlobalProgressContextType | undefined>(undefined);

export function GlobalProgressProvider({ children }: { children: ReactNode }) {
  const [activeJobs, setActiveJobs] = useState<GlobalProgressJob[]>(() => {
    try {
      const stored = localStorage.getItem("globalProgressJobs");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Filter out jobs that don't have a jobId or fileId yet, because the promise that would set it is gone after refresh.
        return parsed.filter((job: any) => Boolean(job.jobId || (job.submissionId && job.fileId)));
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("globalProgressJobs", JSON.stringify(activeJobs));
  }, [activeJobs]);

  const removeJob = (id: string) => {
    setActiveJobs((prev) => prev.filter((u) => u.id !== id));
  };

  const addJob = (
    title: string,
    promise: Promise<any>,
    options?: {
      description?: string;
      type?: JobType;
      link_url?: string;
      submissionId?: string;
      trackKind?: "doc_text" | "transcript";
      doneMessage?: string;
    }
  ) => {
    const id = Math.random().toString(36).substring(7);
    setActiveJobs((prev) => [
      ...prev,
      {
        id,
        title,
        description: options?.description,
        type: options?.type,
        link_url: options?.link_url,
        submissionId: options?.submissionId,
        trackKind: options?.trackKind,
        startedAt: Date.now(),
        startedFrom: window.location.pathname + window.location.search,
      },
    ]);

    promise
      .then((res) => {
        if (options?.doneMessage && localStorage.getItem("inAppAlerts") !== "false") {
          const link = options.link_url;
          toast.success(options.doneMessage, {
            action: link
              ? { label: "View", onClick: () => window.dispatchEvent(new CustomEvent("app:navigate", { detail: link })) }
              : undefined,
          });
        }
        const jobId = res?.backgroundJobId || res?.jobId;
        const fileId = res?.id;
        const docPending =
          res?.kind === "SCRIPT" ||
          (res?.kind === "MAIN" && /\.(txt|md|docx?|pdf)$/i.test(res?.original_name || ""));
        const videoPending = res?.kind === "MAIN" && String(res?.mime_type || "").startsWith("video/");

        if (jobId) {
          setActiveJobs((prev) => prev.map((u) => (u.id === id ? { ...u, jobId } : u)));
        } else if (
          options?.submissionId &&
          fileId &&
          ((docPending && res?.doc_text_status !== "COMPLETED" && res?.doc_text_status !== "FAILED") ||
            (videoPending && res?.transcript_status !== "COMPLETED" && res?.transcript_status !== "FAILED"))
        ) {
          const trackKind = videoPending ? "transcript" : "doc_text";
          setActiveJobs((prev) =>
            prev.map((u) =>
              u.id === id
                ? {
                    ...u,
                    fileId,
                    trackKind,
                    description:
                      trackKind === "transcript"
                        ? "Transcribing video & running compliance check..."
                        : "Reading document text & running compliance check...",
                  }
                : u
            )
          );
        } else {
          setTimeout(() => removeJob(id), 800);
        }
      })
      .catch(() => {
        setTimeout(() => removeJob(id), 500);
      });
  };

  return (
    <GlobalProgressContext.Provider value={{ activeJobs, addJob, removeJob }}>
      {children}
    </GlobalProgressContext.Provider>
  );
}

export function useGlobalProgress() {
  const context = useContext(GlobalProgressContext);
  if (!context) {
    throw new Error("useGlobalProgress must be used within a GlobalProgressProvider");
  }
  return context;
}

