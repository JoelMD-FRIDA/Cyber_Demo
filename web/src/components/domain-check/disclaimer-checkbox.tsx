"use client";

import Link from "next/link";
import type { Dispatch } from "react";

export const DISCLAIMER_VERSION = "1.0.0";

interface DisclaimerCheckboxProps {
  accepted: boolean;
  onAcceptChange: Dispatch<boolean>;
}

export function DisclaimerCheckbox({
  accepted,
  onAcceptChange,
}: DisclaimerCheckboxProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--frida-radius-default)] border border-[var(--frida-input-border)] bg-[var(--frida-app-background)] p-4 shadow-none">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onAcceptChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--frida-primary)]"
      />
      <span className="select-none text-xs leading-relaxed text-[var(--muted-foreground)]">
        Ich habe die{" "}
        <Link
          href="/datenschutz"
          className="underline underline-offset-2 transition-colors hover:text-[var(--frida-header-text)]"
        >
          Datenschutzhinweise
        </Link>{" "}
        zur Kenntnis genommen und erkläre mich mit der Verarbeitung meiner
        Daten zur Durchführung des Domain-Checks einverstanden. Die im Rahmen
        des Scans verarbeiteten Daten und Ergebnisse werden nicht gespeichert
        und nicht an Dritte weitergegeben.
      </span>
    </label>
  );
}
