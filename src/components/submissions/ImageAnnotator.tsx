import { useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";

import { COMMENT_CATEGORIES, regionNumbers } from "@/components/submissions/ReviewCommentsPanel";
import { authedFileUrl } from "@/components/submissions/submissionUi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReviewComments } from "@/hooks/useReview";
import { useAuth } from "@/lib/AuthContext";
import type { ReviewCommentCategory, SubmissionFile } from "@/types/submission";

/** A box drawn on the image, as fractions (0 to 1) of its width and height. */
type Box = { x: number; y: number; w: number; h: number };

/** Below this (as a fraction of the image) a drag counts as a plain click. */
const MIN_DRAG = 0.015;

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * An image post's picture, with comments on areas of it, as in Google Docs: drag a box over the part you mean and write
 * the comment there. Boxes already commented on show with their number; click one to find its comment.
 */
export default function ImageAnnotator({
  submissionId,
  file,
  canDraw,
  activeId,
  onActive,
  onPlainClick,
  imageClassName = "max-h-[56vh] w-auto object-contain",
}: {
  submissionId: string;
  file: SubmissionFile;
  /** May leave a comment on an area (a reviewer or suggesting reviewer, while it is in review). */
  canDraw: boolean;
  /** The comment picked in the list or on the image. */
  activeId?: string | null;
  onActive?: (id: string | null) => void;
  /** A click that was not a drag, e.g. to open the comments tab. */
  onPlainClick?: () => void;
  imageClassName?: string;
}) {
  const { comments, add } = useReviewComments(submissionId);
  const { hasPermission } = useAuth();
  const asReviewer = hasPermission("CONTENT_REVIEW_VIEW");
  const numbers = regionNumbers(comments);
  const here = comments.filter((c) => c.file_id === file.id && c.region_w != null);

  const frame = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<Box | null>(null);
  const [pending, setPending] = useState<Box | null>(null);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<ReviewCommentCategory>("NOTE");

  const point = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) };
  };
  const boxOf = (a: { x: number; y: number }, b: { x: number; y: number }): Box => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });

  const down = (e: React.PointerEvent) => {
    if (pending) return;
    if (!canDraw) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = point(e);
    setDrag(null);
  };
  const move = (e: React.PointerEvent) => {
    if (start.current) setDrag(boxOf(start.current, point(e)));
  };
  const up = (e: React.PointerEvent) => {
    if (!start.current) return;
    const box = boxOf(start.current, point(e));
    start.current = null;
    setDrag(null);
    if (box.w < MIN_DRAG && box.h < MIN_DRAG) {
      onActive?.(null);
      onPlainClick?.();
      return;
    }
    // A thin line is still an area to point at: give it some body.
    setPending({ ...box, w: Math.max(box.w, MIN_DRAG), h: Math.max(box.h, MIN_DRAG) });
    setBody("");
  };

  const cancel = () => {
    setPending(null);
    setBody("");
  };
  const post = () => {
    if (!pending || !body.trim()) return;
    add.mutate(
      {
        body: body.trim(),
        category: asReviewer ? category : "NOTE",
        file_id: file.id,
        region_x: pending.x,
        region_y: pending.y,
        region_w: Math.min(pending.w, 1 - pending.x),
        region_h: Math.min(pending.h, 1 - pending.y),
      },
      {
        onSuccess: (saved) => {
          cancel();
          onActive?.(saved.id);
        },
      }
    );
  };

  const shown = drag ?? pending;
  // The picked comment's area stays sharp; the rest of the image blurs and dims so it stands out.
  const focus = !shown ? here.find((c) => c.id === activeId) : undefined;
  const clip = focus
    ? `inset(${focus.region_y! * 100}% ${(1 - focus.region_x! - focus.region_w!) * 100}% ${(1 - focus.region_y! - focus.region_h!) * 100}% ${focus.region_x! * 100}%)`
    : undefined;
  return (
    <div
      ref={frame}
      className={`relative inline-block max-w-full select-none ${canDraw && !pending ? "cursor-crosshair" : ""}`}
      style={canDraw ? { touchAction: "none" } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        start.current = null;
        setDrag(null);
      }}
      // Without drawing, a click on the image lets go of the picked comment.
      onClick={!canDraw && activeId ? () => onActive?.(null) : undefined}
    >
      <span className={`block ${focus ? "overflow-hidden rounded-xl" : ""}`}>
        <img
          src={authedFileUrl(file.url)}
          alt={file.original_name}
          draggable={false}
          className={`block transition-[filter] duration-200 ${focus ? "blur-[3px] brightness-[0.55]" : ""} ${imageClassName}`}
        />
      </span>
      {focus && (
        <img
          src={authedFileUrl(file.url)}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
          style={{ clipPath: clip }}
        />
      )}

      {here.map((c) => {
        const active = c.id === activeId;
        const resolved = Boolean(c.resolved_at);
        return (
          <button
            key={c.id}
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onActive?.(active ? null : c.id);
            }}
            style={{ left: `${c.region_x! * 100}%`, top: `${c.region_y! * 100}%`, width: `${c.region_w! * 100}%`, height: `${c.region_h! * 100}%` }}
            className={`absolute rounded-[3px] border-2 transition-[colors,opacity] ${focus && !active ? "opacity-40" : ""} ${
              active
                ? "border-blue-500 bg-transparent ring-2 ring-white/80 shadow-[0_0_24px_rgba(59,130,246,0.6)]"
                : resolved
                ? "border-white/40 bg-transparent hover:border-white/80"
                : "border-amber-300 bg-amber-300/10 hover:bg-amber-300/25"
            }`}
            title={`${numbers.get(c.id)} · ${c.author_name ?? "Comment"}: ${c.body}`}
            aria-label={`Comment ${numbers.get(c.id)} on this area`}
          >
            <span
              className={`absolute -left-0.5 -top-5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow ${
                active ? "bg-blue-600" : resolved ? "bg-zinc-500" : "bg-amber-500"
              }`}
            >
              {numbers.get(c.id)}
            </span>
          </button>
        );
      })}

      {shown && (
        <span
          className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-blue-400 bg-blue-400/20"
          style={{ left: `${shown.x * 100}%`, top: `${shown.y * 100}%`, width: `${shown.w * 100}%`, height: `${shown.h * 100}%` }}
        />
      )}

      {pending && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          style={{
            left: `${Math.min(pending.x * 100, 100)}%`,
            // Below the box, or above it when the box is in the lower half so the comment box stays in view.
            ...(pending.y + pending.h / 2 > 0.5
              ? { bottom: `${(1 - pending.y) * 100}%`, marginBottom: 8 }
              : { top: `${Math.min((pending.y + pending.h) * 100, 100)}%`, marginTop: 8 }),
            transform: pending.x > 0.55 ? "translateX(-100%)" : undefined,
          }}
          className="absolute z-20 w-[260px] max-w-[85vw] cursor-default space-y-2 rounded-lg border border-border bg-popover p-2.5 text-popover-foreground shadow-lg"
        >
          <Textarea
            autoFocus
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comment on this area..."
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === "Escape") cancel();
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post();
            }}
          />
          {asReviewer && (
            <div className="flex flex-wrap gap-1">
              {COMMENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  aria-pressed={category === cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    category === cat.value ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={cancel}>
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button type="button" size="sm" className="h-7 gap-1 px-2.5 text-xs" disabled={!body.trim() || add.isPending} onClick={post}>
              {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Comment
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
