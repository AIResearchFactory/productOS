import React, { useState, useEffect } from 'react';
import { 
  Brain, Trash2, Play, Download, 
  Layers, Activity, Info, Loader2, Sparkles 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { silentLearnerApi } from '@/api/server';
import { SilentLearnerStatus, SilentLearnerState } from '@/api/contracts';

interface SilentLearnerSettingsProps {
  projectId: string;
  projectName: string;
}

const SilentLearnerSettings: React.FC<SilentLearnerSettingsProps> = ({
  projectId,
  projectName
}) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<SilentLearnerStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanDetail, setScanDetail] = useState('');
  const [confirmForgetWorkspace, setConfirmForgetWorkspace] = useState(false);
  const [forgetInput, setForgetInput] = useState('');
  
  const targetProjectId = projectId;
  const targetProjectName = projectName;

  // Fetch status of the selected project
  const fetchStatus = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await silentLearnerApi.getStatus(id);
      setStatus(res);
    } catch (err: any) {
      console.error('Failed to load Silent Learner status:', err);
      toast({
        title: 'Error loading status',
        description: err.message || 'Unknown error occurred.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targetProjectId) {
      fetchStatus(targetProjectId);
    } else {
      setStatus(null);
    }
  }, [targetProjectId]);

  // Connect to SSE event listener for real-time progress updates
  useEffect(() => {
    if (!targetProjectId) return;

    let unlistenState: (() => void) | null = null;
    let unlistenProgress: (() => void) | null = null;
    let unlistenReady: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    // Use appApi.listen dynamically from window.dispatchEvent or direct SharedEventSource listeners
    // Wait, in runtime.ts, listen binds to sharedEventSource. Let's dynamically resolve it.
    import('@/api/runtime').then(({ runtimeApi }) => {
      runtimeApi.listen('silent_learner.state_changed', (event: any) => {
        const payload = event.payload;
        if (payload.workspaceId === targetProjectId) {
          setStatus(prev => prev ? { ...prev, state: payload.state } : null);
          if (payload.state === 'observing' || payload.state === 'memory_ready') {
            fetchStatus(targetProjectId);
          }
        }
      }).then(un => unlistenState = un);

      runtimeApi.listen('silent_learner.scan_progress', (event: any) => {
        const payload = event.payload;
        if (payload.workspaceId === targetProjectId) {
          setScanProgress(payload.progress);
          setScanDetail(payload.detail);
        }
      }).then(un => unlistenProgress = un);

      runtimeApi.listen('silent_learner.memory_ready', (event: any) => {
        const payload = event.payload;
        if (payload.workspaceId === targetProjectId) {
          toast({
            title: 'Memory Distillation Ready',
            description: `Distilled ${payload.memoryItemCount} lessons from ${payload.sourceSessionCount} sessions.`,
          });
          fetchStatus(targetProjectId);
        }
      }).then(un => unlistenReady = un);

      runtimeApi.listen('silent_learner.error', (event: any) => {
        const payload = event.payload;
        if (payload.workspaceId === targetProjectId) {
          toast({
            title: 'Silent Learner Alert',
            description: payload.errorType === 'redaction_failed' 
              ? 'Distillation paused due to sensitive keywords.'
              : 'Lessons saved, but AI provider is unavailable.',
            variant: 'destructive',
          });
          fetchStatus(targetProjectId);
        }
      }).then(un => unlistenError = un);
    });

    return () => {
      if (unlistenState) unlistenState();
      if (unlistenProgress) unlistenProgress();
      if (unlistenReady) unlistenReady();
      if (unlistenError) unlistenError();
    };
  }, [targetProjectId]);

  const handleToggle = async (checked: boolean) => {
    if (!targetProjectId) return;
    try {
      const result = await silentLearnerApi.toggle(targetProjectId, checked);
      setStatus(prev => prev ? { ...prev, state: result.state as SilentLearnerState } : null);
      toast({
        title: checked ? 'Silent Learner Enabled' : 'Silent Learner Disabled',
        description: checked 
          ? 'Passive monitoring started. All captured data remains local.' 
          : 'Monitoring paused. Extracted patterns remain saved.',
      });
      fetchStatus(targetProjectId);
    } catch (err: any) {
      toast({
        title: 'Failed to update toggle',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleOptimize = async () => {
    if (!targetProjectId) return;
    setScanProgress(0);
    setScanDetail('Starting optimization...');
    try {
      await silentLearnerApi.optimize(targetProjectId);
      toast({
        title: 'Cold-Start Optimize Scan Triggered',
        description: 'Scanning history files. You can track progress below.',
      });
    } catch (err: any) {
      toast({
        title: 'Optimization failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleForgetWorkspace = async () => {
    if (!targetProjectId) return;
    if (forgetInput !== targetProjectName) {
      toast({
        title: 'Invalid project name',
        description: 'Please type the exact project name to confirm data deletion.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await silentLearnerApi.forgetWorkspace(targetProjectId);
      toast({
        title: 'Workspace Data Cleared',
        description: 'Successfully deleted all SQLite records and JSONL memory files.',
      });
      setConfirmForgetWorkspace(false);
      setForgetInput('');
      fetchStatus(targetProjectId);
    } catch (err: any) {
      toast({
        title: 'Failed to delete data',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleExport = async () => {
    if (!targetProjectId || targetProjectId === 'all') return;
    try {
      const data = await silentLearnerApi.exportMemory(targetProjectId);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${targetProjectName}-memory-pack.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast({
        title: 'Export successful',
        description: 'Memory pack JSON downloaded.',
      });
    } catch (err: any) {
      toast({
        title: 'Export failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (state: SilentLearnerState) => {
    switch (state) {
      case 'observing': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'distilling': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'memory_ready': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'paused': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const renderStatusText = (state: SilentLearnerState) => {
    switch (state) {
      case 'off': return 'Silent Learner: Off';
      case 'observing': return 'Observing';
      case 'distilling': return 'Distilling...';
      case 'memory_ready': return 'Memory Ready ✓';
      case 'paused': return 'Paused ⚠';
      default: return 'Offline';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 italic tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Silent Learner Mode
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Passive local-first background observer that improves context efficiency and saves tokens.
          </p>
        </div>
      </div>

      {!status || loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Main Controls Card */}
          <Card className="border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 shadow-sm border-2 overflow-hidden">
            <CardHeader className="p-6 pb-4 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-md font-semibold">Workspace Mode & Status</CardTitle>
                <CardDescription className="text-xs">Manage observer settings for {targetProjectName}</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={`border px-2.5 py-0.5 rounded-full text-2xs font-semibold ${getStatusColor(status.state)}`}>
                  {renderStatusText(status.state)}
                </Badge>
                <Switch 
                  checked={status.state !== 'off'} 
                  onCheckedChange={handleToggle}
                  aria-label="Toggle Silent Learner"
                />
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              {status.state === 'off' ? (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-950/50 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Info className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Observe and Adapt, Privately</h4>
                      <p className="text-2xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                        Silent Learner silently indexes file patterns, user-accepted code corrections, and style rules locally.
                        All memory packs reside under <code className="font-mono text-primary bg-primary/5 px-1 rounded">.metadata/memory-packs/</code> inside your project directory. 
                        No telemetry or workspace source code is sent to external clouds.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Stats Grid */}
                  <Card className="border border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-gray-950/30">
                    <CardHeader className="p-4 pb-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5" /> Sessions Observed
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <span className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                        {status.sessionsObserved}
                      </span>
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-gray-950/30">
                    <CardHeader className="p-4 pb-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> Qualifying Events
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <span className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                        {status.qualifyingEvents}
                      </span>
                    </CardContent>
                  </Card>

                  <Card className="border border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-gray-950/30">
                    <CardHeader className="p-4 pb-1">
                      <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" /> Memory Packs
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <span className="text-2xl font-bold font-mono text-gray-900 dark:text-gray-100">
                        {status.memoryPackCount}
                      </span>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Progress Panel for Distilling / Scanning state */}
              {status.state === 'distilling' && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3 animate-pulse">
                  <div className="flex items-center justify-between text-2xs font-semibold text-amber-600 dark:text-amber-400">
                    <span>Distilling lessons into memory packs...</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <Progress value={scanProgress} className="h-1.5 bg-amber-500/10" />
                  <p className="text-2xs text-gray-500 dark:text-gray-400 font-mono mt-1">{scanDetail || 'Writing JSONL files...'}</p>
                </div>
              )}

              {/* Optimization Trigger Card */}
              {status.state === 'observing' && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-primary/10 bg-primary/5">
                  <div className="space-y-0.5">
                    <label className="text-xs font-semibold text-gray-900 dark:text-gray-100">Optimize Memory (Cold-Start Scan)</label>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Scan your existing chat logs and file metadata references to immediately bootstrap local context scoring.
                    </p>
                  </div>
                  <Button size="sm" onClick={handleOptimize} className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/95 text-white">
                    <Play className="w-3.5 h-3.5" /> Optimize Memory
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Memory Packs Insights List */}
          {status.state !== 'off' && status.memoryPacks && status.memoryPacks.length > 0 && (
            <Card className="border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 shadow-sm border-2 overflow-hidden">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Memory Insights</span>
                  {status.lastUpdated && (
                    <span className="text-[10px] font-normal text-gray-400">
                      Last compiled: {new Date(status.lastUpdated).toLocaleTimeString()}
                    </span>
                  )}
                </CardTitle>
                <CardDescription className="text-xs">Distilled knowledge segments loaded into AI system context</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {status.memoryPacks.map((pack: any, idx) => (
                    <div key={idx} className="p-4 flex items-center justify-between hover:bg-gray-50/20 dark:hover:bg-gray-800/10 transition-colors">
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">{pack.name}</h4>
                        <p className="text-2xs text-gray-400">{pack.eventCount} lessons logged · Type: {pack.packType}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-2xs font-mono font-medium text-gray-400">Relevance:</span>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span 
                              key={i} 
                              className={`w-1.5 h-3.5 rounded-sm ${
                                i < Math.round(pack.relevanceScore * 5) 
                                  ? 'bg-primary' 
                                  : 'bg-gray-200 dark:bg-gray-800'
                              }`} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Privacy & Safety Segment */}
          {status.state !== 'off' && (
            <Card className="border-red-500/20 bg-red-500/5 dark:bg-red-950/5 shadow-sm border-2 overflow-hidden">
              <CardHeader className="p-6 pb-4">
                <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-400">Privacy & Memory Control</CardTitle>
                <CardDescription className="text-xs text-red-600/70">Wipe and forget learning records from this machine</CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100">Forget this Workspace</h4>
                    <p className="text-2xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      Wipes all SQLite logs, redaction files, file weights, and memory packs generated for {targetProjectName}.
                    </p>
                  </div>
                  <div className="flex w-full sm:w-auto gap-2">
                    <Button size="sm" variant="outline" onClick={handleExport} className="w-full sm:w-auto gap-1">
                      <Download className="w-3.5 h-3.5" /> Export Pack
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => setConfirmForgetWorkspace(true)}
                      className="w-full sm:w-auto gap-1 bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All Data
                    </Button>
                  </div>
                </div>

                {confirmForgetWorkspace && (
                  <div className="p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 space-y-3">
                    <p className="text-2xs font-semibold text-red-700 dark:text-red-400">
                      WARNING: This action is irreversible. All learning events and optimized parameters for this project will be deleted permanently.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-grow space-y-1">
                        <Label className="text-2xs text-red-700 dark:text-red-400 font-bold">Type project name to confirm: <span className="font-mono bg-white dark:bg-gray-800 px-1 py-0.5 rounded border border-red-300">{targetProjectName}</span></Label>
                        <input 
                          type="text" 
                          placeholder="Project name"
                          value={forgetInput}
                          onChange={(e) => setForgetInput(e.target.value)}
                          className="h-8 w-full text-xs rounded border border-red-300 px-3 bg-white dark:bg-gray-900"
                        />
                      </div>
                      <div className="flex gap-2 self-end">
                        <Button size="sm" variant="outline" onClick={() => { setConfirmForgetWorkspace(false); setForgetInput(''); }}>
                          Cancel
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleForgetWorkspace} className="bg-red-600 hover:bg-red-700 text-white">
                          Confirm Wipe
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default SilentLearnerSettings;
