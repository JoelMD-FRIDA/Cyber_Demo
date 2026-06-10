"use client"

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersIcon, Building2Icon, FolderTreeIcon, ShieldCheckIcon, ActivityIcon } from "lucide-react";

type Stats = {
  totalUsers: number;
  totalProviders: number;
  totalCategories: number;
  totalChecks: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);

        const [usersRes, providersRes, categoriesRes] = await Promise.all([
          fetch("/api/admin/users?limit=1"),
          fetch("/api/providers"),
          fetch("/api/categories"),
        ]);

        if (!usersRes.ok || !providersRes.ok || !categoriesRes.ok) {
          throw new Error("Failed to load dashboard stats.");
        }

        const usersData = await usersRes.json();
        const providersData = await providersRes.json();
        const categoriesData = await categoriesRes.json();

        setStats({
          totalUsers: usersData.total ?? usersData.users?.length ?? 0,
          totalProviders: providersData.providers?.length ?? 0,
          totalCategories: categoriesData.categories?.length ?? 0,
          totalChecks: 0,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const statCards = [
    { label: "Total Users", value: stats?.totalUsers ?? 0, icon: UsersIcon },
    { label: "Providers", value: stats?.totalProviders ?? 0, icon: Building2Icon },
    { label: "Categories", value: stats?.totalCategories ?? 0, icon: FolderTreeIcon },
    { label: "Domain Checks", value: stats?.totalChecks ?? 0, icon: ShieldCheckIcon },
  ];

  return (
    <div className="mx-admin-page">
      <div className="mx-admin-pageheader">
        <div>
        <h1>Admin Dashboard</h1>
        <p>
          FRIDA operations overview for users, provider catalog, categories, and checks.
        </p>
        </div>
      </div>

      {error && (
        <div className="mx-admin-alert mx-admin-alert--error">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-[var(--stitch-card-radius)] border border-[var(--stitch-outline-variant)] bg-[image:var(--frida-gradient-background)] p-5 text-white shadow-[var(--stitch-shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[var(--frida-radius-default)] bg-white/14 text-[var(--frida-logo-accent)]">
            <ActivityIcon className="size-5" />
          </span>
          <div>
            <p className="text-base font-semibold">System status</p>
            <p className="text-sm text-white/75">Core administration areas are ready for configuration.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.label} className="border-[var(--stitch-outline-variant)] bg-[var(--stitch-surface-container-lowest)] shadow-[var(--stitch-shadow-card)] transition-colors hover:border-[var(--stitch-primary)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="flex size-8 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)]/10 text-[var(--frida-primary)]"><card.icon className="size-4" /></span>
                {card.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-3xl font-bold text-[var(--frida-header-text)]">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
