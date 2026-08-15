"use client";

import { BarChart3, Check, FileText, Globe2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type DomainCheckStep = 1 | 2 | 3;

const steps = [
  { number: 1, label: "domain.stepDomain", Icon: Globe2 },
  { number: 2, label: "domain.stepResults", Icon: BarChart3 },
  { number: 3, label: "domain.stepReport", Icon: FileText },
] as const;

export function DomainCheckStepper({ currentStep }: { currentStep: DomainCheckStep }) {
  const { t } = useI18n();

  return (
    <nav aria-label={t("domain.steps")}>
      <ol className="flex w-full items-center rounded-[var(--stitch-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-surface)] px-3 py-3 shadow-[var(--stitch-shadow-card)] sm:px-5">
        {steps.map(({ number, label, Icon }, index) => {
          const isCurrent = number === currentStep;
          const isComplete = number < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li key={label} className={cn("flex min-w-0 items-center", !isLast && "flex-1")}>
              <div
                className={cn(
                  "flex min-w-0 items-center gap-2 text-xs font-semibold transition-colors sm:text-sm",
                  isCurrent || isComplete ? "text-[var(--stitch-primary)]" : "text-muted-foreground",
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full border sm:size-9",
                    isCurrent && "border-[var(--stitch-primary)] bg-[var(--stitch-primary)] text-white",
                    isComplete && "border-[var(--stitch-secondary-container)] bg-[var(--stitch-secondary-container)] text-[var(--stitch-primary)]",
                    !isCurrent && !isComplete && "border-[var(--frida-border-default)] bg-[var(--frida-app-background)]",
                  )}
                >
                  {isComplete ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                </span>
                <span className="truncate sm:inline">{t(label)}</span>
              </div>
              {!isLast && <span className={cn("mx-2 h-px min-w-3 flex-1 sm:mx-4", number < currentStep ? "bg-[var(--stitch-primary)]" : "bg-[var(--frida-border-default)]")} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
