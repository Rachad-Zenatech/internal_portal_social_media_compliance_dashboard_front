import { FileText, Loader2, Database, Upload, Settings, ShieldCheck, ChevronUp, ChevronDown, ArrowUpRight } from "lucide-react";
import { jobHref, useGlobalProgress, type GlobalProgressJob } from "@/lib/GlobalProgressContext";
import { useNotifications } from "@/hooks/useNotifications";
import { submissionService } from "@/services/submissionService";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

export function GlobalProgressOverlay() {
  const queryClient = useQueryClient();
  const { activeJobs, removeJob } = useGlobalProgress();
  const { data: notifications = [] } = useNotifications({
    refetchInterval: activeJobs.some((j) => Boolean(j.jobId)) ? 2000 : false,
  });
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  // A clock for "running for 0:42", only while something runs.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (activeJobs.length === 0) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [activeJobs.length]);
  // A message that ends with "View" opens its page from wherever you are.
  useEffect(() => {
    const go = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (url) navigate(url.startsWith("/") ? url : `/${url}`);
    };
    window.addEventListener("app:navigate", go);
    return () => window.removeEventListener("app:navigate", go);
  }, [navigate]);
  // A check that starts opens the list, so what it is doing (and that you needn't wait) is in view.
  const checkCount = activeJobs.filter((j) => j.type === "check").length;
  useEffect(() => {
    if (checkCount > 0) setIsExpanded(true);
  }, [checkCount]);

  // Match notification-backed background jobs (same pattern as Finance application)
  useEffect(() => {
    activeJobs.forEach((job) => {
      if (job.jobId) {
        const matchingNotification = notifications.find(
          (n) => String((n as any).background_job_id) === String(job.jobId)
        );
        if (matchingNotification) {
          removeJob(job.id);
          queryClient.invalidateQueries({ queryKey: ["notifications", "unread-count"] });

          const alertsEnabled = localStorage.getItem("inAppAlerts") !== "false";
          if (alertsEnabled) {
            const isFailure = matchingNotification.type.includes("failed");
            const targetUrl = matchingNotification.link_url || job.link_url;
            const toastOptions = {
              description: matchingNotification.message || `${job.title} has completed successfully.`,
              action: targetUrl
                ? {
                    label: "View",
                    onClick: () => {
                      if (targetUrl.startsWith("http")) {
                        window.location.assign(targetUrl);
                      } else {
                        const cleanUrl = targetUrl.startsWith("/") ? targetUrl : "/" + targetUrl;
                        navigate(cleanUrl);
                      }
                    },
                  }
                : undefined,
            };

            if (isFailure) {
              toast.error(matchingNotification.title, toastOptions);
            } else {
              toast.success(matchingNotification.title, toastOptions);
            }
          }
        }
      }
    });
  }, [notifications, activeJobs, removeJob, queryClient, navigate]);

  // Poll submission file processing jobs (script/document text extraction & video transcription)
  useEffect(() => {
    const fileJobs = activeJobs.filter((j) => j.submissionId && j.fileId);
    if (fileJobs.length === 0) return;

    const timer = window.setInterval(async () => {
      const bySub = new Map<string, typeof fileJobs>();
      for (const job of fileJobs) {
        const list = bySub.get(job.submissionId!) ?? [];
        list.push(job);
        bySub.set(job.submissionId!, list);
      }

      for (const [subId, jobs] of bySub.entries()) {
        try {
          const sub = await submissionService.get(subId);
          for (const job of jobs) {
            const file = sub.files.find((f) => f.id === job.fileId);
            if (!file) {
              removeJob(job.id);
              continue;
            }
            const status = job.trackKind === "transcript" ? file.transcript_status : file.doc_text_status;
            const error = job.trackKind === "transcript" ? file.transcript_error : file.doc_text_error;
            if (status === "COMPLETED" || status === "FAILED") {
              removeJob(job.id);
              queryClient.invalidateQueries({ queryKey: ["submission", subId] });
              queryClient.invalidateQueries({ queryKey: ["submissions"] });
              queryClient.invalidateQueries({ queryKey: ["script", subId] });

              const alertsEnabled = localStorage.getItem("inAppAlerts") !== "false";
              if (alertsEnabled) {
                const targetUrl = job.link_url || `/submissions/${subId}`;
                if (status === "FAILED") {
                  toast.error(`Processing failed: ${job.title}`, {
                    description: error || "Could not process the uploaded file.",
                  });
                } else {
                  toast.success(`Upload ready: ${job.title}`, {
                    description: `${file.original_name} has finished processing.`,
                    action: {
                      label: "View",
                      onClick: () => navigate(targetUrl),
                    },
                  });
                }
              }
            }
          }
        } catch {
          // Retry on next tick
        }
      }
    }, 2000);

    return () => window.clearInterval(timer);
  }, [activeJobs, removeJob, queryClient, navigate]);

  // Collapse if there are no more active jobs (so it doesn't open empty next time)
  useEffect(() => {
    if (activeJobs.length === 0) {
      setIsExpanded(false);
    }
  }, [activeJobs.length]);

  if (activeJobs.length === 0) return null;

  // Clicking a running job opens the page it's for.
  const open = (job: GlobalProgressJob) => {
    const href = jobHref(job);
    if (href) navigate(href.startsWith("/") ? href : `/${href}`);
  };
  const only = activeJobs.length === 1 ? activeJobs[0] : null;

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
        {/* Expanded list of jobs */}
        {isExpanded && (
          <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-2 fade-in duration-200">
            {activeJobs.map((job) => {
              let Icon = FileText;
              if (job.type === "database") Icon = Database;
              else if (job.type === "upload") Icon = Upload;
              else if (job.type === "generic") Icon = Settings;
              else if (job.type === "check") Icon = ShieldCheck;
              const seconds = job.startedAt ? Math.max(0, Math.floor((now - job.startedAt) / 1000)) : null;
              const elapsed = seconds == null ? null : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

              const href = jobHref(job);
              return (
                <div key={job.id} className="pointer-events-auto">
                  <button
                    type="button"
                    onClick={() => open(job)}
                    disabled={!href}
                    title={href ? "Open the page it's running for" : undefined}
                    className="group w-full text-left bg-background border shadow-xl rounded-xl p-4 flex items-center gap-4 min-w-[300px] max-w-[400px] transition-colors enabled:hover:border-primary/40 enabled:hover:bg-accent/40 disabled:cursor-default"
                  >
                    <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold text-foreground truncate mr-2">
                          {job.title}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          {href && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary opacity-70 group-hover:opacity-100">
                              Open <ArrowUpRight className="h-3 w-3" />
                            </span>
                          )}
                          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                        </span>
                      </div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1.5">
                        {job.description || "Processing..."}
                        {elapsed ? ` · ${elapsed}` : ""}
                      </p>
                      {job.type === "check" && (
                        <>
                          <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-muted">
                            <span className="absolute h-full rounded-full bg-primary" style={{ animation: "indeterminate 1.4s ease-in-out infinite" }} />
                          </div>
                          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground normal-case">
                            A few seconds to a few minutes. You can keep using the site; we&apos;ll tell you when it&apos;s done.
                          </p>
                        </>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* The pill: its label opens the page (one task) or the list (several); the arrow shows or hides the list. */}
        <div className="pointer-events-auto flex items-center bg-background border shadow-xl rounded-full text-foreground overflow-hidden">
          <button
            type="button"
            onClick={() => (only && jobHref(only) ? open(only) : setIsExpanded(!isExpanded))}
            title={only && jobHref(only) ? "Open the page it's running for" : undefined}
            className="flex items-center gap-2 pl-4 pr-2 py-2 hover:bg-accent transition-colors"
          >
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-semibold whitespace-nowrap">
              {only && only.type === "check" ? `${only.title}…` : `${activeJobs.length} ${activeJobs.length === 1 ? "task is" : "tasks are"} running...`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? "Hide running tasks" : "Show running tasks"}
            aria-expanded={isExpanded}
            className="self-stretch border-l px-2.5 hover:bg-accent transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes indeterminate {
          0% { left: -33%; width: 33%; }
          50% { width: 50%; }
          100% { left: 100%; width: 33%; }
        }
      `}</style>
    </>
  );
}

