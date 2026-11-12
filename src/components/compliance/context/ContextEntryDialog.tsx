import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContextEntryInput } from "@/types/context";

import Chips from "./Chips";
import { KINDS, kindInfo, type Option } from "./kinds";

type SetForm = Dispatch<SetStateAction<ContextEntryInput>>;
interface FormProps {
  form: ContextEntryInput;
  setForm: SetForm;
}
interface ScopeOptions {
  brands: Option[];
  audiences: Option[];
  platforms: Option[];
}

const WARN = "text-[11px] text-amber-700 dark:text-amber-300";

/** Adding or editing an entry: its kind, text, examples, what it applies to, and where it came from. */
export default function ContextEntryDialog({
  open,
  isNew,
  form,
  setForm,
  scope,
  saving,
  onSave,
  onClose,
}: FormProps & { open: boolean; isNew: boolean; scope: ScopeOptions; saving: boolean; onSave: () => void; onClose: () => void }) {
  const canSave = Boolean(form.title.trim() && form.body.trim()) && !saving;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{isNew ? "Add context" : "Edit context"}</DialogTitle>
          <DialogDescription className="text-xs">{kindInfo(form.kind).help}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <KindPicker form={form} setForm={setForm} />
          <TextFields form={form} setForm={setForm} />
          <ScopeFields form={form} setForm={setForm} scope={scope} />
          <SourceFields form={form} setForm={setForm} />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" className="text-xs gap-1.5" disabled={!canSave} onClick={onSave}>
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-semibold">{label}</Label>
      {children}
    </div>
  );
}

function KindPicker({ form, setForm }: FormProps) {
  return (
    <Field label="Kind">
      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            aria-pressed={form.kind === k.value}
            onClick={() => setForm((f) => ({ ...f, kind: k.value }))}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold ${
              form.kind === k.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

function TextFields({ form, setForm }: FormProps) {
  return (
    <>
      <Field label="Title" htmlFor="ctx-title">
        <Input id="ctx-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="text-xs" placeholder="e.g. ZenaDrone voice" />
      </Field>
      <Field label="Guidance" htmlFor="ctx-body">
        <Textarea id="ctx-body" rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className="text-xs" maxLength={2000} />
        <p className="text-[10px] text-muted-foreground text-right">{form.body.length}/2000</p>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Works well (optional)" htmlFor="ctx-do">
          <Textarea id="ctx-do" rows={2} value={form.do_examples ?? ""} onChange={(e) => setForm((f) => ({ ...f, do_examples: e.target.value || null }))} className="text-xs" />
        </Field>
        <Field label="Avoid (optional)" htmlFor="ctx-dont">
          <Textarea id="ctx-dont" rows={2} value={form.dont_examples ?? ""} onChange={(e) => setForm((f) => ({ ...f, dont_examples: e.target.value || null }))} className="text-xs" />
        </Field>
      </div>
    </>
  );
}

function ScopeFields({ form, setForm, scope }: FormProps & { scope: ScopeOptions }) {
  return (
    <>
      <Field label="Brands">
        <Chips options={scope.brands} value={form.brands} onChange={(brands) => setForm((f) => ({ ...f, brands }))} anyLabel="All brands" />
      </Field>
      <Field label="Audiences">
        <Chips options={scope.audiences} value={form.audiences} onChange={(audiences) => setForm((f) => ({ ...f, audiences }))} anyLabel="All audiences" />
        {form.kind === "AUDIENCE_PROFILE" && form.audiences.length === 0 && (
          <p className={WARN}>Pick the audience this profile describes; profiles without one aren't used.</p>
        )}
      </Field>
      <Field label="Platforms">
        <Chips options={scope.platforms} value={form.platforms} onChange={(platforms) => setForm((f) => ({ ...f, platforms }))} anyLabel="All platforms" />
        {form.kind === "PLATFORM_NORM" && form.platforms.length === 0 && (
          <p className={WARN}>Pick the platform these norms describe; norms without one aren't used.</p>
        )}
      </Field>
    </>
  );
}

function SourceFields({ form, setForm }: FormProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Source (optional)" htmlFor="ctx-source">
        <Input id="ctx-source" value={form.source ?? ""} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value || null }))} className="text-xs" placeholder="e.g. Brand guidelines v2" />
      </Field>
      <Field label="As of (optional)" htmlFor="ctx-asof">
        <DateTimePicker id="ctx-asof" value={form.as_of} onChange={(v) => setForm((f) => ({ ...f, as_of: v || null }))} />
      </Field>
    </div>
  );
}
