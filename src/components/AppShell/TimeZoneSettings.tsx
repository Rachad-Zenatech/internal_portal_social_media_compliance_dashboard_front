import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useUserTimezone } from "@/hooks/useUserTimezone";
import { browserTimezone, timezoneOptionLabel } from "@/lib/userTimezone";
import { saveUserTimezone } from "@/services/emailTimezoneService";
import { Button } from "@/components/ui/button";

const zones = Array.from(new Set(["UTC", browserTimezone(), ...Intl.supportedValuesOf("timeZone")])).sort();
export default function TimeZoneSettings() {
  const { user } = useAuth();
  const { time_zone: saved } = useUserTimezone();
  const [selected, setSelected] = useState<string>();
  const [saving, setSaving] = useState(false);
  const value = selected ?? saved;
  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveUserTimezone(user.id, value);
      setSelected(undefined);
      toast.success("Time zone saved. Existing deadlines stay at the same moment.");
    } catch { toast.error("Could not save your time zone. Please try again."); }
    finally { setSaving(false); }
  };
  const options = zones.includes(saved) ? zones : [saved, ...zones];
  const now = new Date();
  return (
    <section className="space-y-2 rounded-lg border bg-card p-3">
      <label htmlFor="profile-timezone" className="text-sm font-medium">Your time zone</label>
      <p className="text-xs text-muted-foreground">Dates, deadlines and email times use this zone. Changing it keeps every scheduled moment unchanged.</p>
      <select id="profile-timezone" className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={value} onChange={event => setSelected(event.target.value)} disabled={saving}>
        {options.map(zone => <option key={zone} value={zone}>{timezoneOptionLabel(zone, now)}</option>)}
      </select>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={save} disabled={saving || value === saved}>{saving ? "Saving..." : "Save time zone"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setSelected(browserTimezone())}>Use device time zone</Button>
      </div>
    </section>
  );
}
