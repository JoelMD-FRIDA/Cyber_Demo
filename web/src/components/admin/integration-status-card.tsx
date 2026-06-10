"use client";

import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { IntegrationEntry, IntegrationStatus } from "@/app/api/admin/integrations/status/route";

const STATUS_CONFIG: Record<IntegrationStatus, { label: string; icon: LucideIcon; className: string }> = {
  configured: {
    label: "Configured",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-600",
  },
  fixture: {
    label: "Fixture Only",
    icon: FlaskConical,
    className: "border-amber-200 bg-amber-50 text-amber-600",
  },
  missing: {
    label: "Missing",
    icon: AlertCircle,
    className: "border-red-200 bg-red-50 text-red-600",
  },
  "human-gated": {
    label: "Human‑Gated",
    icon: Lock,
    className: "border-blue-200 bg-blue-50 text-blue-600",
  },
};

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;

  return (
    <Badge variant="outline" className={`gap-1.5 px-3 py-1 text-xs font-medium ${cfg.className}`}>
      <Icon className="size-3.5" />
      {cfg.label}
    </Badge>
  );
}

function EnvVarBadge({ value }: { value: "set" | "unset" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        value === "set"
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-gray-100 text-gray-500 ring-1 ring-gray-200"
      }`}
    >
      <span className={`size-1.5 rounded-full ${value === "set" ? "bg-emerald-500" : "bg-gray-300"}`} />
      {value === "set" ? "Set" : "Unset"}
    </span>
  );
}

export function IntegrationStatusCard({ entry }: { entry: IntegrationEntry }) {
  const envEntries = Object.entries(entry.envVars);

  return (
    <Card className="border-[var(--stitch-outline-variant)] shadow-[var(--stitch-shadow-card)]">
      <CardHeader className="border-b border-[var(--frida-border-default)]/70 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--frida-primary)_9%,white),white)] pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base text-[var(--frida-header-text)]">{entry.name}</CardTitle>
            <CardDescription>{entry.description}</CardDescription>
          </div>
          <StatusBadge status={entry.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {envEntries.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Environment Variables
            </p>
            <div className="flex flex-wrap gap-1.5">
              {envEntries.map(([name, value]) => (
                <code key={name} className="flex items-center gap-1.5 rounded-[var(--frida-radius-default)] border border-[var(--frida-input-border)] bg-white px-2 py-1 font-mono text-[11px] shadow-[var(--frida-input-shadow)]">
                  <span className="text-muted-foreground">{name}</span>
                  <EnvVarBadge value={value} />
                </code>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Guidance
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
            {entry.guidance}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
