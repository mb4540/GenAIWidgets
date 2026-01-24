import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle, SkipForward } from 'lucide-react';

import type { ExecutionPlan, PlanStep, StepStatus } from '@/types/agent';

interface PlanProgressProps {
  plan: ExecutionPlan | null;
  isLoading?: boolean;
  className?: string;
}

interface StepItemProps {
  step: PlanStep;
  isCurrentStep: boolean;
}

const STATUS_CONFIG: Record<StepStatus, { icon: typeof Circle; color: string; label: string; badgeColor: string }> = {
  pending: { icon: Circle, color: 'text-gray-400', label: 'Pending', badgeColor: 'bg-gray-100 text-gray-600' },
  in_progress: { icon: Loader2, color: 'text-blue-500', label: 'In Progress', badgeColor: 'bg-blue-100 text-blue-700' },
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed', badgeColor: 'bg-green-100 text-green-700' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed', badgeColor: 'bg-red-100 text-red-700' },
  skipped: { icon: SkipForward, color: 'text-yellow-500', label: 'Skipped', badgeColor: 'bg-yellow-100 text-yellow-700' },
};

const PLAN_STATUS_COLORS: Record<string, string> = {
  planning: 'bg-purple-100 text-purple-700',
  executing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  waiting_for_user: 'bg-yellow-100 text-yellow-700',
};

function StepItem({ step, isCurrentStep }: StepItemProps): React.ReactElement {
  const config = STATUS_CONFIG[step.status];
  const Icon = config.icon;

  return (
    <li
      className={`flex items-start gap-3 p-2 rounded-md ${isCurrentStep ? 'bg-gray-100 dark:bg-gray-800' : ''}`}
      aria-current={isCurrentStep ? 'step' : undefined}
    >
      <Icon
        className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color} ${step.status === 'in_progress' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.description}</p>
        {step.result && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{step.result}</p>
        )}
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${config.badgeColor}`}>
        {config.label}
      </span>
    </li>
  );
}

export function PlanProgress({
  plan,
  isLoading = false,
  className = ''
}: PlanProgressProps): React.ReactElement | null {
  if (!plan && !isLoading) return null;

  const completedSteps = plan?.steps.filter(s => s.status === 'completed').length ?? 0;
  const totalSteps = plan?.steps.length ?? 0;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  const planStatusColor = plan ? (PLAN_STATUS_COLORS[plan.status] || 'bg-gray-100 text-gray-700') : '';

  return (
    <div className={`w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 ${className}`}>
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Execution Plan</h3>
          {plan && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${planStatusColor}`}>
              {plan.status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" aria-label="Loading plan" />
          </div>
        ) : plan ? (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{plan.goal}</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Plan progress"
              />
            </div>
            <ol className="space-y-1" aria-label="Plan steps">
              {plan.steps.map((step, index) => (
                <StepItem
                  key={step.step_number}
                  step={step}
                  isCurrentStep={index === plan.current_step_index}
                />
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </div>
  );
}
