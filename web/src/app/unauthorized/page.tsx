import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="frida-auth-shell">
      <div className="frida-auth-card p-8 text-center">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-[var(--stitch-card-radius)] bg-[var(--stitch-secondary-container)] text-[var(--stitch-primary)]">
          <ShieldAlertIcon className="size-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--frida-header-text)]">
          403 — Unauthorized
        </h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          You do not have the required permissions to access this page.
          If you believe this is an error, please contact your administrator.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-[var(--stitch-control-radius)] bg-[var(--stitch-primary)] px-4 text-sm font-semibold text-white shadow-[var(--stitch-shadow-card)] transition-colors hover:bg-[var(--stitch-on-secondary-fixed-variant)]"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
