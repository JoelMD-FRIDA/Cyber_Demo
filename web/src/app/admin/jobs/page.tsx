"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RefreshCwIcon, PlayIcon } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";

type JobEntry = {
  id: string;
  jobId: string | null;
  startTime: string | null;
  endTime: string | null;
  result: string | null;
  successful: boolean;
  createdAt: string;
};

const columns: Column<JobEntry>[] = [
  {
    key: "jobId",
    header: "Job",
    render: (j) => (
      <span className="font-mono text-sm font-medium">{j.jobId ?? "—"}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: (j) => {
      if (j.endTime === null) {
        return (
          <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            Running
          </Badge>
        );
      }
      return j.successful ? (
        <Badge variant="default" className="bg-emerald-600 text-white hover:bg-emerald-600/80 gap-1">
          <span className="size-1.5 rounded-full bg-emerald-300" />
          Success
        </Badge>
      ) : (
        <Badge variant="default" className="bg-destructive text-destructive-foreground gap-1">
          <span className="size-1.5 rounded-full bg-destructive-foreground" />
          Failed
        </Badge>
      );
    },
  },
  {
    key: "createdAt",
    header: "Started",
    render: (j) => {
      if (!j.createdAt) return <span className="text-muted-foreground/50">—</span>;
      const date = new Date(j.createdAt);
      return (
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {date.toLocaleString()}
        </span>
      );
    },
  },
  {
    key: "duration",
    header: "Duration",
    render: (j) => {
      if (!j.startTime || !j.endTime) return <span className="text-muted-foreground/50">—</span>;
      const start = new Date(j.startTime).getTime();
      const end = new Date(j.endTime).getTime();
      const ms = end - start;
      if (ms < 1000) return <span className="text-xs text-muted-foreground">{ms}ms</span>;
      return <span className="text-xs text-muted-foreground">{(ms / 1000).toFixed(1)}s</span>;
    },
  },
  {
    key: "result",
    header: "Result",
    className: "max-w-[300px]",
    render: (j) => {
      if (!j.result) return <span className="text-muted-foreground/50">—</span>;
      const isError = !j.successful && j.endTime !== null;
      const displayText = isError
        ? j.result
        : (() => {
            try {
              const parsed = JSON.parse(j.result);
              return `Processed: ${parsed.processed}, Failed: ${parsed.failed}`;
            } catch {
              return j.result;
            }
          })();
      return (
        <span className={`text-xs font-mono ${isError ? "text-destructive" : "text-muted-foreground"}`}>
          {displayText.length > 80 ? displayText.slice(0, 80) + "..." : displayText}
        </span>
      );
    },
  },
];

export default function ScheduledJobsPage() {
  const [jobs, setJobs] = useState<JobEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/admin/jobs");
      if (!res.ok) throw new Error("Failed to load jobs.");
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleTrigger() {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/admin/jobs/trigger", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTriggerResult(`Email processing completed: ${data.job.result?.processed ?? 0} sent`);
      } else {
        setTriggerResult(`Error: ${data.error || "Trigger failed"}`);
      }
      await fetchJobs();
    } catch (e) {
      setTriggerResult(`Error: ${e instanceof Error ? e.message : "Request failed"}`);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
          <h1>Scheduled Jobs</h1>
          <p>
            View recent scheduled and background job runs. Trigger email processing manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1">Refresh</span>
          </Button>
          <Button size="sm" onClick={handleTrigger} disabled={triggering}>
            <PlayIcon className="size-4" />
            <span className="ml-1">{triggering ? "Processing..." : "Trigger Email Processing"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
          <button className="ml-2 underline hover:no-underline" onClick={fetchJobs}>
            Retry
          </button>
        </div>
      )}

      {triggerResult && (
        <div className={`mx-admin-alert ${
          triggerResult.startsWith("Error")
            ? "mx-admin-alert--error"
            : "mx-admin-alert--success"
        }`}>
          {triggerResult}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job Runs</CardTitle>
          <CardDescription>
            {jobs.length} job run{jobs.length !== 1 ? "s" : ""} recorded
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            data={jobs}
            keyExtractor={(j) => j.id}
            loading={loading}
            emptyMessage="No job runs recorded yet. Trigger email processing to create one."
          />
        </CardContent>
      </Card>
    </div>
  );
}
