"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Trash2Icon, AlertCircleIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { ApiCredentialsForm } from "./api-credentials-form";

interface ApiCredential {
  id: string;
  apiUrl: string;
  oauthUrl: string | null;
  username: string | null;
  createdAt: string;
}

interface ApiCredentialsListProps {
  credentials: ApiCredential[];
  onDelete: (id: string) => void;
  onSuccess: () => void;
}

export function ApiCredentialsList({
  credentials,
  onDelete,
  onSuccess,
}: ApiCredentialsListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const credentialToDelete = deleteId
    ? credentials.find((c) => c.id === deleteId)
    : null;

  async function handleTestConnection(credentialId: string) {
    setTestingId(credentialId);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/api-credentials/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: credentialId }),
      });
      const data = await res.json();
      setTestResult({ id: credentialId, success: data.success, message: data.message });
    } catch {
      setTestResult({ id: credentialId, success: false, message: "Connection test failed" });
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/admin/api-credentials/${deleteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete credential");
      }

      setDeleteId(null);
      onDelete(deleteId);
    } finally {
      setDeleting(false);
    }
  }

  function getStatusBadge(credential: ApiCredential) {
    const isConfigured = credential.apiUrl && (credential.username || credential.oauthUrl);
    return isConfigured ? (
      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">Configured</Badge>
    ) : (
      <Badge variant="outline" className="text-amber-600 border-amber-600">
        <AlertCircleIcon className="size-3 mr-0.5" />
        Missing
      </Badge>
    );
  }

  return (
    <>
      <div className="mx-admin-table-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>API URL</TableHead>
              <TableHead>OAuth URL</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {credentials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  No API credentials configured yet.
                </TableCell>
              </TableRow>
            ) : (
              credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell className="max-w-[200px] truncate font-medium">
                    {credential.apiUrl}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">
                    {credential.oauthUrl || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {credential.username || "—"}
                  </TableCell>
                  <TableCell>{getStatusBadge(credential)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(credential.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleTestConnection(credential.id)}
                        disabled={testingId === credential.id}
                        title="Test connection"
                      >
                        {testingId === credential.id ? (
                          <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                          <CheckCircle2Icon className="size-4" />
                        )}
                      </Button>
                      {testResult && testResult.id === credential.id && (
                        <span
                          className={`text-xs ${
                            testResult.success
                              ? "text-emerald-600"
                              : "text-destructive"
                          }`}
                        >
                          {testResult.success ? "OK" : "Fail"}
                        </span>
                      )}
                      <ApiCredentialsForm
                        credential={credential}
                        onSuccess={onSuccess}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteId(credential.id)}
                      >
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="mx-admin-dialog">
          <DialogHeader>
            <DialogTitle>Delete Credential</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the API credential for{" "}
              <strong>{credentialToDelete?.apiUrl}</strong>? This action cannot be undone.
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
    </>
  );
}
