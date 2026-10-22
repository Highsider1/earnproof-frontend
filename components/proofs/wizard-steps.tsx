"use client";

/**
 * Generic multi-step wizard progress nav. Originally hardcoded to
 * recurring-income's step enum; parameterized over `stepOrder`/`stepLabels`
 * so the aggregate-earnings and income-range wizards can reuse the same
 * component instead of each duplicating it.
 */
export function WizardSteps<Step extends string>({
  stepOrder,
  stepLabels,
  currentStep,
  onStepChange,
  canProceedToStep,
}: {
  stepOrder: Step[];
  stepLabels: Record<Step, string>;
  currentStep: Step;
  onStepChange: (step: Step) => void;
  canProceedToStep: (step: Step) => boolean;
}) {
  const currentStepIndex = stepOrder.indexOf(currentStep);

  const getStepStatus = (stepIndex: number): "completed" | "current" | "upcoming" | "disabled" => {
    if (stepIndex < currentStepIndex) {
      return "completed";
    } else if (stepIndex === currentStepIndex) {
      return "current";
    } else if (stepIndex === currentStepIndex + 1 && canProceedToStep(currentStep)) {
      return "upcoming";
    } else {
      return "disabled";
    }
  };

  const getStepStyles = (status: ReturnType<typeof getStepStatus>) => {
    switch (status) {
      case "completed":
        return {
          button: "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer",
          connector: "bg-emerald-600",
        };
      case "current":
        return {
          button: "bg-cyan-300 text-slate-950 cursor-default",
          connector: "bg-slate-600",
        };
      case "upcoming":
        return {
          button: "bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer",
          connector: "bg-slate-600",
        };
      case "disabled":
        return {
          button: "bg-slate-800 text-slate-400 cursor-not-allowed",
          connector: "bg-slate-600",
        };
    }
  };

  const canNavigateToStep = (targetStep: Step, targetIndex: number): boolean => {
    // Can always go back to completed steps
    if (targetIndex < currentStepIndex) {
      return true;
    }

    // Can go forward one step if current step allows it
    if (targetIndex === currentStepIndex + 1 && canProceedToStep(currentStep)) {
      return true;
    }

    return false;
  };

  return (
    <nav className="rounded-lg border border-white/10 bg-white/[0.04] p-5" aria-label="Progress">
      <ol className="flex items-center justify-between">
        {stepOrder.map((step, index) => {
          const status = getStepStatus(index);
          const styles = getStepStyles(status);
          const canNavigate = canNavigateToStep(step, index);
          const isLast = index === stepOrder.length - 1;

          return (
            <li key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <button
                  onClick={() => canNavigate ? onStepChange(step) : undefined}
                  disabled={!canNavigate}
                  className={`
                    flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition
                    ${styles.button}
                  `}
                  aria-current={status === "current" ? "step" : undefined}
                >
                  {status === "completed" ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
                <span className={`
                  mt-2 text-xs font-medium text-center max-w-24
                  ${status === "current" ? "text-white" : status === "completed" ? "text-emerald-200" : "text-slate-400"}
                `}>
                  {stepLabels[step]}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-4 h-0.5 bg-slate-600">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === "completed" ? "bg-emerald-600 w-full" : "bg-slate-600 w-0"
                    }`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex justify-between">
        <button
          onClick={() => {
            const prevIndex = Math.max(0, currentStepIndex - 1);
            if (prevIndex < currentStepIndex) {
              onStepChange(stepOrder[prevIndex]);
            }
          }}
          disabled={currentStepIndex === 0}
          className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/5 transition"
        >
          Previous
        </button>

        <button
          onClick={() => {
            const nextIndex = Math.min(stepOrder.length - 1, currentStepIndex + 1);
            if (nextIndex > currentStepIndex && canProceedToStep(currentStep)) {
              onStepChange(stepOrder[nextIndex]);
            }
          }}
          disabled={currentStepIndex === stepOrder.length - 1 || !canProceedToStep(currentStep)}
          className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-200 transition"
        >
          {currentStepIndex === stepOrder.length - 1 ? "Complete" : "Next"}
        </button>
      </div>
    </nav>
  );
}
