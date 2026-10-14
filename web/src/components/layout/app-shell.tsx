"use client";
import { apiFetch } from '@/lib/api-client';

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { footerLinks } from "@/config/navigation";
import { useI18n } from "@/lib/i18n";

type UserRole = "anonymous" | "user" | "admin";

type SessionUser = {
  role: UserRole;
  firstname: string | null;
  lastname: string | null;
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    const skipsSessionProbe =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password" ||
      pathname === "/impressum" ||
      pathname === "/datenschutz";

    if (skipsSessionProbe) {
      setSessionUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadSessionUser() {
      setLoading(true);

      try {
        const res = await apiFetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          setSessionUser(null);
          return;
        }

        const data = (await res.json()) as SessionUser;
        setSessionUser(data);
      } catch {
        if (!controller.signal.aborted) {
          setSessionUser(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadSessionUser();

    return () => controller.abort();
  }, [pathname]);

  const userRole: UserRole | null = sessionUser?.role ?? (loading ? null : "anonymous");
  const userName = useMemo(() => {
    if (!sessionUser) return undefined;
    return [sessionUser.firstname, sessionUser.lastname].filter(Boolean).join(" ") || undefined;
  }, [sessionUser]);
  const hasAdminSidebar = userRole === "admin";

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setSessionUser(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <SidebarProvider className="relative isolate min-w-0 bg-[var(--frida-app-bg)]">
      {hasAdminSidebar && <AppSidebar userRole={userRole} />}
      <div className="relative z-0 flex min-h-svh min-w-0 max-w-full flex-1 flex-col overflow-x-clip bg-[var(--frida-app-bg)]">
        <Header
          userRole={userRole}
          userName={userName}
          onLogout={sessionUser ? handleLogout : undefined}
          hasSidebar={hasAdminSidebar}
        />
        <main className="min-w-0 flex-1">{children}</main>
        <footer className="relative z-0 w-full min-w-0 max-w-full overflow-x-clip border-t border-[var(--stitch-outline-variant)] bg-[var(--stitch-surface-container-lowest)] py-[var(--stitch-space-lg)] text-[var(--stitch-on-surface)] md:min-h-[var(--frida-footer-height)]">
          <div className="mx-auto flex w-full min-w-0 max-w-none flex-col items-center gap-[var(--frida-space-medium)] px-[var(--frida-space-medium)] sm:flex-row sm:justify-between sm:px-[var(--frida-space-large)]">
            <div className="flex shrink-0 items-center gap-3">
              <Image
                src="/frida-icon.png"
                alt="FRIDA"
                width={32}
                height={32}
                className="size-[var(--frida-logo-size)]"
                unoptimized
              />
              <p className="text-xs text-[var(--frida-detail)]">
                &copy; {new Date().getFullYear()} FRIDA e.V.
              </p>
            </div>
            <nav className="flex min-w-0 max-w-full shrink flex-wrap items-center justify-center gap-x-[var(--frida-space-large)] gap-y-[var(--frida-space-small)] sm:justify-end">
              {footerLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap text-xs font-semibold text-[var(--stitch-on-surface-variant)] underline underline-offset-2 transition-colors hover:text-[var(--stitch-primary)]"
                >
                  {t(item.title)}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  );
}
