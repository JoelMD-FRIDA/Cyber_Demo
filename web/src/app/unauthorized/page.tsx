"use client";

import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function UnauthorizedPage() {
  const { t } = useI18n();
  return (
    <div className="frida-auth-shell">
      <div className="frida-auth-card p-8 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-[var(--stitch-card-radius)] bg-[var(--stitch-secondary-container)] text-[var(--stitch-primary)]">
          <ShieldAlertIcon className="size-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--frida-header-text)]">
          {t("error.unauthorizedTitle")}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {t("error.unauthorizedDescription")}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-[var(--stitch-control-radius)] bg-[var(--stitch-primary)] px-4 text-sm font-semibold text-white shadow-[var(--stitch-shadow-card)] transition-colors hover:bg-[var(--stitch-on-secondary-fixed-variant)]"
        >
          {t("common.backHome")}
        </Link>
      </div>
    </div>
  );
}
