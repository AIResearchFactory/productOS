import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  message?: string;
}

interface ProgressDisplayProps {
  steps: ProgressStep[];
  currentStepId: string;
  progressPercentage: number;
}

export default function ProgressDisplay({ steps, currentStepId, progressPercentage }: ProgressDisplayProps) {
  const getStepIcon = (step: ProgressStep) => {
    switch (step.status) {
      case 'completed':
        return <Check className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span>Installation Progress</span>
            <span>{progressPercentage}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Step List */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-start gap-4 p-4 rounded-lg transition-all ${step.id === currentStepId
                  ? 'bg-blue-50 dark:bg-blue-950 border-2 border-blue-200 dark:border-blue-800'
                  : 'bg-gray-50 dark:bg-gray-800'
                }`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getStepIcon(step)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Step {index + 1}
                  </span>
                  <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700" />
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {step.label}
                </h3>
                {step.message && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {step.message}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
