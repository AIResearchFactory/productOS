import { useEffect, useMemo, useState } from 'react';
import { Workflow, WorkflowSchedule } from '@/api/tauri';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface WorkflowBuilderDialogProps {
  open: boolean;
  mode: 'create' | 'edit';
  projects: { id: string; name: string }[];
  initialProjectId?: string;
  initialWorkflow?: Workflow | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    name: string;
    description: string;
    projectId: string;
    schedule: WorkflowSchedule | null;
  }) => Promise<void>;
}

export default function WorkflowBuilderDialog({
  open,
  mode,
  projects,
  initialProjectId,
  initialWorkflow,
  onOpenChange,
  onSubmit,
}: WorkflowBuilderDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cron, setCron] = useState('0 8 * * *');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialWorkflow?.name || '');
    setDescription(initialWorkflow?.description || '');
    setProjectId(initialWorkflow?.project_id || initialProjectId || projects[0]?.id || '');
    setScheduleEnabled(!!initialWorkflow?.schedule?.enabled);
    setCron(initialWorkflow?.schedule?.cron || '0 8 * * *');
    setTimezone(initialWorkflow?.schedule?.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
  }, [open, initialWorkflow, initialProjectId, projects]);

  const presets = useMemo(() => ([
    { label: 'Daily 08:00', cron: '0 8 * * *' },
    { label: 'Daily 09:00', cron: '0 9 * * *' },
    { label: 'Weekdays 08:00', cron: '0 8 * * 1-5' },
    { label: 'Hourly', cron: '0 * * * *' },
  ]), []);

  const handleSubmit = async () => {
    if (!name.trim() || !projectId) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        projectId,
        schedule: scheduleEnabled
          ? {
              enabled: true,
              cron: cron.trim(),
              timezone: timezone.trim() || 'UTC',
            }
          : null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Workflow' : 'Edit Workflow'}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Set name, project, and optional schedule.'
              : 'Update workflow details and scheduling.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wf-name">Workflow name</Label>
              <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily research brief" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-desc">Description</Label>
              <Input id="wf-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should this workflow do?" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wf-project">Project</Label>
              <select
                id="wf-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">Schedule</div>
                <div className="text-xs text-muted-foreground">Optional: run this workflow automatically.</div>
              </div>
              <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
            </div>

            <div className={`space-y-4 ${scheduleEnabled ? '' : 'opacity-50'}`}>
              <div className="space-y-2">
                <Label>Quick presets</Label>
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <Button
                      key={p.cron}
                      type="button"
                      size="sm"
                      variant={cron === p.cron ? 'default' : 'outline'}
                      onClick={() => setCron(p.cron)}
                      disabled={!scheduleEnabled}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wf-cron">Cron</Label>
                <Input id="wf-cron" value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 8 * * *" disabled={!scheduleEnabled} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wf-tz">Timezone</Label>
                <Input id="wf-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Jerusalem" disabled={!scheduleEnabled} />
              </div>
              {!scheduleEnabled && <div className="text-xs text-muted-foreground">Turn on schedule to activate automatic runs.</div>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !name.trim() || !projectId}>
            {saving ? 'Saving...' : mode === 'create' ? 'Create workflow' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
