"use client";
import { apiFetch } from '@/lib/api-client';

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, GlobeIcon, LayoutDashboardIcon, LogInIcon, SearchIcon, ShieldIcon, UserPlusIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type UserState = { authenticated: boolean; email?: string | null; firstname?: string | null; lastname?: string | null; role?: string };

export default function Home() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiFetch("/api/auth/me", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("anonymous"); const data = await response.json(); setUser({ authenticated: true, ...data }); }).catch(() => setUser({ authenticated: false })).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (user.authenticated) return <AuthenticatedHome user={user} />;
  const features = [{ icon: SearchIcon, title: t("home.features"), description: t("home.providerDescription") }, { icon: ShieldIcon, title: t("home.security"), description: t("home.securityDescription") }, { icon: BarChart3Icon, title: t("home.reports"), description: t("home.reportsDescription") }, { icon: GlobeIcon, title: t("common.provider"), description: t("home.providerDescription") }];
  const steps = [{ number: "01", title: t("home.stepRegister"), description: t("home.stepRegisterDescription") }, { number: "02", title: t("home.stepCheck"), description: t("home.stepCheckDescription") }, { number: "03", title: t("home.stepResults"), description: t("home.stepResultsDescription") }];
  return <div className="bg-[var(--frida-app-bg)]"><section className="bg-[image:var(--frida-gradient-background)] px-6 py-20 text-center text-white"><Image src="/frida-icon.png" alt="FRIDA" width={88} height={88} className="mx-auto mb-6" unoptimized priority /><Badge variant="outline" className="border-white/50 text-white">{t("home.badge")}</Badge><h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">{t("home.title")}</h1><p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">{t("home.description")}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/login"><Button className="w-full bg-white text-[var(--frida-primary)] hover:bg-white/90 sm:w-auto"><UserPlusIcon className="size-4" />{t("home.register")}</Button></Link><Link href="/login"><Button className="w-full bg-white text-[var(--frida-primary)] hover:bg-white/90 sm:w-auto"><LogInIcon className="size-4" />{t("home.signIn")}</Button></Link></div></section><section className="mx-auto max-w-6xl px-6 py-16"><h2 className="text-center text-3xl font-bold">{t("home.features")}</h2><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map((feature) => <Card key={feature.title}><CardHeader><feature.icon className="size-6 text-[var(--frida-primary)]" /><CardTitle className="text-lg">{feature.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{feature.description}</p></CardContent></Card>)}</div></section><section className="border-y bg-[var(--frida-surface)] px-6 py-16"><h2 className="text-center text-3xl font-bold">{t("home.workflow")}</h2><p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">{t("home.workflowDescription")}</p><div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">{steps.map((step) => <div key={step.number} className="rounded-xl border p-6 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] font-bold text-white">{step.number}</div><h3 className="mt-4 font-semibold">{step.title}</h3><p className="mt-2 text-sm text-muted-foreground">{step.description}</p></div>)}</div></section></div>;
}

function AuthenticatedHome({ user }: { user: UserState }) {
  const { t } = useI18n();
  const displayName = [user.firstname, user.lastname].filter(Boolean).join(" ") || user.email?.split("@")[0] || "FRIDA";
  const actions = [
    { href: "/dashboard/domain-check", icon: GlobeIcon, title: t("home.domainAction"), description: t("home.domainActionDescription") },
    { href: "/profile", icon: ShieldIcon, title: t("home.profileAction"), description: t("home.profileActionDescription") },
  ];
  if (user.role === "admin") actions.push({ href: "/admin", icon: LayoutDashboardIcon, title: t("home.adminAction"), description: t("home.adminActionDescription") });

  return (
    <div className="frida-dashboard-home">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:gap-5 sm:px-6 sm:py-10">
        <section className="rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-6 shadow-[var(--stitch-shadow-card)] sm:p-8">
          <Image src="/frida-logo.svg" alt="FRIDA" width={188} height={34} className="h-auto w-48 max-w-full" unoptimized />
          <h1 className="mt-6 text-xl font-bold tracking-tight text-[var(--frida-header-text)] sm:text-2xl">{t("home.welcome", { name: displayName })}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--stitch-on-surface-variant)] sm:text-base">{t("home.workspace")}</p>
        </section>

        <div className={`grid gap-4 ${actions.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="group flex min-h-24 items-center gap-4 rounded-[var(--frida-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-surface)] p-5 shadow-[var(--stitch-shadow-card)] transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--frida-primary)]/25">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--stitch-primary-container)] text-[var(--frida-primary)]"><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[var(--frida-header-text)]">{action.title}</span><span className="mt-0.5 block text-sm text-[var(--stitch-on-surface-variant)]">{action.description}</span></span>
                <ArrowRightIcon className="size-4 shrink-0 text-[var(--stitch-on-surface-variant)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="shadow-[var(--stitch-shadow-card)]">
            <CardHeader className="px-5 pt-5"><CardTitle className="flex items-center gap-2"><ShieldIcon className="size-4 text-[var(--frida-primary)]" />{t("home.aboutTitle")}</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5"><p className="text-sm leading-relaxed text-[var(--stitch-on-surface-variant)]">{t("home.aboutDescription")}</p></CardContent>
          </Card>
          <Card className="shadow-[var(--stitch-shadow-card)]">
            <CardHeader className="px-5 pt-5"><CardTitle className="flex items-center gap-2"><GlobeIcon className="size-4 text-[var(--frida-primary)]" />{t("home.quickInfoTitle")}</CardTitle></CardHeader>
            <CardContent className="px-5 pb-5"><ul className="space-y-2 text-sm text-[var(--stitch-on-surface-variant)]"><li className="flex gap-2"><span className="text-[var(--frida-primary)]">✓</span>{t("home.quickInfoCoverage")}</li><li className="flex gap-2"><span className="text-[var(--frida-primary)]">✓</span>{t("home.quickInfoPrivacy")}</li><li className="flex gap-2"><span className="text-[var(--frida-primary)]">✓</span>{t("home.quickInfoResults")}</li></ul></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
