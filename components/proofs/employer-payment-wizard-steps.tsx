"use client";

import { WIZARD_STEPS, STEP_LABELS, type WizardStep } from "@/lib/validation/employer-payment-proofs";

const STEP_ORDER: WizardStep[] = [
  WIZARD_STEPS.PERIOD_CONFIG,
  WIZARD_STEPS.SOURCE_SELECTION,
  WIZARD_STEPS.CONFIRMATION,
];

/**
 * Step navigation for the employer-payment proof wizard. Mirrors the
 * pattern in `components/proofs/wizard-steps.tsx` (used by the recurring
 * income wizard), but is scoped to this wizard's own step set rather than
 * sharing that component directly, since `WizardSteps` is hardcoded to
 * `lib/validation/recurring-income-proofs`'s step constants.
 */
export function EmployerPaymentWizardSteps({
  currentStep,
  onStepChange,
  canProceedToStep,
}: {
  currentStep: WizardStep;
  onStepChange: (step: WizardStep) => void;
  canProceedToStep: (step: WizardStep) => boolean;
}) {
  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  const getStepStatus = (stepIndex: number): "completed" | "current" | "upcoming" | "disabled" => {
    if (stepIndex < currentStepIndex) return "completed";
    if (stepIndex === currentStepIndex) return "current";
    if (stepIndex === currentStepIndex + 1 && canProceedToStep(currentStep)) return "upcoming";
    return "disabled";
  };

  const getStepStyles = (status: ReturnType<typeof getStepStatus>) => {
    switch (status) {
      case "completed":
        return { button: "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer" };
      case "current":
        return { button: "bg-cyan-300 text-slate-950 cursor-default" };
      case "upcoming":
        return { button: "bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer" };
      case "disabled":
        return { button: "bg-slate-800 text-slate-400 cursor-not-allowed" };
    }
  };

  const canNavigateToStep = (targetIndex: number): boolean => {
    if (targetIndex < currentStepIndex) return true;
    if (targetIndex === currentStepIndex + 1 && canProceedToStep(currentStep)) return true;
    return false;
  };

  return (
    <nav aria-label="Progress" className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <ol className="flex items-center justify-between">
        {STEP_ORDER.map((step, index) => {
          const status = getStepStatus(index);
          const styles = getStepStyles(status);
          const canNavigate = canNavigateToStep(index);
          const isLast = index === STEP_ORDER.length - 1;

          return (
            <li className="flex flex-1 items-center" key={step}>
              <div className="flex flex-col items-center">
                <button
                  aria-current={status === "current" ? "step" : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition ${styles.button}`}
                  disabled={!canNavigate}
                  onClick={() => (canNavigate ? onStepChange(step) : undefined)}
                  type="button"
                >
                  {status === "completed" ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>
                <span
                  className={`mt-2 max-w-24 text-center text-xs font-medium ${
                    status === "current" ? "text-white" : status === "completed" ? "text-emerald-200" : "text-slate-400"
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {!isLast && (
                <div className="mx-4 h-0.5 flex-1 bg-slate-600">
                  <div
                    className={`h-full transition-all duration-300 ${
                      status === "completed" ? "w-full bg-emerald-600" : "w-0 bg-slate-600"
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
          className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentStepIndex === 0}
          onClick={() => {
            const prevIndex = Math.max(0, currentStepIndex - 1);
            if (prevIndex < currentStepIndex) onStepChange(STEP_ORDER[prevIndex]);
          }}
          type="button"
        >
          Previous
        </button>
        <button
          className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={currentStepIndex === STEP_ORDER.length - 1 || !canProceedToStep(currentStep)}
          onClick={() => {
            const nextIndex = Math.min(STEP_ORDER.length - 1, currentStepIndex + 1);
            if (nextIndex > currentStepIndex && canProceedToStep(currentStep)) onStepChange(STEP_ORDER[nextIndex]);
          }}
          type="button"
        >
          {currentStepIndex === STEP_ORDER.length - 1 ? "Complete" : "Next"}
        </button>
      </div>
    </nav>
  );
}
