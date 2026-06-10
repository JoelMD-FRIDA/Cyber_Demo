"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { PgpList, PgpCertificate } from "@/components/admin/pgp-list";
import { PgpImportDialog } from "@/components/admin/pgp-import-dialog";
import { IntegrationStatusCard } from "@/components/admin/integration-status-card";
import type { IntegrationEntry, IntegrationsStatusResponse } from "@/app/api/admin/integrations/status/route";

export default function PgpCertificatesPage() {
  const [certificates, setCertificates] = useState<PgpCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pgpStatus, setPgpStatus] = useState<IntegrationEntry | null>(null);
  const [statusError, setStatusError] = useState("");

  const fetchCertificates = useCallback(async () => {
    try {
      setError("");
      const res = await fetch("/api/admin/pgp-certificates");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load certificates");
        return;
      }

      setCertificates(data.certificates);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPgpStatus = useCallback(async () => {
    try {
      setStatusError("");
      const res = await fetch("/api/admin/integrations/status");
      if (!res.ok) throw new Error("Failed to load PGP configuration status.");
      const data: IntegrationsStatusResponse = await res.json();
      setPgpStatus(data.integrations.find((integration) => integration.id === "pgp") ?? null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Failed to load PGP configuration status.");
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
    fetchPgpStatus();
  }, [fetchCertificates, fetchPgpStatus]);

  function handleRefresh() {
    setLoading(true);
    fetchCertificates();
  }

  return (
    <div className="mx-admin-page mx-admin-page--wide space-y-6">
      <div className="mx-admin-pageheader">
        <div>
          <h1>
            PGP Certificates
          </h1>
          <p>
            Manage PGP public and private keys used for encryption and signing.
          </p>
        </div>
        <PgpImportDialog onImported={handleRefresh} />
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
        </div>
      )}

      {statusError && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {statusError}
        </div>
      )}

      {pgpStatus && <IntegrationStatusCard entry={pgpStatus} />}

      <Card>
        <CardHeader>
          <CardTitle>Certificates</CardTitle>
          <CardDescription>
            {certificates.length} certificate{certificates.length !== 1 ? "s" : ""}{" "}
            registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PgpList
            certificates={certificates}
            loading={loading}
            onDeleted={handleRefresh}
          />
        </CardContent>
      </Card>
    </div>
  );
}
