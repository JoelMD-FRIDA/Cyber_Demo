"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import type { SavedDomainCheck } from "./saved-domain-check-view-model";

export function DomainCheckProgress({
  check,
  title,
  description,
}: {
  check?: SavedDomainCheck | null;
  title: string;
  description: string;
}) {
  const { locale, t } = useI18n();
  const [messageIndex, setMessageIndex] = useState(check?.rawResult ? 2 : 0);
  const messages = [
    t("domain.progressAccepted"),
    t("domain.progressAnalyzing"),
    t("domain.progressReport"),
    t("domain.progressWait"),
  ];
  const progress = check?.rawResult ? 76 : check?.externalJobId ? 48 : 22;

  useEffect(() => {
    const timer = window.setInterval(() => setMessageIndex((current) => (current + 1) % messages.length), 4200);
    return () => window.clearInterval(timer);
  }, [locale, messages.length]);

  return (
    <Card>
      <CardContent className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--stitch-secondary-container)] text-[var(--stitch-primary)]">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
        <div className="space-y-2">
          <div
            className="relative h-2.5 overflow-hidden rounded-full bg-[var(--stitch-secondary-container)]/45"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={messages[messageIndex % messages.length]}
            aria-label={t("domain.progressLabel")}
          >
            <div className="relative h-full rounded-full bg-[var(--stitch-primary)] transition-[width] duration-500" style={{ width: `${progress}%` }}>
              <span className="frida-progress-shine" aria-hidden="true" />
            </div>
          </div>
          <div className="flex items-start justify-between gap-4 text-xs text-muted-foreground">
            <p aria-live="polite">{messages[messageIndex % messages.length]}</p>
            <span className="shrink-0 text-right">{t("domain.progressAuto")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
