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
import { ChevronLeft, ChevronRight, CalendarDays, Video, Loader2 } from 'lucide-react';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { complianceService, type VideoJob } from '@/services/complianceService';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_STYLES: Record<VideoJob['status'], string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  FAILED: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300',
};

export default function ContentCalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['compliance', 'videoJobs'],
    queryFn: () => complianceService.listVideoJobs().catch(() => [] as VideoJob[]),
  });

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
      }),
    [month],
  );

  const jobsByDay = useMemo(() => {
    const map = new Map<string, VideoJob[]>();
    for (const job of jobs) {
      const key = format(new Date(job.created_at), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(job);
      map.set(key, list);
    }
    return map;
  }, [jobs]);

  const selectedJobs = jobsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [];

  const goToToday = () => {
    const today = new Date();
    setMonth(startOfMonth(today));
    setSelectedDay(today);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <DashboardHeader
        title="Content Calendar"
        subtitle="See screened social media content by day."
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
                const dayJobs = jobsByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
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
                      {dayJobs.slice(0, 2).map((job) => (
                        <span
                          key={job.job_id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium ${STATUS_STYLES[job.status]}`}
                        >
                          {job.video_title || job.filename}
                        </span>
                      ))}
                      {dayJobs.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{dayJobs.length - 2} more</span>
                      )}
                    </div>
                    {dayJobs.length > 0 && (
                      <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-primary mx-auto" />
                    )}
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
              {selectedJobs.length} item{selectedJobs.length === 1 ? '' : 's'} on this day
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedJobs.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 text-muted-foreground">
                <Video className="w-7 h-7 mb-2 opacity-60" />
                <p className="text-xs">Nothing screened on this day.</p>
                <Link to="/new-submission" className="mt-3 text-xs font-medium text-primary hover:underline">
                  Create a new submission
                </Link>
              </div>
            ) : (
              selectedJobs.map((job) => (
                <div key={job.job_id} className="rounded-lg border border-border p-3 space-y-1.5">
                  <p className="text-sm font-medium truncate" title={job.video_title || job.filename}>
                    {job.video_title || job.filename}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {job.platform}
                    </Badge>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[job.status]}`}>
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{format(new Date(job.created_at), 'p')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
