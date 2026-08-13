"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, BarChart3Icon, GlobeIcon, LogInIcon, SearchIcon, ShieldIcon, UserPlusIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type UserState = { authenticated: boolean; firstname?: string | null; lastname?: string | null; role?: string };

export default function Home() {
  const { t } = useI18n();
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("anonymous"); const data = await response.json(); setUser({ authenticated: true, ...data }); }).catch(() => setUser({ authenticated: false })).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (user.authenticated) return <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center gap-6 px-6 text-center"><Badge variant="outline">{t("home.badge")}</Badge><h1 className="text-4xl font-bold tracking-tight">{t("home.title")}</h1><p className="max-w-2xl text-muted-foreground">{t("home.description")}</p><Link href="/dashboard/domain-check"><Button size="lg">{t("domain.start")}<ArrowRightIcon className="size-4" /></Button></Link></div>;
  const features = [{ icon: SearchIcon, title: t("home.features"), description: t("home.providerDescription") }, { icon: ShieldIcon, title: t("home.security"), description: t("home.securityDescription") }, { icon: BarChart3Icon, title: t("home.reports"), description: t("home.reportsDescription") }, { icon: GlobeIcon, title: t("common.provider"), description: t("home.providerDescription") }];
  const steps = [{ number: "01", title: t("home.stepRegister"), description: t("home.stepRegisterDescription") }, { number: "02", title: t("home.stepCheck"), description: t("home.stepCheckDescription") }, { number: "03", title: t("home.stepResults"), description: t("home.stepResultsDescription") }];
  return <div className="bg-[var(--frida-app-bg)]"><section className="bg-[image:var(--frida-gradient-background)] px-6 py-20 text-center text-white"><Image src="/frida-icon.png" alt="FRIDA" width={88} height={88} className="mx-auto mb-6" unoptimized priority /><Badge variant="outline" className="border-white/50 text-white">{t("home.badge")}</Badge><h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">{t("home.title")}</h1><p className="mx-auto mt-6 max-w-2xl text-lg text-white/85">{t("home.description")}</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/register"><Button className="w-full bg-white text-[var(--frida-primary)] hover:bg-white/90 sm:w-auto"><UserPlusIcon className="size-4" />{t("home.register")}</Button></Link><Link href="/login"><Button variant="outline" className="w-full border-white text-white hover:bg-white/10 sm:w-auto"><LogInIcon className="size-4" />{t("home.signIn")}</Button></Link></div></section><section className="mx-auto max-w-6xl px-6 py-16"><h2 className="text-center text-3xl font-bold">{t("home.features")}</h2><div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{features.map((feature) => <Card key={feature.title}><CardHeader><feature.icon className="size-6 text-[var(--frida-primary)]" /><CardTitle className="text-lg">{feature.title}</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{feature.description}</p></CardContent></Card>)}</div></section><section className="border-y bg-[var(--frida-surface)] px-6 py-16"><h2 className="text-center text-3xl font-bold">{t("home.workflow")}</h2><p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">{t("home.workflowDescription")}</p><div className="mx-auto mt-10 grid max-w-5xl gap-5 md:grid-cols-3">{steps.map((step) => <div key={step.number} className="rounded-xl border p-6 text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] font-bold text-white">{step.number}</div><h3 className="mt-4 font-semibold">{step.title}</h3><p className="mt-2 text-sm text-muted-foreground">{step.description}</p></div>)}</div></section></div>;
}
