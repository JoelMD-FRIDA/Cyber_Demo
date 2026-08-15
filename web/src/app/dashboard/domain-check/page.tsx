"use client";

import { WizardProvider } from "@/components/domain-check/wizard-context";
import DomainCheckForm from "@/components/domain-check/domain-check-form";
import { DomainCheckStepper } from "@/components/domain-check/domain-check-stepper";

function DomainCheckContent() {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5"><DomainCheckStepper currentStep={1} /><DomainCheckForm /></div>;
}

export default function DomainCheckPage() {
  return (
    <div className="frida-content-page">
      <WizardProvider>
        <DomainCheckContent />
      </WizardProvider>
    </div>
  );
}
