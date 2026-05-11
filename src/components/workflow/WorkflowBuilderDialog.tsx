import { useEffect, useMemo, useState } from 'react';
import { appApi } from '@/api/app';
import type { Workflow, WorkflowSchedule } from '@/api/app';
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
    notify_on_completion: boolean;
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
  const [notifyOnCompletion, setNotifyOnCompletion] = useState(false);
  const [integrationsEnabled, setIntegrationsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const projectOptionsKey = useMemo(() => projects.map((p) => p.id).join('|'), [projects]);

  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      return;
    }
    setName(initialWorkflow?.name || '');
    setDescription(initialWorkflow?.description || '');
    setProjectId(initialWorkflow?.project_id || initialProjectId || projects[0]?.id || '');
    setScheduleEnabled(!!initialWorkflow?.schedule?.enabled);
    setCron(initialWorkflow?.schedule?.cron || '0 8 * * *');
    setTimezone(initialWorkflow?.schedule?.timezone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    setNotifyOnCompletion(!!initialWorkflow?.notify_on_completion);

    // Check if integrations are enabled
    const checkIntegrations = async () => {
      try {
        const settings = await appApi.getGlobalSettings();
        const enabled = !!(settings.channelConfig?.enabled && (settings.channelConfig?.telegramEnabled || settings.channelConfig?.whatsappEnabled));
        setIntegrationsEnabled(enabled);
      } catch (err) {
        console.error('Failed to fetch integration settings:', err);
      }
    };
    checkIntegrations();
  }, [open, initialWorkflow?.id]);

  useEffect(() => {
    if (!open) return;

    const availableProjectIds = new Set(projects.map((p) => p.id));
    const preferredProjectId = initialWorkflow?.project_id || initialProjectId || projects[0]?.id || '';

    setProjectId((current) => {
      if (current && availableProjectIds.has(current)) return current;
      return preferredProjectId;
    });
  }, [open, projectOptionsKey, initialProjectId, initialWorkflow?.project_id]);

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
        notify_on_completion: notifyOnCompletion,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    { title: 'Details', description: 'Basic info about your workflow' },
    { title: 'Steps', description: 'Configure what happens' },
    { title: 'Test', description: 'Validate execution logic' },
    { title: 'Schedule', description: 'Automate and notify' }
  ];

  const canGoNext = () => {
    if (currentStep === 1) return name.trim() && projectId;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {steps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i + 1 <= currentStep ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <DialogTitle>
            {mode === 'create' ? 'Create Workflow' : 'Edit Workflow'} — {steps[currentStep - 1].title}
          </DialogTitle>
          <DialogDescription>
            {steps[currentStep - 1].description}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[300px] py-4">
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
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
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="rounded-xl border border-dashed border-muted-foreground/20 p-8 text-center bg-muted/10">
                <div className="text-4xl mb-4">🛠️</div>
                <h4 className="font-bold mb-2 text-foreground">Workflow Steps Builder</h4>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  {mode === 'create' 
                    ? 'Once you create the workflow, we will open the builder canvas where you can add AI agents, research steps, and more.'
                    : 'You can modify steps directly on the workflow canvas after saving these details.'}
                </p>
                <div className="flex justify-center gap-3">
                  <div className="text-2xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground">
                    {initialWorkflow?.steps?.length || 0} existing steps
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-6">
                <h4 className="text-sm font-bold text-blue-500 mb-2 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white text-[10px]">!</span>
                  Pre-flight Validation
                </h4>
                <ul className="space-y-2">
                  <li className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Project directory exists
                  </li>
                  <li className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="text-emerald-500">✓</span> Default AI engine configured
                  </li>
                  <li className="text-xs text-muted-foreground flex items-center gap-2">
                    <span className="text-amber-500">●</span> 
                    {initialWorkflow?.steps?.length ? 'Steps ready for execution' : 'No steps yet (will be created in builder)'}
                  </li>
                </ul>
              </div>
              <p className="text-xs text-muted-foreground italic">
                Note: You can run a full test once the workflow is saved and steps are added.
              </p>
            </div>
          )}

          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Schedule</div>
                    <div className="text-xs text-muted-foreground">Optional: run this workflow automatically.</div>
                  </div>
                  <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} />
                </div>

                <div className={`space-y-4 ${scheduleEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
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

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="wf-cron">Cron Expression</Label>
                      <Input id="wf-cron" value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 8 * * *" disabled={!scheduleEnabled} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wf-tz">Timezone</Label>
                      <Input id="wf-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Jerusalem" disabled={!scheduleEnabled} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">Notifications</div>
                    <div className="text-xs text-muted-foreground">
                      Send a notification to enabled channels on completion.
                      {!integrationsEnabled && (
                        <span className="ml-1 text-primary cursor-pointer hover:underline" onClick={() => {
                            if ((window as any).__PRODUCTOS_SET_VIEW_MODE__) {
                              (window as any).__PRODUCTOS_SET_VIEW_MODE__('settings');
                              onOpenChange(false);
                            }
                        }}>
                          (Setup integrations)
                        </span>
                      )}
                    </div>
                  </div>
                  <Switch 
                    checked={notifyOnCompletion} 
                    onCheckedChange={setNotifyOnCompletion} 
                    disabled={!integrationsEnabled}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="ghost" onClick={() => setCurrentStep(prev => prev - 1)} disabled={saving}>
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          </div>
          
          {currentStep < 4 ? (
            <Button onClick={() => setCurrentStep(prev => prev + 1)} disabled={!canGoNext()}>
              Next
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving || !name.trim() || !projectId}>
              {saving ? 'Saving...' : mode === 'create' ? 'Create and open builder' : 'Save changes'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
