"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserIcon,
  MailIcon,
  ShieldCheckIcon,
  CalendarIcon,
  LogOutIcon,
} from "lucide-react";

type UserProfile = {
  id: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  company: string | null;
  role: string;
  isActivated: boolean;
  performedDomainChecks: number;
  createdAt: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          throw new Error("Failed to load profile.");
        }

        const data = await res.json();
        setUser(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (res.ok) {
        router.push("/login");
      }
    } catch {
    } finally {
      setLoggingOut(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const fullName = user
    ? [user.firstname, user.lastname].filter(Boolean).join(" ") || "User"
    : "User";

  const profileFields = user
    ? [
        { icon: MailIcon, label: "Email", value: user.email },
        { icon: UserIcon, label: "Name", value: fullName },
        ...(user.company
          ? [{ icon: ShieldCheckIcon, label: "Company", value: user.company }]
          : []),
        {
          icon: ShieldCheckIcon,
          label: "Role",
          value: user.role.charAt(0).toUpperCase() + user.role.slice(1),
        },
        {
          icon: CalendarIcon,
          label: "Account Created",
          value: formatDate(user.createdAt),
        },
      ]
    : [];

  return (
    <div className="frida-content-page">
      <div className="frida-pageheader">
        <h1>Profile</h1>
        <p>
          Your account details and settings.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)]/10 text-[var(--frida-primary)]">
              <UserIcon className="size-5" />
            </span>
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </>
          ) : user ? (
            <>
              {profileFields.map((field) => (
                <div
                  key={field.label}
                  className="rounded-[var(--frida-radius-default)] border border-[var(--frida-border-default)] bg-[var(--frida-surface)]/80 p-3 shadow-[var(--frida-input-shadow)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-muted-surface)] text-[var(--frida-gradient-start)]">
                      <field.icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {field.label}
                      </p>
                      <p className="font-medium">{field.value}</p>
                    </div>
                  </div>
                </div>
              ))}

              <hr className="border-border" />

              <Button
                variant="destructive"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOutIcon className="size-4" />
                {loggingOut ? "Logging out..." : "Logout"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
