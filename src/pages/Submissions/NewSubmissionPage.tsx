import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Video,
  Info,
  RotateCcw,
} from 'lucide-react';

import DashboardHeader from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  complianceService,
  type ComplianceCheckResponse,
  type TrafficLight,
} from '@/services/complianceService';

const PLATFORMS = [
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'YOUTUBE_SHORTS', label: 'YouTube Shorts' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'X', label: 'X (Twitter)' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
];

const CONTENT_TYPES = [
  { value: 'POST', label: 'Text / Image Post' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'ARTICLE', label: 'Article' },
];

const LIGHT_STYLES: Record<TrafficLight, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  GREEN: {
    label: 'Cleared',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50',
    icon: CheckCircle2,
  },
  YELLOW: {
    label: 'Needs Review',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50',
    icon: AlertTriangle,
  },
  RED: {
    label: 'Blocked',
    className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/50',
    icon: XCircle,
  },
};

export default function NewSubmissionPage() {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('LINKEDIN');
  const [contentType, setContentType] = useState('POST');
  const [publishDate, setPublishDate] = useState('');
  const [caption, setCaption] = useState('');
  const [result, setResult] = useState<ComplianceCheckResponse | null>(null);

  const checkMutation = useMutation({
    mutationFn: () =>
      complianceService.checkCompliance({
        text: caption,
        video_title: title || undefined,
        content_type: `${contentType}_${platform}`,
      }),
    onSuccess: (res) => {
      setResult(res);
      if (res.is_compliant) toast.success('No compliance violations detected.');
      else toast.warning(`${res.violations_count} potential violation(s) found.`);
    },
    onError: (err: any) => {
      toast.error('Compliance check failed: ' + (err?.response?.data?.detail || err.message));
    },
  });

  const resetForm = () => {
    setTitle('');
    setPlatform('LINKEDIN');
    setContentType('POST');
    setPublishDate('');
    setCaption('');
    setResult(null);
  };

  const canCheck = caption.trim().length > 0 && !checkMutation.isPending;
  const light = result ? LIGHT_STYLES[result.traffic_light] : null;

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-500">
      <DashboardHeader
        title="New Submission"
        subtitle="Draft social media content and screen it against the compliance rulebook before review."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={resetForm}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Content Details</CardTitle>
            <CardDescription>Describe the post exactly as it will be published.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="submission-title">Title</Label>
              <Input
                id="submission-title"
                placeholder="e.g. Q4 drone platform announcement"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="submission-date">Planned Publish Date</Label>
                <Input
                  id="submission-date"
                  type="date"
                  value={publishDate}
                  onChange={(e) => setPublishDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="submission-caption">Caption / Copy</Label>
              <Textarea
                id="submission-caption"
                rows={8}
                placeholder="Paste the full caption, hashtags, and any on-screen text..."
                value={caption}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setResult(null);
                }}
              />
              <p className="text-xs text-muted-foreground">{caption.length} characters</p>
            </div>

            {contentType === 'VIDEO' && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Video className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                <span>
                  Video footage is screened separately. Upload the file in the{' '}
                  <Link to="/compliance/scanner" className="font-medium text-primary hover:underline">
                    Video Screener
                  </Link>{' '}
                  to check imagery, insignia, and on-screen content.
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-wrap justify-end gap-2">
            <Button className="gap-2" disabled={!canCheck} onClick={() => checkMutation.mutate()}>
              {checkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              Run Compliance Check
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              disabled
              title="Saving submissions for review is not available yet"
            >
              <Send className="w-4 h-4" />
              Submit for Review
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Compliance Result</CardTitle>
            <CardDescription>Screened against the active rules in the Compliance Rulebook.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && !checkMutation.isPending && (
              <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground">
                <Info className="w-8 h-8 mb-3 opacity-60" />
                <p className="text-sm">Enter your caption and run a compliance check to see results here.</p>
              </div>
            )}

            {checkMutation.isPending && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Screening content...
              </div>
            )}

            {result && light && (
              <>
                <div className={`flex items-center justify-between rounded-lg border p-4 ${light.className}`}>
                  <div className="flex items-center gap-2">
                    <light.icon className="w-5 h-5" />
                    <span className="font-semibold">{light.label}</span>
                  </div>
                  <span className="text-sm font-semibold">Score {result.score}</span>
                </div>

                {result.violations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Violations ({result.violations_count})
                    </h3>
                    {result.violations.map((v) => (
                      <div key={v.rule_id} className="rounded-lg border border-border p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">
                            {v.rule_number} · {v.title}
                          </span>
                          <Badge variant="outline" className={LIGHT_STYLES[v.traffic_light].className}>
                            {v.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{v.explanation}</p>
                        {v.flagged_terms.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {v.flagged_terms.map((term) => (
                              <Badge key={term} variant="secondary" className="text-[10px]">
                                {term}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {v.remediation_guidance && (
                          <p className="text-xs text-foreground/80">
                            <span className="font-semibold">Fix: </span>
                            {v.remediation_guidance}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {result.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Recommendations
                    </h3>
                    <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                      {result.recommendations.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
