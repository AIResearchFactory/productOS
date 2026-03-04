import { useEffect, useMemo, useState } from 'react';
import { WorkflowSchedule } from '@/api/tauri';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type IntervalType = 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly';

interface WorkflowScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: WorkflowSchedule;
  isDraft?: boolean;
  onSave: (schedule: WorkflowSchedule) => Promise<void>;
  onClear: () => Promise<void>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_OF_WEEK = [
  { label: 'Monday', value: '1' },
  { label: 'Tuesday', value: '2' },
  { label: 'Wednesday', value: '3' },
  { label: 'Thursday', value: '4' },
  { label: 'Friday', value: '5' },
  { label: 'Saturday', value: '6' },
  { label: 'Sunday', value: '0' },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => ({
  label: `${i + 1}${ordinal(i + 1)}`,
  value: String(i + 1),
}));

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/** Pad a number to 2 digits. */
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Return the local datetime string (yyyy-MM-ddTHH:mm) offset to nearest future minute. */
function defaultOnceDateTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000); // +1 h from now
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:00`;
}

/**
 * Build a cron expression from the chosen interval + options.
 *
 * "once" → run at the exact datetime; callers should clear the schedule after
 *          it triggers, but we encode it as a standard cron so the backend can
 *          handle it uniformly.
 */
function buildCron(
  interval: IntervalType,
  hour: number,
  weekDay: string,
  monthDay: string,
  onceDateTime: string,
): string {
  switch (interval) {
    case 'once': {
      // onceDateTime is "yyyy-MM-ddTHH:mm"
      const [datePart, timePart] = onceDateTime.split('T');
      const [y, mo, d] = (datePart ?? '').split('-').map(Number);
      const [h, m] = (timePart ?? '').split(':').map(Number);
      if (!y || !mo || !d || isNaN(h) || isNaN(m)) return '0 9 * * *';
      return `${m} ${h} ${d} ${mo} *`;
    }
    case 'daily':
      return `0 ${hour} * * *`;
    case 'weekly':
      return `0 ${hour} * * ${weekDay}`;
    case 'monthly':
      return `0 ${hour} ${monthDay} * *`;
    case 'quarterly':
      // 1st of Jan, Apr, Jul, Oct
      return `0 ${hour} ${monthDay} 1,4,7,10 *`;
    default:
      return `0 ${hour} * * *`;
  }
}

/** Try to detect interval from an existing cron expression (best-effort). */
function detectInterval(cron: string): IntervalType | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [, , dom, month, dow] = parts;
  if (month === '1,4,7,10') return 'quarterly';
  if (dom !== '*' && month === '*' && dow === '*') return 'monthly';
  if (dom === '*' && month === '*' && dow !== '*') return 'weekly';
  if (dom === '*' && month === '*' && dow === '*') return 'daily';
  return null; // custom / once
}

/** Extract hour from cron expression */
function extractHour(cron: string): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 2) return 9;
  const h = parseInt(parts[1], 10);
  return isNaN(h) ? 9 : h;
}

/** Extract day-of-week (weekly) */
function extractWeekDay(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return '1';
  return parts[4] === '*' ? '1' : parts[4];
}

/** Extract day-of-month */
function extractMonthDay(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 3) return '1';
  return parts[2] === '*' ? '1' : parts[2];
}

/** Human-readable summary for the interval selection. */
function intervalLabel(
  interval: IntervalType,
  hour: number,
  weekDay: string,
  monthDay: string,
  onceDateTime: string,
): string {
  const time = `${pad2(hour)}:00`;
  const dayName = DAYS_OF_WEEK.find((d) => d.value === weekDay)?.label ?? 'Monday';
  const mDay = `${monthDay}${ordinal(Number(monthDay))}`;
  switch (interval) {
    case 'once': return `Once at ${onceDateTime.replace('T', ' ')}`;
    case 'daily': return `Daily at ${time}`;
    case 'weekly': return `Every ${dayName} at ${time}`;
    case 'monthly': return `Monthly on the ${mDay} at ${time}`;
    case 'quarterly': return `Quarterly on the ${mDay} at ${time}`;
    default: return 'Custom';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowScheduleDialog({
  open,
  onOpenChange,
  value,
  isDraft = false,
  onSave,
  onClear,
}: WorkflowScheduleDialogProps) {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // ── state ──────────────────────────────────────────────────────────────────
  const [enabled, setEnabled] = useState(value?.enabled ?? true);
  const [interval, setInterval] = useState<IntervalType>('daily');
  const [hour, setHour] = useState(9); // default start hour
  const [weekDay, setWeekDay] = useState('1'); // Monday
  const [monthDay, setMonthDay] = useState('1'); // 1st
  const [onceDateTime, setOnceDateTime] = useState(defaultOnceDateTime);
  const [cron, setCron] = useState(value?.cron ?? '0 9 * * *');
  const [timezone, setTimezone] = useState(value?.timezone ?? localTz);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);

  // ── sync from existing schedule on open ────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const existingCron = value?.cron ?? '0 9 * * *';
    const detected = detectInterval(existingCron);
    if (detected) {
      setInterval(detected);
      setHour(extractHour(existingCron));
      setWeekDay(extractWeekDay(existingCron));
      setMonthDay(extractMonthDay(existingCron));
    } else {
      setInterval('daily');
      setHour(9);
      setWeekDay('1');
      setMonthDay('1');
    }
    setCron(existingCron);
    setTimezone(value?.timezone ?? localTz);
    setEnabled(value?.enabled ?? true);
    setSavedSummary(null);
    setAdvancedOpen(false);
  }, [open, value]);

  // ── keep cron in sync when picker values change ───────────────────────────
  useEffect(() => {
    if (interval === 'once') return; // once is synced separately
    const built = buildCron(interval, hour, weekDay, monthDay, onceDateTime);
    setCron(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, hour, weekDay, monthDay]);

  useEffect(() => {
    if (interval !== 'once') return;
    const built = buildCron('once', hour, weekDay, monthDay, onceDateTime);
    setCron(built);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onceDateTime, interval]);

  // ── derived ────────────────────────────────────────────────────────────────
  const summary = useMemo(
    () => intervalLabel(interval, hour, weekDay, monthDay, onceDateTime),
    [interval, hour, weekDay, monthDay, onceDateTime],
  );

  const localNextRun = useMemo(() => {
    if (!value?.next_run_at) return null;
    const d = new Date(value.next_run_at);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString();
  }, [value?.next_run_at]);

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const finalCron = cron.trim() || buildCron(interval, hour, weekDay, monthDay, onceDateTime);
    if (!finalCron) return;
    const finalTimezone = timezone.trim() || 'UTC';
    setSaving(true);
    try {
      await onSave({
        enabled,
        cron: finalCron,
        timezone: finalTimezone,
        next_run_at: value?.next_run_at,
        last_triggered_at: value?.last_triggered_at,
      });
      setSavedSummary(`Saved: ${summary} • ${finalTimezone}`);
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

  // Hour options 0–23
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: `${pad2(i)}:00`,
  }));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Workflow Schedule</DialogTitle>
        </DialogHeader>

        {isDraft ? (
          <div className="text-sm text-muted-foreground">
            Save this workflow first, then you can configure a schedule.
          </div>
        ) : (
          <div className="space-y-5">

            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Enable schedule</div>
                <div className="text-xs text-muted-foreground">Run this workflow automatically.</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Interval selector */}
            <div className="space-y-2">
              <Label>Frequency</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'daily', label: 'Daily' },
                    { key: 'weekly', label: 'Weekly' },
                    { key: 'monthly', label: 'Monthly' },
                    { key: 'quarterly', label: 'Quarterly' },
                    { key: 'once', label: 'Run once…' },
                  ] as { key: IntervalType; label: string }[]
                ).map(({ key, label }) => (
                  <Button
                    key={key}
                    type="button"
                    variant={interval === key ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 text-[12px]"
                    onClick={() => setInterval(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Context-sensitive options */}
            {interval === 'once' ? (
              <div className="space-y-2">
                <Label htmlFor="wf-once-dt">Run at</Label>
                <Input
                  id="wf-once-dt"
                  type="datetime-local"
                  value={onceDateTime}
                  onChange={(e) => setOnceDateTime(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  The workflow will run once at this time and can be cleared afterwards.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Start hour */}
                <div className="space-y-1">
                  <Label>Start hour</Label>
                  <Select value={String(hour)} onValueChange={(v) => setHour(Number(v))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select hour" />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {hourOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Weekly → day of week */}
                {interval === 'weekly' && (
                  <div className="space-y-1">
                    <Label>Day of week</Label>
                    <Select value={weekDay} onValueChange={setWeekDay}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DAYS_OF_WEEK.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Monthly / Quarterly → day of month */}
                {(interval === 'monthly' || interval === 'quarterly') && (
                  <div className="space-y-1">
                    <Label>Day of month</Label>
                    <Select value={monthDay} onValueChange={setMonthDay}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-52">
                        {DAYS_OF_MONTH.map((d) => (
                          <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Summary pill */}
            {interval !== 'once' && (
              <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                📅 <strong>{summary}</strong>
              </div>
            )}

            {/* Next run info */}
            {!!value?.next_run_at && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>Next run (UTC): <span className="font-mono">{value.next_run_at}</span></div>
                {localNextRun && <div>Next run (Local): <span className="font-mono">{localNextRun}</span></div>}
              </div>
            )}

            {/* ── Advanced section (collapsible) ─────────────────────────── */}
            <div className="rounded-md border">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setAdvancedOpen((v) => !v)}
              >
                <span>Advanced</span>
                {advancedOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {advancedOpen && (
                <div className="space-y-3 border-t px-3 pb-3 pt-3">
                  <div className="space-y-1">
                    <Label htmlFor="wf-cron">Cron expression</Label>
                    <Input
                      id="wf-cron"
                      value={cron}
                      onChange={(e) => setCron(e.target.value)}
                      placeholder="0 9 * * *"
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Edit directly to override the schedule above.{' '}
                      <a
                        className="underline"
                        href="https://crontab.guru/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        crontab.guru
                      </a>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wf-timezone">Timezone (IANA)</Label>
                    <Input
                      id="wf-timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      placeholder="UTC / America/New_York / Europe/Berlin"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Saved confirmation */}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          {!isDraft && (
            <Button onClick={handleSave} disabled={saving || !cron.trim()}>
              {saving ? 'Saving…' : 'Save schedule'}
            </Button>
          )}
          {savedSummary && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
