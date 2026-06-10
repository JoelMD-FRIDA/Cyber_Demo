"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCwIcon } from "lucide-react";
import { ApiCredentialsForm } from "@/components/admin/api-credentials-form";
import { ApiCredentialsList } from "@/components/admin/api-credentials-list";

interface ApiCredential {
  id: string;
  apiUrl: string;
  oauthUrl: string | null;
  username: string | null;
  createdAt: string;
}

interface CredentialsResponse {
  credentials: ApiCredential[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ApiCredentialsPage() {
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCredentials = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/api-credentials");
      if (!res.ok) {
        throw new Error("Failed to fetch credentials");
      }
      const data: CredentialsResponse = await res.json();
      setCredentials(data.credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  function handleDelete(id: string) {
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="mx-admin-page mx-admin-page--narrow">
      <Card size="sm">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle>API Credentials</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage API credentials for external service integrations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchCredentials} disabled={loading}>
              <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <ApiCredentialsForm onSuccess={fetchCredentials} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchCredentials}>
                Retry
              </Button>
            </div>
          ) : (
            <ApiCredentialsList
              credentials={credentials}
              onDelete={handleDelete}
              onSuccess={fetchCredentials}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
