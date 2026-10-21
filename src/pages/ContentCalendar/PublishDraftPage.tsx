import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, isBefore } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FlaskConical,
  Info,
  Loader2,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import DemoPoster from "@/components/video/DemoPoster";
import PostPreview, { ChannelAvatar } from "@/components/submissions/PostPreview";
import { MODE_LABELS, fromSubmission, publishInfo, publishKey, recordPublish, sampleItems, usePublished } from "@/lib/contentCalendar";
import { useAuth } from "@/lib/AuthContext";
import { submissionService } from "@/services/submissionService";
import type { CalendarItem } from "@/types/calendar";

const platformName = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;

/** Mock steps; each becomes a real API call once the platform is connected. */
function stepsFor(platform: string, hasMedia: boolean) {
  const name = platformName(platform);
  const info = publishInfo(platform);
  return [
    `Connect to the ${name} account`,
    ...(hasMedia ? [`Upload media to ${name}`] : []),
    info.mode === "HANDOFF" ? "Assemble the post package" : `Create the ${info.mode === "SCHEDULED" ? "scheduled post" : info.mode === "PRIVATE_UPLOAD" ? "private upload" : "draft"}`,
    "Save the result to the calendar",
  ];
}

export default function PublishDraftPage() {
  const { itemId = "", platform = "" } = useParams();
  const navigate = useNavigate();
  const published = usePublished();
  const record = published[publishKey(itemId, platform)];

  const { hasPermission } = useAuth();
  const scope = hasPermission("CONTENT_SUBMISSIONS_VIEW") ? "all" : "mine";
  const isSubmission = itemId.startsWith("sub-");
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["submissions", scope],
    queryFn: () => submissionService.list(undefined, scope),
    enabled: isSubmission,
  });
  const item: CalendarItem | undefined = useMemo(() => {
    if (!isSubmission) return sampleItems().find((i) => i.id === itemId);
    const s = submissions.find((x) => `sub-${x.id}` === itemId);
    return s ? fromSubmission(s) ?? undefined : undefined;
  }, [isSubmission, itemId, submissions]);

  const info = publishInfo(platform);
  const name = platformName(platform);
  const steps = stepsFor(platform, Boolean(item?.media || item?.poster));
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(-1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent("set-breadcrumb-trail", {
        detail: {
          path: `/content-calendar/publish/${itemId}/${platform}`,
          items: [{ title: "Content Calendar", path: "/content-calendar" }, { title: `Publish to ${name}` }],
        },
      })
    );
  }, [itemId, platform, name]);

  if (isSubmission && isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading...
      </div>
    );
  }
  if (!item || !item.platforms.includes(platform)) {
    return (
      <div className="py-24 text-center space-y-3">
        <p className="text-sm text-muted-foreground">This post isn't on the calendar for {name || "that platform"}.</p>
        <Button size="sm" variant="outline" asChild>
          <Link to="/content-calendar">Back to the calendar</Link>
        </Button>
      </div>
    );
  }

  const publishAt = new Date(item.publishAt);
  const captionLength = item.caption.length;
  const overLimit = captionLength > info.captionLimit;
  const pastDate = isBefore(publishAt, new Date());
  const remaining = item.platforms.filter((p) => p !== platform && !published[publishKey(item.id, p)]);

  const start = () => {
    if (running) return;
    setRunning(true);
    setStepIndex(0);
    // Simulated: each step "takes" a moment. Nothing is sent to the platform.
    steps.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          if (i < steps.length - 1) {
            setStepIndex(i + 1);
          } else {
            recordPublish(item.id, platform, info.mode);
            setRunning(false);
            setStepIndex(-1);
            toast.success(`${MODE_LABELS[info.mode]} created for ${name} (simulated).`);
          }
        }, 650 * (i + 1))
      );
    });
  };

  const copyCaption = () =>
    navigator.clipboard.writeText(item.caption).then(
      () => toast.success("Caption copied."),
      () => toast.error("Couldn't copy to the clipboard")
    );

  return (
    <div className="w-full max-w-[1200px] mx-auto space-y-4 sm:space-y-5 pb-12 animate-in fade-in duration-300">
      <DashboardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-xl border border-border bg-card shadow-xs">
              <PlatformIcon platform={platform as SocialPlatform} className="w-5 h-5" />
            </span>
            Publish to {name}
          </span>
        }
        subtitle={`${item.title} · ${item.referenceCode}`}
        actions={
          <Button size="sm" variant="outline" asChild className="text-xs gap-1.5">
            <Link to="/content-calendar">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to calendar
            </Link>
          </Button>
        }
      />

      <div className="flex items-start gap-2 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2.5 text-xs text-violet-900 dark:text-violet-200">
        <FlaskConical className="w-4 h-4 shrink-0 mt-px" />
        <span>
          <strong>Simulated.</strong> Nothing is sent to {name} yet. When the {name} API is connected, this page makes the real calls and
          links straight to the {MODE_LABELS[info.mode].toLowerCase()}.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px] gap-4 sm:gap-5 items-start">
        <Card className="p-4 gap-3 border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How it will look on {name}</p>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1" onClick={copyCaption}>
              <Copy className="w-3.5 h-3.5" /> Copy caption
            </Button>
          </div>
          <div className="max-w-[520px] w-full mx-auto">
            <PostPreview
              platform={platform}
              account={item.account}
              title={item.title}
              caption={item.caption}
              media={item.media}
              mediaNode={item.poster ? <DemoPoster variant={item.poster} className="w-full h-full" /> : undefined}
              whenLabel={format(publishAt, "MMM d, h:mm a")}
            />
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 gap-3 border-border/80 shadow-xs">
            <p className="text-sm font-semibold">Before publishing</p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Approved{item.approvedBy ? ` by ${item.approvedBy}` : ""}
                  {item.score != null && <span className="text-muted-foreground"> · rulebook check {item.score}/100</span>}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <ChannelAvatar account={item.account} size="sm" />
                <span>
                  Posts as <strong>{item.account?.account_name ?? "no channel selected"}</strong>
                  {item.account?.handle && <span className="text-muted-foreground"> @{item.account.handle}</span>}
                </span>
              </li>
              <li className="flex items-center gap-2">
                {pastDate ? <Info className="w-4 h-4 text-amber-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span>
                  Planned for {format(publishAt, "EEE MMM d, h:mm a")}
                  {pastDate && <span className="text-amber-700 dark:text-amber-300"> · that time has passed</span>}
                </span>
              </li>
              <li className="flex items-center gap-2">
                {overLimit ? <XCircle className="w-4 h-4 text-red-600 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                <span>
                  Caption {captionLength.toLocaleString()} / {info.captionLimit.toLocaleString()} characters
                  {overLimit && <span className="text-red-700 dark:text-red-300"> · too long for {name}</span>}
                </span>
              </li>
            </ul>
          </Card>

          <Card className="p-4 gap-3 border-border/80 shadow-xs">
            <div>
              <p className="text-sm font-semibold">What this creates</p>
              <p className="text-xs text-foreground mt-1">{info.result}.</p>
              <p className="text-[11px] text-muted-foreground mt-1">{info.note}</p>
            </div>

            {record ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs space-y-1">
                  <p className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="w-4 h-4" /> {MODE_LABELS[record.mode]} created (simulated)
                  </p>
                  <p className="text-muted-foreground">
                    {format(new Date(record.at), "MMM d, h:mm a")} · reference <span className="font-mono">{record.ref}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="text-xs gap-1" disabled title={`Links to the ${name} ${MODE_LABELS[record.mode].toLowerCase()} once the API is connected`}>
                    <ExternalLink className="w-3.5 h-3.5" /> Open on {name}
                  </Button>
                  {info.mode === "HANDOFF" && (
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={copyCaption}>
                      <Copy className="w-3.5 h-3.5" /> Copy post text
                    </Button>
                  )}
                </div>
                {remaining.length > 0 ? (
                  <Button size="sm" className="w-full text-xs gap-1.5" onClick={() => navigate(`/content-calendar/publish/${item.id}/${remaining[0]}`)}>
                    Next: publish to {platformName(remaining[0])} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={() => navigate("/content-calendar")}>
                    <Check className="w-3.5 h-3.5" /> All platforms done · back to calendar
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {running && (
                  <ol className="space-y-1.5 text-xs">
                    {steps.map((label, i) => (
                      <li key={label} className={`flex items-center gap-2 ${i > stepIndex ? "text-muted-foreground" : ""}`}>
                        {i < stepIndex ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : i === stepIndex ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-border" />
                        )}
                        {label}
                      </li>
                    ))}
                  </ol>
                )}
                <Button className="w-full gap-1.5 text-xs font-semibold" disabled={running || overLimit} onClick={start}>
                  {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {running ? "Working..." : info.action}
                </Button>
                {overLimit && <p className="text-[11px] text-red-700 dark:text-red-300">Shorten the caption for {name} before publishing.</p>}
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  {info.mode === "SCHEDULED"
                    ? `This goes live automatically at the planned time; it can be edited or cancelled on ${name} until then.`
                    : `Nothing goes live from here: the ${MODE_LABELS[info.mode].toLowerCase()} gets a final check before it's posted.`}
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
