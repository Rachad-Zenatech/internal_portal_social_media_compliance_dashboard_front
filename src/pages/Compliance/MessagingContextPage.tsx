import { Plus } from "lucide-react";

import ListPager from "@/components/common/ListPager";
import BrandVoicePanel from "@/components/compliance/BrandVoicePanel";
import NewsroomSyncBar from "@/components/compliance/NewsroomSyncBar";
import PolicyWatchPanel from "@/components/compliance/PolicyWatchPanel";
import AudienceProfileButtons from "@/components/compliance/context/AudienceProfileButtons";
import ContextEntryDialog from "@/components/compliance/context/ContextEntryDialog";
import ContextEntryList from "@/components/compliance/context/ContextEntryList";
import FactSearchBar from "@/components/compliance/context/FactSearchBar";
import KindTabs, { KindHelp } from "@/components/compliance/context/KindTabs";
import RemoveEntryDialog from "@/components/compliance/context/RemoveEntryDialog";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useMessagingContext } from "@/hooks/useMessagingContext";

/**
 * Messaging Context: the background the content analysis is given, so it judges tone against the brand's voice,
 * the platform and the audience, and checks claims against known facts.
 */
export default function MessagingContextPage() {
  const c = useMessagingContext();
  const addButton = c.canEdit ? (
    <Button size="sm" className="text-xs gap-1.5 font-semibold" onClick={() => c.open("new")}>
      <Plus className="w-3.5 h-3.5" /> Add {c.current.label.toLowerCase().replace(/s$/, "")}
    </Button>
  ) : undefined;

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-4 sm:space-y-5 pb-6 animate-in fade-in duration-300">
      <DashboardHeader
        title="Messaging Context"
        subtitle="Background the sentiment analysis uses: brand voice, facts, platform norms and audience profiles."
        actions={addButton}
      />
      <KindTabs kind={c.kind} counts={c.counts} onChange={c.setKind} />

      <Card className="py-0 gap-0 border-border/80 shadow-xs overflow-hidden">
        <KindHelp info={c.current} />
        {c.kind === "FACT" && <NewsroomSyncBar canSync={c.canEdit} />}
        {c.kind === "PLATFORM_NORM" && c.isSuperAdmin && <PolicyWatchPanel />}
        {c.kind === "BRAND_VOICE" && <BrandVoicePanel />}
        {c.kind === "AUDIENCE_PROFILE" && (
          <AudienceProfileButtons profiles={c.ofKind} selectedId={c.selectedProfile?.id} onSelect={c.setProfileId} />
        )}
        {c.kind === "FACT" && <FactSearchBar total={c.ofKind.length} value={c.factSearch} onChange={c.setFactSearch} />}
        <ContextEntryList
          loading={c.loading}
          kind={c.kind}
          info={c.current}
          needle={c.needle}
          total={c.shown.length}
          items={c.paged.pageItems}
          scopeText={c.scopeText}
          canEdit={c.canEditEntry}
          onToggle={c.toggle}
          toggling={c.toggling}
          onEdit={c.open}
          onRemove={c.setDeleting}
        />
        <ListPager
          className="border-t border-border/60 px-4 py-2.5"
          page={c.paged.page}
          pageCount={c.paged.pageCount}
          pageSize={c.paged.pageSize}
          total={c.paged.total}
          noun={c.kind === "FACT" ? "facts" : "entries"}
          onPage={c.paged.setPage}
        />
      </Card>

      <ContextEntryDialog
        open={c.editing !== null}
        isNew={c.editing === "new"}
        form={c.form}
        setForm={c.setForm}
        scope={c.scope}
        saving={c.saving}
        onSave={c.save}
        onClose={() => c.setEditing(null)}
      />
      <RemoveEntryDialog entry={c.deleting} removing={c.removing} onRemove={c.remove} onClose={() => c.setDeleting(null)} />
    </div>
  );
}
