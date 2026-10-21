import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarClock, Loader2 } from 'lucide-react';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import PlatformIcon, { PLATFORM_LABELS, type SocialPlatform } from '@/components/video/PlatformIcon';
import { SubmissionStatusBadge } from '@/components/submissions/submissionUi';
import { submissionService } from '@/services/submissionService';
import type { SubmissionSummary } from '@/types/submission';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-zinc-400',
  IN_REVIEW: 'bg-blue-500',
  CHANGES_REQUESTED: 'bg-amber-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
};

export default function ContentCalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['submissions', ''],
    queryFn: () => submissionService.list(),
  });

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  // Content is placed on its planned publish date; submissions without one aren't scheduled yet.
  const byDay = useMemo(() => {
    const map = new Map<string, SubmissionSummary[]>();
    for (const s of submissions) {
      if (!s.publish_at) continue;
      const key = format(new Date(s.publish_at), 'yyyy-MM-dd');
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [submissions]);

  const selected = byDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];
  const unscheduledCount = submissions.filter((s) => !s.publish_at).length;

  const goToToday = () => {
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelectedDay(today);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <DashboardHeader
        title="Content Calendar"
        subtitle={
          unscheduledCount > 0
            ? `Submissions by planned publish date. ${unscheduledCount} without a date aren't shown.`
            : 'Submissions by planned publish date.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth((m) => subMonths(m, 1))} title="Previous month">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" onClick={() => setMonth((m) => addMonths(m, 1))} title="Next month">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              {format(month, 'MMMM yyyy')}
            </CardTitle>
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border border-border bg-border">
              {days.map((day) => {
                const dayItems = byDay.get(format(day, 'yyyy-MM-dd')) ?? [];
                const isSelected = isSameDay(day, selectedDay);
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-stretch gap-1 min-h-16 sm:min-h-24 p-1.5 text-left transition-colors bg-card hover:bg-accent/60
                      ${isSameMonth(day, month) ? '' : 'text-muted-foreground/50'}
                      ${isSelected ? 'ring-2 ring-inset ring-primary' : ''}`}
                  >
                    <span
                      className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}
                    >
                      {format(day, 'd')}
                    </span>
                    <div className="hidden sm:flex flex-col gap-0.5">
                      {dayItems.slice(0, 2).map((s) => (
                        <span key={s.id} className="flex items-center gap-1 truncate rounded bg-muted px-1 py-0.5 text-[10px] font-medium">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s.status] ?? 'bg-zinc-400'}`} />
                          <span className="truncate">{s.title}</span>
                        </span>
                      ))}
                      {dayItems.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayItems.length - 2} more</span>
                      )}
                    </div>
                    {dayItems.length > 0 && <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-primary mx-auto" />}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{format(selectedDay, 'EEEE, MMM d')}</CardTitle>
            <CardDescription>
              {selected.length} item{selected.length === 1 ? '' : 's'} planned
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selected.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 text-muted-foreground">
                <CalendarClock className="w-7 h-7 mb-2 opacity-60" />
                <p className="text-xs">Nothing planned for this day.</p>
                <Link to="/submissions/new" className="mt-3 text-xs font-medium text-primary hover:underline">
                  Create a new submission
                </Link>
              </div>
            ) : (
              selected.map((s) => (
                <Link
                  key={s.id}
                  to={`/submissions/${s.id}`}
                  className="block rounded-lg border border-border p-3 space-y-1.5 hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-medium truncate" title={s.title}>
                    {s.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SubmissionStatusBadge status={s.status} />
                    {s.platforms.map((p) => (
                      <span key={p} title={PLATFORM_LABELS[p as SocialPlatform] ?? p}>
                        <PlatformIcon platform={p as SocialPlatform} className="w-3.5 h-3.5" />
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {s.reference_code} · {format(new Date(s.publish_at!), 'p')}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
