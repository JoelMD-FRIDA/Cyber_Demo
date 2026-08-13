"use client";

import { WizardProvider } from "@/components/domain-check/wizard-context";
import DomainCheckForm from "@/components/domain-check/domain-check-form";
import { useI18n } from "@/lib/i18n";

function DomainCheckContent() {
  const { t } = useI18n();
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-6"><div className="text-center"><h1 className="text-3xl font-bold tracking-tight">{t("domain.title")}</h1><p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">{t("domain.subtitle")}</p></div><DomainCheckForm /></div>;
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
