import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EMPTY, kindInfo, type Option } from "@/components/compliance/context/kinds";
import { PLATFORM_LABELS, type SocialPlatform } from "@/components/video/PlatformIcon";
import { usePaged } from "@/hooks/usePaged";
import { useAuth } from "@/lib/AuthContext";
import { contextService } from "@/services/contextService";
import { submissionService } from "@/services/submissionService";
import type { ContextEntry, ContextEntryInput, ContextKind } from "@/types/context";

const nameOf = (list: Option[], v: string) => list.find((o) => o.value === v)?.label ?? v;

/** The brand, audience and platform names the pickers and "Applies to" lines use. */
function useScopeOptions() {
  const options = useQuery({ queryKey: ["submission-options"], queryFn: submissionService.getOptions, staleTime: 5 * 60_000 });
  return useMemo(() => {
    const brands: Option[] = (options.data?.brands ?? []).map((b) => ({ value: b.code, label: b.name }));
    const audiences: Option[] = Object.entries(options.data?.audiences ?? {}).map(([value, label]) => ({ value, label }));
    const platforms: Option[] = (options.data?.platforms ?? []).map((p) => ({ value: p, label: PLATFORM_LABELS[p as SocialPlatform] ?? p }));
    return { brands, audiences, platforms };
  }, [options.data]);
}

/** Saving, turning on/off and removing entries, each refreshing the list and the analyses that used it. */
function useEntryMutations(onSaved: (saved: ContextEntry) => void, onRemoved: () => void) {
  const queryClient = useQueryClient();
  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["messaging-context"] });
    // Analyses that used an edited entry are now out of date.
    queryClient.invalidateQueries({ queryKey: ["sentiment"] });
    toast.success(msg);
  };
  const save = useMutation({
    mutationFn: ({ id, form }: { id: string | null; form: ContextEntryInput }) =>
      id ? contextService.update(id, form) : contextService.create(form),
    onSuccess: (saved, { id }) => {
      done(id ? "Context saved" : "Context added");
      onSaved(saved);
    },
    onError: (err) => toast.error(`Couldn't save it: ${(err as Error).message}`),
  });
  const toggle = useMutation({
    mutationFn: (e: ContextEntry) => contextService.update(e.id, { ...e, is_active: !e.is_active }),
    onSuccess: (e) => done(e.is_active ? "Turned on" : "Turned off: the analysis won't use it"),
    onError: (err) => toast.error(`Couldn't change it: ${(err as Error).message}`),
  });
  const remove = useMutation({
    mutationFn: (id: string) => contextService.remove(id),
    onSuccess: () => {
      done("Removed");
      onRemoved();
    },
    onError: (err) => toast.error(`Couldn't remove it: ${(err as Error).message}`),
  });
  return { save, toggle, remove };
}

/**
 * Everything the Messaging Context page shows and does: the entries of the open kind, the audience profile picked,
 * the fact search, and adding, editing, turning off and removing entries.
 */
export function useMessagingContext() {
  const { hasPermission, user } = useAuth();
  const canEdit = hasPermission("CONFIG_ROLES_UPDATE");
  // Platform content policies are kept up to date from the platforms' policy pages; only super admins change them.
  const isSuperAdmin = Boolean(user?.is_super_admin);
  const canEditEntry = (e: ContextEntry) => canEdit && (!e.is_policy || isSuperAdmin);

  const [kind, setKind] = useState<ContextKind>("BRAND_VOICE");
  const [editing, setEditing] = useState<ContextEntry | "new" | null>(null);
  const [form, setForm] = useState<ContextEntryInput>(EMPTY("BRAND_VOICE"));
  const [deleting, setDeleting] = useState<ContextEntry | null>(null);
  // Facts run to hundreds (one per newsroom article): a search narrows them.
  const [factSearch, setFactSearch] = useState("");
  // Audience profiles are shown one at a time, picked from a row of buttons.
  const [profileId, setProfileId] = useState<string | null>(null);

  const entries = useQuery({ queryKey: ["messaging-context"], queryFn: contextService.list });
  const scope = useScopeOptions();
  const { save, toggle, remove } = useEntryMutations(
    (saved) => {
      // Show a newly added audience profile straight away.
      if (saved?.kind === "AUDIENCE_PROFILE") setProfileId(saved.id);
      setEditing(null);
    },
    () => setDeleting(null)
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of entries.data ?? []) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [entries.data]);
  const needle = factSearch.trim().toLowerCase();
  // A brand's voice read from its manual is shown in its brand card above the list, not again in the list.
  const ofKind = (entries.data ?? []).filter((e) => e.kind === kind && e.auto_source !== "BRAND_MANUAL");
  // The first profile is shown until another is picked (or if the picked one was removed).
  const selectedProfile = kind === "AUDIENCE_PROFILE" ? ofKind.find((e) => e.id === profileId) ?? ofKind[0] : undefined;
  const shown =
    kind === "FACT" && needle
      ? ofKind.filter((e) => `${e.title} ${e.body}`.toLowerCase().includes(needle))
      : selectedProfile
      ? [selectedProfile]
      : ofKind;
  // 20 to a page (the newsroom alone adds a couple of hundred facts); a new tab or search starts from the first page.
  const paged = usePaged(shown, 20, [kind, needle]);

  const open = (e: ContextEntry | "new") => {
    setForm(e === "new" ? EMPTY(kind) : { ...e });
    setEditing(e);
  };
  const scopeText = (e: ContextEntry) =>
    [
      e.brands.length ? e.brands.map((b) => nameOf(scope.brands, b)).join(", ") : null,
      e.audiences.length ? e.audiences.map((a) => nameOf(scope.audiences, a)).join(", ") : null,
      e.platforms.length ? e.platforms.map((p) => nameOf(scope.platforms, p)).join(", ") : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Everything";

  return {
    canEdit, isSuperAdmin, canEditEntry,
    kind, setKind, current: kindInfo(kind), counts,
    loading: entries.isLoading, ofKind, shown, paged, needle, factSearch, setFactSearch,
    selectedProfile, setProfileId,
    scope, scopeText,
    editing, setEditing, form, setForm, open,
    deleting, setDeleting,
    save: () => save.mutate({ id: editing && editing !== "new" ? editing.id : null, form }),
    saving: save.isPending,
    toggle: toggle.mutate, toggling: toggle.isPending,
    remove: remove.mutate, removing: remove.isPending,
  };
}
