"use client";

import { WizardProvider, useWizard } from "@/components/domain-check/wizard-context";
import Step1UrlInput from "@/components/domain-check/step1-url-input";
import Step2Results from "@/components/domain-check/step2-results";
import Step3Report from "@/components/domain-check/step3-report";
import { cn } from "@/lib/utils";
import { CheckIcon, GlobeIcon, BarChart3Icon, FileTextIcon } from "lucide-react";

const steps = [
  { step: 1, label: "Domain", icon: GlobeIcon },
  { step: 2, label: "Results", icon: BarChart3Icon },
  { step: 3, label: "Report", icon: FileTextIcon },
];

function StepIndicator() {
  const { state } = useWizard();
  const currentStep = state.step;

  return (
    <nav aria-label="Wizard progress" className="mx-auto w-full max-w-3xl">
      <ol className="flex items-center justify-center gap-0 rounded-[var(--frida-card-transparent-radius)] border border-[var(--frida-transparent-card-border-color)] bg-[var(--frida-surface)] px-4 py-3 text-[var(--frida-header-text)] shadow-none sm:gap-2 sm:px-6">
        {steps.map((s, index) => {
          const isActive = currentStep === s.step;
          const isCompleted = currentStep > s.step;
          const isLast = index === steps.length - 1;
          const Icon = s.icon;

          return (
            <li key={s.step} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors sm:size-9",
                    isActive &&
                      "border-[var(--frida-primary)] bg-[var(--frida-primary)] text-white ring-4 ring-[var(--frida-primary)]/15",
                    isCompleted &&
                      "border-[var(--frida-primary)] bg-[var(--frida-primary)] text-white",
                    !isActive &&
                      !isCompleted &&
                      "border-[var(--frida-border-default)] bg-[var(--frida-surface)] text-[var(--frida-dark-gray)]",
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "hidden text-sm font-semibold sm:inline",
                    isActive && "text-[var(--frida-header-text)]",
                    isCompleted && "text-[var(--frida-primary)]",
                    !isActive && !isCompleted && "text-[var(--frida-dark-gray)]",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "mx-1 h-px w-8 sm:mx-2 sm:w-12",
                    isCompleted
                      ? "bg-[var(--frida-primary)]"
                      : "bg-[var(--frida-border-default)]",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function WizardContent() {
  const { state } = useWizard();

  return (
    <>
      {state.step === 1 && <Step1UrlInput />}
      {state.step === 2 && <Step2Results />}
      {state.step === 3 && <Step3Report />}
    </>
  );
}

export default function DomainCheckPage() {
  return (
    <div className="min-h-[calc(100vh-var(--frida-topbar-height))] bg-[var(--frida-app-background)] px-4 py-6 sm:px-6 lg:px-8">
      <WizardProvider>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <StepIndicator />
          <WizardContent />
        </div>
      </WizardProvider>
    </div>
  );
}
