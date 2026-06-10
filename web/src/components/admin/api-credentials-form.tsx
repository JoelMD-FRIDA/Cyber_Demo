"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, PencilIcon } from "lucide-react";

interface ApiCredential {
  id: string;
  apiUrl: string;
  oauthUrl: string | null;
  username: string | null;
  createdAt: string;
}

interface ApiCredentialsFormProps {
  credential?: ApiCredential | null;
  onSuccess: () => void;
  children?: React.ReactNode;
}

export function ApiCredentialsForm({
  credential,
  onSuccess,
  children,
}: ApiCredentialsFormProps) {
  const [open, setOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [oauthUrl, setOauthUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isEdit = !!credential;

  useEffect(() => {
    if (open && credential) {
      setApiUrl(credential.apiUrl || "");
      setOauthUrl(credential.oauthUrl || "");
      setUsername(credential.username || "");
      setPassword("");
      setError("");
    } else if (open) {
      setApiUrl("");
      setOauthUrl("");
      setUsername("");
      setPassword("");
      setError("");
    }
  }, [open, credential]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const url = isEdit
        ? `/api/admin/api-credentials/${credential!.id}`
        : "/api/admin/api-credentials";
      const method = isEdit ? "PUT" : "POST";

      const body: Record<string, unknown> = { apiUrl, oauthUrl, username };
      if (password) {
        body.password = password;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credential");
      }

      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        {children || (
          <Button variant={isEdit ? "ghost" : "default"} size={isEdit ? "icon-sm" : "default"}>
            {isEdit ? <PencilIcon className="size-4" /> : <><PlusIcon className="size-4" /> Add Credential</>}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="mx-admin-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Credential" : "Add Credential"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the API credential details. Leave password blank to keep the existing value."
              : "Enter the details for a new API credential."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="apiUrl" className="mx-admin-form-label">
              API URL <span className="text-destructive">*</span>
            </label>
            <Input
              id="apiUrl"
              type="url"
              placeholder="https://api.example.com"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="oauthUrl" className="mx-admin-form-label">
              OAuth URL
            </label>
            <Input
              id="oauthUrl"
              type="url"
              placeholder="https://auth.example.com"
              value={oauthUrl}
              onChange={(e) => setOauthUrl(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="mx-admin-form-label">
              Username
            </label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="mx-admin-form-label">
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder={isEdit ? "Leave blank to keep existing" : "Enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <DialogFooter showCloseButton>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
