import React, { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Upload,
  Play,
  CheckCircle2,
  Clock,
  Film,
  Smartphone,
  Monitor,
  Trash2,
  Plus,
  Radio,
  Loader2,
  ChevronRight,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useVideoUploadQueue, type VideoQueueItem } from '@/context/VideoUploadQueueContext';

export function VideoUploadQueueDrawer() {
  const {
    queue,
    isQueueDrawerOpen,
    setIsQueueDrawerOpen,
    activeVideoId,
    setActiveVideoId,
    removeFromQueue,
    clearCompleted,
    addToQueue,
  } = useVideoUploadQueue();

  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag and drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  };

  const handleSelectToReview = (item: VideoQueueItem) => {
    setActiveVideoId(item.id);
    setIsQueueDrawerOpen(false);

    if (location.pathname !== '/compliance/scanner') {
      navigate('/compliance/scanner');
    }
  };

  const handleDropFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const videoFiles = fileArray.filter(
      (f) => f.type.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(f.name)
    );
    if (videoFiles.length === 0) return;

    videoFiles.forEach((file) => {
      addToQueue({ file });
    });
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleDropFiles(e.dataTransfer.files);
    }
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleDropFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddSampleDemo = () => {
    const demos = [
      {
        filename: 'zenadrone_thermal_payload_inspection.mp4',
        title: 'ZenaDrone 1000 Thermal Sensor AI Inspection Trial',
        platform: 'TIKTOK' as const,
        aspectRatio: '9:16' as const,
        sizeBytes: 48 * 1024 * 1024,
      },
      {
        filename: 'border_patrol_radar_telemetry_defense.mp4',
        title: 'Border Patrol Radar Telemetry (YouTube Long-form Cut)',
        platform: 'YOUTUBE' as const,
        aspectRatio: '16:9' as const,
        sizeBytes: 94 * 1024 * 1024,
      },
    ];
    const picked = demos[Math.floor(Math.random() * demos.length)];
    addToQueue(picked);
  };

  const activeUploadingList = queue.filter((i) => i.status === 'UPLOADING' || i.status === 'PROCESSING');
  const queuedList = queue.filter((i) => i.status === 'QUEUED');
  const completedList = queue.filter((i) => i.status === 'COMPLETED' || i.status === 'FAILED');

  return (
    <Sheet open={isQueueDrawerOpen} onOpenChange={setIsQueueDrawerOpen}>
      <SheetContent
        side="right"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col bg-background relative transition-all duration-200 ${
          isDraggingOver ? 'ring-2 ring-primary border-primary shadow-xl' : ''
        }`}
      >
        {/* Drag & Drop Full Drawer Active Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-background/90 dark:bg-zinc-950/90 backdrop-blur-xs border-2 border-dashed border-primary flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 text-primary flex items-center justify-center mb-3 shadow-lg ring-8 ring-primary/10">
              <Upload className="w-8 h-8 text-primary animate-bounce" />
            </div>
            <p className="text-base font-bold text-foreground">Drop Video Files to Add to Queue</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Files will be immediately staged for transfer with progressive chunk review enabled.
            </p>
            <Badge className="mt-3 bg-primary text-primary-foreground text-xs px-2.5 py-0.5 font-medium">
              MP4, MOV, WEBM (Batch upload supported)
            </Badge>
          </div>
        )}

        <SheetHeader className="p-5 border-b border-border/80 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Upload className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  <span>Video Upload & Processing Queue</span>
                  <Badge variant="secondary" className="text-[10px] font-mono">
                    {queue.length} Total
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  Monitor live uploads, stream progress, and review buffered chunks immediately.
                </SheetDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFilePicked}
                accept="video/*"
                multiple
                className="hidden"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-8 gap-1.5 font-semibold"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                Upload Video
              </Button>
            </div>
          </div>

          {/* Quick status summary counter pills */}
          <div className="grid grid-cols-3 gap-2 pt-3">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-medium text-[11px]">Uploading / Active</span>
              <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                {activeUploadingList.length}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-medium text-[11px]">Waiting in Queue</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-sm">
                {queuedList.length}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between">
              <span className="text-muted-foreground font-medium text-[11px]">Completed</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                {completedList.length}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Queue Items List Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Active Uploading Section */}
          {activeUploadingList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  Currently Uploading & Transferring ({activeUploadingList.length})
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  Review buffered parts in real-time
                </span>
              </div>

              <div className="space-y-3">
                {activeUploadingList.map((item) => {
                  const isSelected = item.id === activeVideoId;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? 'border-blue-500/60 bg-blue-500/5 shadow-sm ring-1 ring-blue-500/30'
                          : 'border-border/80 bg-card hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            {item.platform === 'TIKTOK' || item.platform === 'YOUTUBE_SHORTS' ? (
                              <Smartphone className="w-5 h-5" />
                            ) : (
                              <Monitor className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-1">
                                {item.title}
                              </h4>
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase font-bold border-blue-500/40 text-blue-600 dark:text-blue-400"
                              >
                                {item.platform} ({item.aspectRatio})
                              </Badge>
                              {isSelected && (
                                <Badge className="bg-primary text-primary-foreground text-[9px] font-bold">
                                  Currently Active
                                </Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                              {item.filename} • {formatBytes(item.uploadedBytes)} of {formatBytes(item.totalSizeBytes)} (
                              {item.progressPercent}%)
                            </p>
                          </div>
                        </div>

                        <Badge className="bg-blue-600 text-white text-[10px] font-bold shrink-0 animate-pulse">
                          {item.progressPercent}% Uploaded
                        </Badge>
                      </div>

                      {/* Progress Bar & Transfer Stats */}
                      <div className="space-y-1.5 mt-3 pt-2 border-t border-border/50">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            {item.currentStageLabel}
                          </span>
                          <span className="font-mono">
                            ETA: ~{item.estimatedSecondsRemaining}s remaining
                          </span>
                        </div>
                      </div>

                      {/* In-Progress Review Callout & Action Buttons */}
                      <div className="mt-3.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
                          <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse shrink-0" />
                          <span className="text-[11px] leading-tight">
                            <strong>{item.progressPercent}% buffered:</strong> Segments uploaded so far are ready to play and review right now.
                          </span>
                        </div>

                        <Button
                          size="sm"
                          onClick={() => handleSelectToReview(item)}
                          className="h-7 text-xs font-bold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0 shadow-xs"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Review Buffered Parts
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Queued Section */}
          {queuedList.length > 0 && (
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" />
                Waiting in Queue ({queuedList.length})
              </span>

              <div className="space-y-2">
                {queuedList.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/70 bg-card/60 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-mono font-bold text-xs text-muted-foreground">
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-xs line-clamp-1">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {formatBytes(item.totalSizeBytes)} • {item.platform} • Queue Position #{idx + 1}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] uppercase border-amber-500/30 text-amber-600">
                        Queued
                      </Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeFromQueue(item.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        title="Remove from queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Section */}
          {completedList.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Completed & Screened ({completedList.length})
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearCompleted}
                  className="text-xs h-6 text-muted-foreground hover:text-foreground"
                >
                  Clear Completed
                </Button>
              </div>

              <div className="space-y-2">
                {completedList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-xs line-clamp-1">
                          {item.title}
                        </h4>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{formatBytes(item.totalSizeBytes)}</span>
                          <span>•</span>
                          <span className="font-semibold text-foreground">
                            {item.scoreStatus === "checked" ? `Score: ${item.complianceScore}/100` : item.scoreStatus === "pending" ? "Checking..." : "Score unavailable"}
                          </span>
                          {item.scoreStatus !== "checked" ? null : item.violationCount > 0 ? (
                            <Badge className="bg-red-500/10 text-red-600 border border-red-500/30 text-[9px] px-1.5 py-0">
                              {item.violationCount} Flags
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[9px] px-1.5 py-0">
                              Cleared
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectToReview(item)}
                        className="h-7 text-xs gap-1 font-semibold"
                      >
                        <span>Review</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dropzone prompt if queue is nearly empty */}
          <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 text-center space-y-2">
            <Film className="w-6 h-6 mx-auto text-muted-foreground opacity-60" />
            <h5 className="text-xs font-bold text-foreground">Upload Defense Video Asset</h5>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              Drop an MP4, MOV, or WEBM file here. Progressive upload allows you to screen early chunks without waiting.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs h-7 gap-1 font-semibold"
              >
                <Upload className="w-3 h-3" />
                Select File
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleAddSampleDemo}
                className="text-xs h-7 text-primary hover:text-primary gap-1"
              >
                <Zap className="w-3 h-3" />
                Add Demo Cut
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="p-4 border-t border-border/80 bg-muted/10 flex flex-row items-center justify-between sm:justify-between">
          <span className="text-[11px] text-muted-foreground">
            Progressive Streaming Compliance Engine Active
          </span>
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setIsQueueDrawerOpen(false);
              navigate('/compliance/scanner');
            }}
            className="text-xs font-bold"
          >
            Open Content Screener
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
