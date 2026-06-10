"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PgpExportDialog } from "@/components/admin/pgp-export-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DownloadIcon,
  Trash2Icon,
  ShieldIcon,
  ShieldHalfIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from "lucide-react";

export interface PgpCertificate {
  id: string;
  certificateType: "public" | "private";
  reference: string | null;
  emailAddress: string | null;
  createdAt: string;
  hasCertificateFile: boolean;
  certificateFileName: string | null;
  fileDocumentId: string | null;
}

interface PgpListProps {
  certificates: PgpCertificate[];
  loading: boolean;
  onDeleted: () => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateFingerprint(fp: string | null) {
  if (!fp) return "—";
  if (fp.length <= 16) return fp;
  return `${fp.slice(0, 8)}...${fp.slice(-8)}`;
}

export function PgpList({ certificates, loading, onDeleted }: PgpListProps) {
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportType] = useState<string>("public");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/pgp-certificates/${deleteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setDeleteId(null);
        onDeleted();
      }
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-admin-table-card space-y-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (certificates.length === 0) {
    return (
      <div className="mx-admin-empty-state flex-col">
        <ShieldIcon className="mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">
          No PGP certificates
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Import a certificate to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mx-admin-table-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Fingerprint</TableHead>
              <TableHead>Certificate File</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.map((cert) => (
              <TableRow key={cert.id}>
                <TableCell>
                  {cert.certificateType === "private" ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldHalfIcon className="size-3" />
                      Private
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <ShieldIcon className="size-3" />
                      Public
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {cert.emailAddress || (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {truncateFingerprint(cert.reference)}
                  </code>
                </TableCell>
                <TableCell>
                  {cert.hasCertificateFile ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-emerald-500/30 text-emerald-600"
                    >
                      <CheckCircle2Icon className="size-3" />
                      Stored
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="gap-1 border-amber-500/30 text-amber-600"
                    >
                      <AlertTriangleIcon className="size-3" />
                      Missing
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(cert.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {cert.hasCertificateFile && cert.fileDocumentId && (
                      <a
                        href={`/api/files/${cert.fileDocumentId}`}
                        download={cert.certificateFileName ?? "pgp-certificate.asc"}
                        className="inline-flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <DownloadIcon className="size-4" />
                        <span className="sr-only">Download</span>
                      </a>
                    )}

                    <Dialog
                      open={deleteId === cert.id}
                      onOpenChange={(open) => {
                        if (!open) setDeleteId(null);
                      }}
                    >
                      <DialogTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(cert.id)}
                          >
                            <Trash2Icon className="size-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        }
                      />
                      <DialogContent className="mx-admin-dialog">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <AlertTriangleIcon className="size-4 text-destructive" />
                            Delete Certificate
                          </DialogTitle>
                          <DialogDescription>
                            Are you sure you want to delete this PGP certificate?
                            The key file will also be permanently removed.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter showCloseButton>
                          <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                          >
                            {deleting ? "Deleting..." : "Delete"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {exportId && (
        <PgpExportDialog
          open={!!exportId}
          onOpenChange={(open) => {
            if (!open) setExportId(null);
          }}
          certificateId={exportId}
          certificateType={exportType}
        />
      )}
    </>
  );
}
