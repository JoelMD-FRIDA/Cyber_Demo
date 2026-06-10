"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KeyIcon, UploadIcon, FileIcon, XIcon } from "lucide-react";

interface PgpImportDialogProps {
  onImported: () => void;
}

export function PgpImportDialog({ onImported }: PgpImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [emailAddress, setEmailAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError("");
    }
  }

  function handleClearFile() {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a PGP key file to import");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (emailAddress) {
        formData.append("emailAddress", emailAddress);
      }

      const res = await fetch("/api/admin/pgp-certificates", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to import certificate");
        return;
      }

      setFile(null);
      setEmailAddress("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setOpen(false);
      onImported();
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="default">
        <KeyIcon className="size-4" />
        Import Certificate
      </Button>} />
      <DialogContent className="mx-admin-dialog sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import PGP Certificate</DialogTitle>
          <DialogDescription>
            Upload an armored PGP key file (.asc, .pgp, .gpg). The key data will
            be stored securely in the database.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            {error && (
               <div className="mx-admin-alert mx-admin-alert--error">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="mx-admin-form-label">
                PGP Key File *
              </label>
              {file ? (
                <div className="flex items-center gap-2 rounded-[var(--frida-radius-default)] border border-input bg-muted/50 px-3 py-2">
                  <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mx-admin-dropzone flex cursor-pointer flex-col items-center gap-2 px-4 py-8 text-center transition-colors"
                >
                  <UploadIcon className="size-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-muted-foreground">
                    Click to upload a PGP key file
                  </p>
                  <p className="text-xs text-muted-foreground/60">
                    .asc, .pgp, or .gpg files
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="pgp-file"
                type="file"
                accept=".asc,.pgp,.gpg,.key,text/plain,application/pgp-keys"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                  className="mx-admin-form-label"
              >
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. If omitted, the email from the key&apos;s user ID will
                be used.
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={loading || !file}>
              {loading ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
