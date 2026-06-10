"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DownloadIcon, FileIcon } from "lucide-react";

interface PgpExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificateId: string;
  certificateType: string;
}

export function PgpExportDialog({
  open,
  onOpenChange,
  certificateId,
  certificateType,
}: PgpExportDialogProps) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpenChange(newOpen: boolean) {
    onOpenChange(newOpen);
    if (newOpen) {
      await loadCertificateInfo();
    }
    if (!newOpen) {
      setDownloadUrl(null);
      setFileName(null);
    }
  }

  async function loadCertificateInfo() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/pgp-certificates/${certificateId}`,
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load certificate");
        return;
      }

      if (data.certificate.downloadUrl) {
        setDownloadUrl(data.certificate.downloadUrl);
        setFileName(
          data.certificate.certificateFileName ?? `pgp-${certificateType}-key.asc`,
        );
      } else {
        setError("Certificate file not found in storage");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="mx-admin-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Export {certificateType === "private" ? "Private" : "Public"} Key
          </DialogTitle>
          <DialogDescription>
            Download the certificate key file. The file contains the armored key data.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && (
            <div className="mx-admin-alert mx-admin-alert--error">
              {error}
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {downloadUrl && (
            <div className="mx-admin-empty-state flex-col gap-4 px-6 py-8">
              <FileIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  Armored {certificateType} key file
                </p>
              </div>
              <a
                href={downloadUrl}
                download={fileName ?? undefined}
                className="inline-flex items-center gap-2 rounded-[var(--frida-radius-default)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
              >
                <DownloadIcon className="size-4" />
                Download Key File
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
