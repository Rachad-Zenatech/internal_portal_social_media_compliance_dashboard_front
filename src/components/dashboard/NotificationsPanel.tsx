import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  MessageSquareWarning,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, Loading, Score, Section } from "@/components/dashboard/dashboardParts";
import { useMarkAllNotificationsAsRead, useMarkNotificationAsRead, useNotifications, type Notification } from "@/hooks/useNotifications";

// What happened, in a couple of words, with an icon and colour to spot it at a glance.
const KINDS: { match: RegExp; label: string; Icon: LucideIcon; tone: string }[] = [
  {
    match: /submitted for review|resubmitted/i,
    label: "Sent for review",
    Icon: Send,
    tone: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  {
    match: /changes requested|sent back/i,
    label: "Changes requested",
    Icon: MessageSquareWarning,
    tone: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    match: /approved/i,
    label: "Approved",
    Icon: CheckCircle2,
    tone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  { match: /rejected/i, label: "Rejected", Icon: XCircle, tone: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  {
    match: /comment/i,
    label: "New comment",
    Icon: MessageCircle,
    tone: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
];
const OTHER = { Icon: Bell, tone: "bg-muted text-muted-foreground" };

/** Turns "SUB-1005 submitted for review" + '"Post" (version 1) is in... Automated check: 40/100.' into readable parts. */
function readable(n: Notification) {
  const kind = KINDS.find((k) => k.match.test(n.title));
  const quoted = n.message.match(/^"(.+?)"(?:\s*\(version (\d+)\))?/);
  const scoreMatch = n.message.match(/Automated check:\s*(\d+)\s*\/\s*100/i);
  return {
    Icon: (kind ?? OTHER).Icon,
    tone: (kind ?? OTHER).tone,
    // Without a recognisable post name, fall back to what the server sent.
    headline: quoted?.[1] ?? n.title,
    status: kind?.label ?? null,
    version: quoted?.[2] && quoted[2] !== "1" ? `Version ${quoted[2]}` : null,
    score: scoreMatch ? Number(scoreMatch[1]) : null,
    checking: /Automated check:\s*under review/i.test(n.message),
    detail: quoted ? null : n.message,
  };
}

function shortAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Every unread notification (the same ones the top bar's bell shows), a page at a time. */
export default function NotificationsPanel({ pageSize = 4, className = "" }: { pageSize?: number; className?: string }) {
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationAsRead();
  const markAllRead = useMarkAllNotificationsAsRead();
  const unreadList = notifications.filter((n) => !n.is_read);
  const unread = unreadList.length;
  const pages = Math.max(1, Math.ceil(unread / pageSize));
  const [rawPage, setPage] = useState(0);
  // Reading one removes it from the list, so keep the page in range as the list shrinks.
  const page = Math.min(rawPage, pages - 1);
  const shown = unreadList.slice(page * pageSize, page * pageSize + pageSize);

  const open = (n: Notification) => {
    if (!n.is_read) markRead.mutate(Number(n.id));
    if (n.link_url) navigate(n.link_url);
  };

  return (
    <Section
      title="Notifications"
      subtitle={unread ? `${unread} unread` : "You're up to date"}
      className={className}
      action={
        unread > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5" /> Mark all read
          </Button>
        ) : null
      }
    >
      {isLoading ? (
        <Loading />
      ) : unread === 0 ? (
        <Empty>No unread notifications. New ones will show up here.</Empty>
      ) : (
        <>
          <ul className="divide-y divide-border/60 border-t border-border/60">
            {shown.map((n) => {
              const r = readable(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    title={n.message}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full ${r.tone}`}>
                      <r.Icon className="w-4 h-4" />
                      {!n.is_read && (
                        <span
                          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-card"
                          aria-label="Unread"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm text-foreground ${n.is_read ? "font-medium" : "font-semibold"}`}>
                          {r.headline}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{shortAgo(n.created_at)}</span>
                      </span>
                      {r.detail ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{r.detail}</span>
                      ) : (
                        <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{[r.status, r.version].filter(Boolean).join(" · ")}</span>
                          {(r.score != null || r.checking) && <Score score={r.score} pending={r.checking} />}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
              <span>
                Page {page + 1} of {pages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= pages - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Section>
  );
}
