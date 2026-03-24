import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { calculateWorkflowOptimizer } from './optimizerModel';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function WorkflowOptimizerDialog({ open, onOpenChange }: Props) {
  const [competitorCount, setCompetitorCount] = useState(10);
  const [fanoutSteps, setFanoutSteps] = useState(5);
  const [perTaskRamMb, setPerTaskRamMb] = useState(220);
  const [globalMaxParallel, setGlobalMaxParallel] = useState(0);

  const result = useMemo(() => {
    const cores = typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 8) : 8;
    return calculateWorkflowOptimizer({
      competitorCount,
      fanoutSteps,
      perTaskRamMb,
      globalMaxParallel,
      cpuCores: cores,
    });
  }, [competitorCount, fanoutSteps, perTaskRamMb, globalMaxParallel]);

  const applySafePreset = () => {
    setGlobalMaxParallel(result.recommendedGlobalParallel);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]" data-testid="workflow-optimizer-dialog">
        <DialogHeader>
          <DialogTitle>Workflow Optimizer Helper</DialogTitle>
          <DialogDescription>
            Integrated helper flow for safer workflow scaling (no separate app needed).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1.5">
            <Label>Competitors</Label>
            <Input type="number" value={competitorCount} onChange={(e) => setCompetitorCount(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label>Fanout Steps</Label>
            <Input type="number" value={fanoutSteps} onChange={(e) => setFanoutSteps(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label>Per Task RAM (MB)</Label>
            <Input type="number" value={perTaskRamMb} onChange={(e) => setPerTaskRamMb(Number(e.target.value || 0))} />
          </div>
          <div className="space-y-1.5">
            <Label>Global Max Parallel (0=auto)</Label>
            <Input type="number" value={globalMaxParallel} onChange={(e) => setGlobalMaxParallel(Number(e.target.value || 0))} />
          </div>
        </div>

        <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/30">
          <div><b>Risk:</b> {result.risk.toUpperCase()}</div>
          <div><b>Projected workers:</b> {result.projectedWorkers}</div>
          <div><b>Effective parallel:</b> {result.effectiveParallel} (recommended {result.recommendedGlobalParallel})</div>
          <div><b>Projected peak RAM:</b> {result.projectedPeakRamMb} MB</div>
          {result.issues.length > 0 && (
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {result.issues.map((issue: string) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={applySafePreset}>Apply Safe Preset</Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
