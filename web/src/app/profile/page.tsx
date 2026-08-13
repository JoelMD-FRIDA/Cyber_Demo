"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, LogOutIcon, MailIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type UserProfile = { email: string; firstname: string | null; lastname: string | null; company: string | null; role: "admin" | "user"; createdAt: string };

export default function ProfilePage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/me", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) { router.push("/login"); return; }
      setUser(await response.json() as UserProfile);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t("domain.loadError")); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router, t]);

  async function logout() { setLoggingOut(true); await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  const fullName = user ? [user.firstname, user.lastname].filter(Boolean).join(" ") || "—" : "—";
  const date = user ? new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-US", { dateStyle: "long" }).format(new Date(user.createdAt)) : "—";
  const fields = user ? [
    { icon: MailIcon, label: t("auth.email"), value: user.email },
    { icon: UserIcon, label: t("profile.name"), value: fullName },
    ...(user.company ? [{ icon: ShieldCheckIcon, label: t("auth.company"), value: user.company }] : []),
    { icon: ShieldCheckIcon, label: t("profile.role"), value: user.role === "admin" ? t("admin.admin") : t("admin.user") },
    { icon: CalendarIcon, label: t("profile.created"), value: date },
  ] : [];

  return <div className="frida-content-page"><div className="frida-pageheader"><h1>{t("profile.title")}</h1><p>{t("profile.subtitle")}</p></div>{error && <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}<Card className="max-w-3xl"><CardHeader><CardTitle className="flex items-center gap-2"><UserIcon className="size-5" />{t("profile.account")}</CardTitle></CardHeader><CardContent className="space-y-4">{loading ? <><Skeleton className="h-5 w-48" /><Skeleton className="h-5 w-64" /><Skeleton className="h-5 w-32" /></> : user ? <>{fields.map((field) => <div key={field.label} className="rounded-lg border bg-[var(--frida-surface)] p-3"><div className="flex items-center gap-3"><field.icon className="size-4 text-[var(--frida-primary)]" /><div><p className="text-sm text-muted-foreground">{field.label}</p><p className="font-medium">{field.value}</p></div></div></div>)}<hr className="border-border" /><Button variant="destructive" onClick={() => void logout()} disabled={loggingOut}><LogOutIcon className="size-4" />{t("profile.logout")}</Button></> : null}</CardContent></Card></div>;
}
