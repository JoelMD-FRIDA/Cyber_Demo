"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { footerLinks } from "@/config/navigation";

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

  useEffect(() => {
    const skipsSessionProbe =
      pathname === "/login" ||
      pathname === "/register" ||
      pathname === "/forgot-password" ||
      pathname === "/reset-password" ||
      pathname === "/impressum" ||
      pathname === "/datenschutz" ||
      pathname.startsWith("/activate/");

    if (skipsSessionProbe) {
      setSessionUser(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadSessionUser() {
      setLoading(true);

      try {
        const res = await fetch("/api/auth/me", {
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
    await fetch("/api/auth/logout", { method: "POST" });
    setSessionUser(null);
    router.push("/login");
    router.refresh();
  };

  return (
    <SidebarProvider className="bg-[var(--frida-app-bg)]">
      {hasAdminSidebar && <AppSidebar userRole={userRole} />}
      <div className="flex min-w-0 flex-1 flex-col bg-[var(--frida-app-bg)]">
        <Header
          userRole={userRole}
          userName={userName}
          onLogout={sessionUser ? handleLogout : undefined}
          hasSidebar={hasAdminSidebar}
        />
        <main className="min-w-0 flex-1">{children}</main>
        <footer className="border-t border-[var(--stitch-outline-variant)] bg-[var(--stitch-surface-container-lowest)] py-[var(--stitch-space-lg)] text-[var(--stitch-on-surface)]">
          <div className="container mx-auto flex flex-col items-center gap-[var(--frida-space-medium)] px-[var(--frida-space-medium)] sm:flex-row sm:justify-between sm:px-[var(--frida-space-large)]">
            <div className="flex items-center gap-3">
              <Image
                src="/frida-icon.png"
                alt="FRIDA Logo"
                width={32}
                height={32}
                className="size-[var(--frida-logo-size)]"
                unoptimized
              />
              <p className="text-xs text-[var(--frida-detail)]">
                &copy; {new Date().getFullYear()} FRIDA e.V.
              </p>
            </div>
            <nav className="flex flex-wrap justify-center gap-[var(--frida-space-large)]">
              {footerLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-xs font-semibold text-[var(--stitch-on-surface-variant)] underline underline-offset-2 transition-colors hover:text-[var(--stitch-primary)]"
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </SidebarProvider>
  );
}
