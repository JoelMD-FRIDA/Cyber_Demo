"use client";

import { useState, type SyntheticEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getApiErrorMessage, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuthCardBrand } from "@/components/layout/auth-card-brand";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", cache: "no-store", headers: { "Accept": "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ identifier: identifier.trim(), password }) });
      const data = await response.json().catch(() => ({})) as { code?: string; error?: string };
      if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t("auth.signIn")));
      const redirect = searchParams.get("redirect");
      const destination = redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
      window.location.assign(destination);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("auth.signIn")); } finally { setLoading(false); }
  }
  return <AuthShell title={t("auth.login")}><CardHeader className="pt-5"><CardTitle>{t("auth.signIn")}</CardTitle><CardDescription>{t("auth.emailOrUsername")}</CardDescription></CardHeader><form onSubmit={handleSubmit}><CardContent className="space-y-4">{error && <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}<Field id="identifier" label={t("auth.emailOrUsername")} value={identifier} onChange={setIdentifier} autoComplete="username" /><div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="password" className="text-sm font-medium">{t("auth.password")}</label><Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">{t("auth.forgotPassword")}</Link></div><Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" /></div></CardContent><CardFooter className="flex-col gap-3"><Button type="submit" className="h-10 w-full" disabled={loading}>{loading ? t("auth.signingIn") : t("auth.signIn")}</Button><p className="text-xs text-muted-foreground">{t("auth.noAccount")} <Link href="/register" className="text-foreground hover:underline">{t("auth.register")}</Link></p></CardFooter></form></AuthShell>;
}

function AuthShell({ title, children }: { title: string; children: React.ReactNode }) { return <div className="frida-auth-shell"><Card size="sm" className="frida-auth-card"><AuthCardBrand title={title} />{children}</Card></div>; }
function Field({ id, label, value, onChange, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string }) { return <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}</label><Input id={id} name={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} required autoComplete={autoComplete} /></div>; }
