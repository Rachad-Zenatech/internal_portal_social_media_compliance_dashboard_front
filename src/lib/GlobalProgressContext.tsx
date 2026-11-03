import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type JobType = "document" | "database" | "upload" | "generic";

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
};

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
      },
    ]);

    promise
      .then((res) => {
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

