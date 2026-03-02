import { useEffect, useMemo, useState } from 'react';
import { WorkflowSchedule } from '@/api/tauri';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface WorkflowScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: WorkflowSchedule;
  isDraft?: boolean;
  onSave: (schedule: WorkflowSchedule) => Promise<void>;
  onClear: () => Promise<void>;
}

export default function WorkflowScheduleDialog({
  open,
  onOpenChange,
  value,
  isDraft = false,
  onSave,
  onClear,
}: WorkflowScheduleDialogProps) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [enabled, setEnabled] = useState(value?.enabled ?? true);
  const [cron, setCron] = useState(value?.cron ?? '*/15 * * * *');
  const [timezone, setTimezone] = useState(value?.timezone ?? localTz);
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  const presets = useMemo(() => ([
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Hourly', cron: '0 * * * *' },
    { label: 'Daily (09:00)', cron: '0 9 * * *' },
    { label: 'Weekdays (09:00)', cron: '0 9 * * 1-5' },
    { label: 'Weekly (Mon 09:00)', cron: '0 9 * * 1' },
  ]), []);

  const cronHint = useMemo(() => {
    const match = presets.find((p) => p.cron === cron.trim());
    if (match) return match.label;
    if (!cron.trim()) return 'Enter a cron expression';
    return 'Custom schedule';
  }, [cron, presets]);

  const localNextRun = useMemo(() => {
    if (!value?.next_run_at) return null;
    const d = new Date(value.next_run_at);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [value?.next_run_at]);

  useEffect(() => {
    if (!open) return;
    setEnabled(value?.enabled ?? true);
    setCron(value?.cron ?? '*/15 * * * *');
    setTimezone(value?.timezone ?? localTz);
    setSavedSummary(null);
  }, [open, value?.enabled, value?.cron, value?.timezone]);

  const handleSave = async () => {
    if (!cron.trim()) return;
    setSaving(true);
    try {
      const finalTimezone = timezone.trim() || 'UTC';
      await onSave({
        enabled,
        cron: cron.trim(),
        timezone: finalTimezone,
        next_run_at: value?.next_run_at,
        last_triggered_at: value?.last_triggered_at,
      });
      setSavedSummary(`Saved: ${cronHint} • ${finalTimezone}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      await onClear();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow Schedule</DialogTitle>
        </DialogHeader>

        {isDraft ? (
          <div className="text-sm text-muted-foreground">
            Save this workflow first, then you can configure a schedule.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Enable schedule</div>
                <div className="text-xs text-muted-foreground">Run this workflow automatically via cron.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="space-y-2">
              <Label>Quick schedule</Label>
              <div className="flex flex-wrap gap-2">
                {presets.map((preset) => (
                  <Button
                    key={preset.cron}
                    type="button"
                    variant={cron.trim() === preset.cron ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px]"
                    onClick={() => setCron(preset.cron)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-cron">Cron expression</Label>
              <Input
                id="wf-cron"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="*/15 * * * *"
              />
              <p className="text-[11px] text-muted-foreground">Meaning: <strong>{cronHint}</strong></p>
              <p className="text-[11px] text-muted-foreground">Example: <code>0 * * * *</code> = every hour.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wf-timezone">Timezone (IANA)</Label>
              <Input
                id="wf-timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="UTC / Asia/Jerusalem / Europe/Berlin"
              />
            </div>

            {!!value?.next_run_at && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Next run (UTC): <span className="font-mono">{value.next_run_at}</span></div>
                {localNextRun && <div>Next run (Local): <span className="font-mono">{localNextRun}</span></div>}
              </div>
            )}

            {savedSummary && (
              <div className="text-xs rounded-md border bg-muted px-2 py-1 text-foreground">
                {savedSummary} ✅
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!isDraft && !!value && (
            <Button variant="destructive" onClick={handleClear} disabled={saving}>
              Clear schedule
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          {!isDraft && (
            <Button onClick={handleSave} disabled={saving || !cron.trim()}>
              {saving ? 'Saving...' : 'Save schedule'}
            </Button>
          )}
          {savedSummary && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
