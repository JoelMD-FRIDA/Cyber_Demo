"use client"

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  UploadIcon,
  DownloadIcon,
  FileIcon,
  CheckCircle2Icon,
  XCircleIcon,
  AlertTriangleIcon,
  Loader2Icon,
} from "lucide-react";

type ImportReport = {
  imported: number;
  updated: number;
  errors: { row: number; reason: string }[];
  skipped: number;
  providersImported: number;
  providersUpdated: number;
  categoriesImported: number;
  categoriesUpdated: number;
  importJobId?: string;
  fileDocumentId?: string;
};

type ImportStatus = "idle" | "uploading" | "processing" | "done" | "error";

export default function AdminMasterData() {
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/master-data/export");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `master-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    if (!selectedFile) return;

    setImportStatus("uploading");
    setReport(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/master-data/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Import failed.");
      }

      setReport(data);
      setImportStatus("done");
      setSelectedFile(null);
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Import failed.");
      setImportStatus("error");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setReport(null);
    setErrorMessage(null);
    setImportStatus("idle");
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (file) {
      setSelectedFile(file);
      setReport(null);
      setErrorMessage(null);
      setImportStatus("idle");
    }
  }

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Master Data</h1>
          <p>
            Import or export provider and category master data.
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? (
            <Loader2Icon className="mr-1.5 size-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-1.5 size-4" />
          )}
          Export Master Data
        </Button>
      </div>

      {errorMessage && (
        <div className="mx-admin-alert mx-admin-alert--error">
          <div className="flex items-center gap-2">
            <XCircleIcon className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {report && (
        <div className="mx-admin-card mx-admin-card-spacious mb-6 text-sm">
          <div className="mb-3 flex items-center gap-2">
            {report.errors.length > 0 ? (
              <AlertTriangleIcon className="size-5 text-amber-500" />
            ) : (
              <CheckCircle2Icon className="size-5 text-emerald-500" />
            )}
            <h2 className="font-semibold">
              {report.errors.length > 0
                ? "Import completed with errors"
                : "Import completed successfully"}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[var(--frida-radius-default)] border bg-muted/30 p-2.5 text-center">
              <div className="text-lg font-bold text-emerald-600">{report.imported}</div>
              <div className="text-xs text-muted-foreground">Imported</div>
            </div>
            <div className="rounded-[var(--frida-radius-default)] border bg-muted/30 p-2.5 text-center">
              <div className="text-lg font-bold text-blue-600">{report.updated}</div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
            <div className="rounded-[var(--frida-radius-default)] border bg-muted/30 p-2.5 text-center">
              <div className="text-lg font-bold text-amber-600">{report.skipped}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
            <div className="rounded-[var(--frida-radius-default)] border bg-muted/30 p-2.5 text-center">
              <div className="text-lg font-bold text-muted-foreground">{report.errors.length}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </div>

          {(report.providersImported > 0 || report.providersUpdated > 0) && (
            <div className="mt-3 text-xs text-muted-foreground">
              Providers: {report.providersImported} new, {report.providersUpdated} updated
            </div>
          )}
          {(report.categoriesImported > 0 || report.categoriesUpdated > 0) && (
            <div className="text-xs text-muted-foreground">
              Categories: {report.categoriesImported} new, {report.categoriesUpdated} updated
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-1 text-xs font-medium text-amber-600">Row Errors:</h3>
              <div className="max-h-32 overflow-y-auto rounded-[var(--frida-radius-default)] border bg-muted/20 p-2">
                {report.errors.map((err, idx) => (
                  <div key={idx} className="text-xs leading-relaxed">
                    <span className="font-medium text-muted-foreground">Row {err.row}:</span>{" "}
                    <span className="text-destructive">{err.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div
        className="mx-admin-dropzone flex flex-col items-center justify-center transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {importStatus === "uploading" || importStatus === "processing" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {importStatus === "uploading" ? "Uploading file..." : "Processing data..."}
            </p>
          </div>
        ) : (
          <>
              <div className="mb-4 rounded-full bg-muted p-3">
              <UploadIcon className="size-6 text-muted-foreground" />
            </div>
            <p className="mb-1 text-sm font-medium">
              {selectedFile ? selectedFile.name : "Drop a file here, or click to select"}
            </p>
            <p className="mb-4 text-xs text-muted-foreground">
              Supports JSON and CSV files with provider/category data
            </p>

            {selectedFile && (
              <div className="mb-4 flex items-center gap-2 rounded-[var(--frida-radius-default)] border bg-muted/20 px-3 py-2 text-sm">
                <FileIcon className="size-4 text-muted-foreground" />
                <span className="font-medium">{selectedFile.name}</span>
                <span className="text-muted-foreground">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <Badge variant="outline" className="ml-1 text-xs">
                  {selectedFile.name.endsWith(".csv") ? "CSV" : "JSON"}
                </Badge>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? "Change File" : "Select File"}
              </Button>
              {selectedFile && (
                <Button onClick={handleImport}>
                  <UploadIcon className="mr-1.5 size-4" />
                  Import
                </Button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </>
        )}
      </div>

      <div className="mx-admin-card mt-6 p-4">
        <h3 className="mb-2 text-sm font-medium">Import Format</h3>
        <div className="space-y-3 text-xs text-muted-foreground">
          <div>
            <p className="mb-1 font-medium text-foreground/80">JSON format:</p>
            <pre className="overflow-x-auto rounded-[var(--frida-radius-default)] bg-muted/40 p-2 text-[11px] leading-relaxed">
{`[
  {
    "type": "provider",
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "VirusTotal",
    "isActive": true,
    "websiteUrl": "https://virustotal.com",
    "description": "Description text",
    "shortDescription": "Short description",
    "longDescription": "Long description",
    "apiBaseUrl": "https://api.virustotal.com/v3"
  },
  {
    "type": "category",
    "uuid": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Malware Analysis",
    "description": "Category description"
  }
]`}
            </pre>
          </div>
          <div>
            <p className="mb-1 font-medium text-foreground/80">CSV format:</p>
            <pre className="overflow-x-auto rounded-[var(--frida-radius-default)] bg-muted/40 p-2 text-[11px] leading-relaxed">
{`type,uuid,name,isActive,websiteUrl,description
provider,550e8400-...,VirusTotal,true,https://virustotal.com,Description text
category,660e8400-...,Malware Analysis,,Category description`}
            </pre>
          </div>
          <p>
            Rows without a <code className="rounded bg-muted/40 px-1 py-0.5 font-mono">uuid</code> will be assigned one automatically.
            Duplicate UUIDs trigger an update (upsert). The <code className="rounded bg-muted/40 px-1 py-0.5 font-mono">type</code> field must be
            &quot;provider&quot; or &quot;category&quot;. File size limit: 10 MB.
          </p>
        </div>
      </div>
    </div>
  );
}
