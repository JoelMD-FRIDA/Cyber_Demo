"use client";

import { WizardProvider, useWizard } from "@/components/domain-check/wizard-context";
import { DomainCheckStepIndicator } from "@/components/domain-check/domain-check-step-indicator";
import Step1UrlInput from "@/components/domain-check/step1-url-input";
import Step2Results from "@/components/domain-check/step2-results";
import Step3Report from "@/components/domain-check/step3-report";

function WizardStepIndicator() {
  const { state } = useWizard();

  switch (state.step) {
    case 0:
      return null;
    case 1:
    case 2:
    case 3:
      return <DomainCheckStepIndicator currentStep={state.step} />;
  }
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
          <WizardStepIndicator />
          <WizardContent />
        </div>
      </WizardProvider>
    </div>
  );
}
