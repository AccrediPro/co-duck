'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  const defaultLabels = ['Basic Info', 'Bio & Specialties', 'Pricing', 'Review'];

  const stepLabels = labels || defaultLabels.slice(0, totalSteps);

  return (
    <div className="w-full">
      {/* Progress text */}
      <div className="mb-2 text-center text-sm text-muted-foreground">
        Step {currentStep} of {totalSteps}
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isUpcoming = stepNumber > currentStep;

          return (
            <div key={stepNumber} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors',
                    isCompleted && 'border-gold bg-gold text-white',
                    isCurrent && 'border-burgundy bg-burgundy/10 text-burgundy',
                    isUpcoming && 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : stepNumber}
                </div>
                {/* Step label - hidden on mobile */}
                <span
                  className={cn(
                    'mt-2 hidden text-xs sm:block',
                    isCurrent && 'font-medium text-foreground',
                    !isCurrent && 'text-muted-foreground'
                  )}
                >
                  {stepLabels[index]}
                </span>
              </div>

              {/* Connector line */}
              {stepNumber < totalSteps && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-8 sm:w-16',
                    stepNumber < currentStep ? 'bg-gold' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
