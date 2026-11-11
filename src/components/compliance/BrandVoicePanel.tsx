import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Download, FileUp, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { withLinkToken } from "@/lib/linkToken";
import { contextService } from "@/services/contextService";
import type { BrandColor, BrandTypeface, BrandVoice, BrandVoiceInput } from "@/types/context";

const STATUS: Record<BrandVoice["status"], { label: string; className: string }> = {
  NONE: { label: "No manual", className: "bg-muted text-muted-foreground" },
  PROCESSING: { label: "Reading the manual…", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  DONE: { label: "Read from the manual", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  PARTIAL: { label: "Partly read", className: "bg-amber-500/10 text-amber-800 dark:text-amber-200" },
  FAILED: { label: "Couldn't read it", className: "bg-red-500/10 text-red-700 dark:text-red-300" },
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Brand voice, brand by brand: each brand has its own manual (PDF) and its own voice, colours, typefaces and logo,
 * read from the manual and editable by hand. It's what the content analysis gets as the brand's voice.
 */
export default function BrandVoicePanel() {
  const queryClient = useQueryClient();
  const voices = useQuery({
    queryKey: ["brand-voices"],
    queryFn: contextService.brandVoices,
    // Keep checking while a manual is being read.
    refetchInterval: (q) => (q.state.data?.some((v) => v.status === "PROCESSING") ? 3000 : false),
  });
  const [editing, setEditing] = useState<BrandVoice | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["brand-voices"] });
    // The brand's Brand Voice entry in the list below changes with it.
    queryClient.invalidateQueries({ queryKey: ["messaging-context"] });
  };

  if (voices.isLoading) {
    return (
      <p className="p-6 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading brands...
      </p>
    );
  }
  if (voices.isError) {
    return <p className="p-6 text-xs text-red-600">Couldn't load brand voices: {(voices.error as Error).message}</p>;
  }

  return (
    <div className="border-b border-border/60 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Brand voice by brand</p>
        <p className="text-xs text-muted-foreground">
          Upload each brand's manual (PDF). Its voice, tone, colours, typefaces and logo are read from it and used when
          content for that brand is analysed. You can edit anything that was read.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {(voices.data ?? []).map((v) => (
          <BrandCard key={v.brand_code} voice={v} onChanged={refresh} onEdit={() => setEditing(v)} />
        ))}
      </div>
      {editing && <EditDialog voice={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
    </div>
  );
}

function BrandCard({ voice: v, onChanged, onEdit }: { voice: BrandVoice; onChanged: () => void; onEdit: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const status = STATUS[v.status];
  const empty = !v.voice && !v.colors.length && !v.typefaces.length && !v.tone.length;

  const upload = useMutation({
    mutationFn: (file: File) => contextService.uploadBrandManual(v.brand_code, file),
    onSuccess: () => {
      toast.success(`Reading ${v.brand_name}'s brand manual. Its voice, colours, typefaces and logo appear here shortly.`);
      onChanged();
    },
    onError: (err) => toast.error(`Couldn't upload the manual: ${(err as Error).message}`),
  });
  const reread = useMutation({
    mutationFn: () => contextService.rereadBrandManual(v.brand_code),
    onSuccess: () => {
      toast.success(`Reading ${v.brand_name}'s brand manual again.`);
      onChanged();
    },
    onError: (err) => toast.error(`Couldn't read it again: ${(err as Error).message}`),
  });
  const busy = v.status === "PROCESSING" || upload.isPending;

  return (
    <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-[12rem] flex-1 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/70 bg-muted/30">
            {v.has_logo ? (
              <img
                src={withLinkToken(`${contextService.brandLogoUrl(v.brand_code)}?v=${encodeURIComponent(v.extracted_at ?? "")}`)}
                alt={`${v.brand_name} logo`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="text-[10px] text-muted-foreground">No logo</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{v.brand_name}</p>
            <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
              {busy && <Loader2 className="h-3 w-3 animate-spin" />}
              {status.label}
            </span>
          </div>
        </div>
        {v.can_edit && (
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) upload.mutate(file);
              }}
            />
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp className="h-3.5 w-3.5" /> {v.manual_name ? "Replace manual" : "Upload manual"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" disabled={busy} onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        )}
      </div>

      {v.manual_name && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <a
            href={withLinkToken(contextService.brandManualUrl(v.brand_code))}
            className="inline-flex items-center gap-1 text-blue-700 hover:underline dark:text-blue-300"
            target="_blank"
            rel="noreferrer"
          >
            <Download className="h-3 w-3" /> {v.manual_name}
          </a>
          {v.manual_uploaded_at && <span>uploaded {formatDistanceToNow(new Date(v.manual_uploaded_at), { addSuffix: true })}</span>}
          {v.can_edit && (v.status === "PARTIAL" || v.status === "FAILED") && (
            <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" disabled={busy} onClick={() => reread.mutate()}>
              <RefreshCw className="h-3 w-3" /> Read it again
            </Button>
          )}
        </div>
      )}
      {v.error && (v.status === "PARTIAL" || v.status === "FAILED") && (
        <p className="flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {v.error}
        </p>
      )}

      {empty ? (
        <p className="text-xs text-muted-foreground">
          {v.status === "PROCESSING"
            ? "Reading the manual…"
            : v.can_edit
            ? "No brand voice yet. Upload the brand manual, or write it with Edit."
            : "No brand voice yet."}
        </p>
      ) : (
        <div className="space-y-2.5 text-sm">
          {v.voice && <p className="whitespace-pre-line text-foreground/90">{v.voice}</p>}
          {v.tone.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {v.tone.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">{t}</span>
              ))}
            </div>
          )}
          {v.colors.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Colours</p>
              <div className="flex flex-wrap gap-2">
                {v.colors.map((c) => (
                  <div key={c.hex} className="flex items-center gap-1.5 rounded-md border border-border/70 px-1.5 py-1" title={c.usage ?? undefined}>
                    <span className="h-5 w-5 rounded border border-black/10" style={{ backgroundColor: c.hex }} />
                    <span className="text-[11px]">
                      {c.name && <span className="font-medium">{c.name} </span>}
                      <span className="font-mono text-muted-foreground">{c.hex}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {v.typefaces.length > 0 && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Typefaces</p>
              <ul className="space-y-0.5">
                {v.typefaces.map((t) => (
                  <li key={`${t.name}-${t.role}`} className="text-xs">
                    <span className="font-semibold" style={{ fontFamily: `"${t.name}", inherit` }}>{t.name}</span>
                    {t.role && <span className="text-muted-foreground"> · {t.role}</span>}
                    {t.usage && <span className="text-muted-foreground"> · {t.usage}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {v.logo_notes && (
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Logo: </span>
              {v.logo_notes}
            </p>
          )}
          {(v.do_examples.length > 0 || v.dont_examples.length > 0) && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
              {v.do_examples.length > 0 && (
                <ul className="space-y-0.5">
                  {v.do_examples.map((d) => (
                    <li key={d} className="text-emerald-800 dark:text-emerald-300">✓ {d}</li>
                  ))}
                </ul>
              )}
              {v.dont_examples.length > 0 && (
                <ul className="space-y-0.5">
                  {v.dont_examples.map((d) => (
                    <li key={d} className="text-red-700 dark:text-red-300">✗ {d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {v.updated_by_name && v.updated_at && (
            <p className="text-[11px] text-muted-foreground">
              Last changed by {v.updated_by_name} {formatDistanceToNow(new Date(v.updated_at), { addSuffix: true })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function EditDialog({ voice, onClose, onSaved }: { voice: BrandVoice; onClose: () => void; onSaved: () => void }) {
  const [voiceText, setVoiceText] = useState(voice.voice ?? "");
  const [tone, setTone] = useState(voice.tone.join(", "));
  const [dos, setDos] = useState(voice.do_examples.join("\n"));
  const [donts, setDonts] = useState(voice.dont_examples.join("\n"));
  const [colors, setColors] = useState<BrandColor[]>(voice.colors);
  const [typefaces, setTypefaces] = useState<BrandTypeface[]>(voice.typefaces);
  const [logoNotes, setLogoNotes] = useState(voice.logo_notes ?? "");

  const badColor = colors.some((c) => !HEX.test(c.hex));
  const save = useMutation({
    mutationFn: () => {
      const data: BrandVoiceInput = {
        voice: voiceText,
        tone: tone.split(",").map((t) => t.trim()).filter(Boolean),
        do_examples: lines(dos),
        dont_examples: lines(donts),
        colors: colors.map((c) => ({ ...c, hex: c.hex.toUpperCase() })),
        typefaces: typefaces.filter((t) => t.name.trim()),
        logo_notes: logoNotes,
      };
      return contextService.updateBrandVoice(voice.brand_code, data);
    },
    onSuccess: () => {
      toast.success(`${voice.brand_name} brand voice saved`);
      onSaved();
      onClose();
    },
    onError: (err) => toast.error(`Couldn't save: ${(err as Error).message}`),
  });

  const setColor = (i: number, patch: Partial<BrandColor>) => setColors((cs) => cs.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  const setFace = (i: number, patch: Partial<BrandTypeface>) => setTypefaces((ts) => ts.map((t, n) => (n === i ? { ...t, ...patch } : t)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{voice.brand_name} brand voice</DialogTitle>
          <DialogDescription>What content for {voice.brand_name} is checked against. Changes apply to new analyses.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Voice</Label>
            <Textarea value={voiceText} onChange={(e) => setVoiceText(e.target.value)} maxLength={2000} className="min-h-[90px] text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tone (comma-separated)</Label>
            <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="confident, practical, plain-spoken" className="text-sm" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Do (one per line)</Label>
              <Textarea value={dos} onChange={(e) => setDos(e.target.value)} className="min-h-[80px] text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Don't (one per line)</Label>
              <Textarea value={donts} onChange={(e) => setDonts(e.target.value)} className="min-h-[80px] text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Colours</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" onClick={() => setColors((cs) => [...cs, { hex: "#000000" }])}>
                <Plus className="h-3 w-3" /> Add colour
              </Button>
            </div>
            {colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={HEX.test(c.hex) ? c.hex : "#000000"}
                  onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })}
                  className="h-8 w-9 shrink-0 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Colour"
                />
                <Input value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value })} className={`h-8 w-28 font-mono text-xs ${HEX.test(c.hex) ? "" : "border-red-500"}`} />
                <Input value={c.name ?? ""} onChange={(e) => setColor(i, { name: e.target.value })} placeholder="Name" className="h-8 text-xs" />
                <Input value={c.usage ?? ""} onChange={(e) => setColor(i, { usage: e.target.value })} placeholder="Used for" className="h-8 text-xs" />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setColors((cs) => cs.filter((_, n) => n !== i))} aria-label="Remove colour">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Typefaces</Label>
              <Button type="button" size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" onClick={() => setTypefaces((ts) => [...ts, { name: "" }])}>
                <Plus className="h-3 w-3" /> Add typeface
              </Button>
            </div>
            {typefaces.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={t.name} onChange={(e) => setFace(i, { name: e.target.value })} placeholder="Family, e.g. Montserrat" className="h-8 text-xs" />
                <Input value={t.role ?? ""} onChange={(e) => setFace(i, { role: e.target.value })} placeholder="Role, e.g. Headings" className="h-8 text-xs" />
                <Input value={t.usage ?? ""} onChange={(e) => setFace(i, { usage: e.target.value })} placeholder="Usage" className="h-8 text-xs" />
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setTypefaces((ts) => ts.filter((_, n) => n !== i))} aria-label="Remove typeface">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Logo rules</Label>
            <Textarea value={logoNotes} onChange={(e) => setLogoNotes(e.target.value)} maxLength={500} placeholder="Clear space, minimum size, colour versions, what not to do" className="min-h-[60px] text-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={save.isPending || badColor} onClick={() => save.mutate()} className="gap-1.5">
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
