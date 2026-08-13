"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { getApiErrorMessage, useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuthCardBrand } from "@/components/layout/auth-card-brand";

type Values = { firstname: string; lastname: string; username: string; email: string; password: string; company: string; registrationCode: string };
export default function RegisterPage() {
  const { locale, t } = useI18n();
  const [values, setValues] = useState<Values>({ firstname: "", lastname: "", username: "", email: "", password: "", company: "", registrationCode: "" });
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [loading, setLoading] = useState(false);
  const update = (key: keyof Values, value: string) => setValues((current) => ({ ...current, [key]: value }));
  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(""); setSuccess(""); try { const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }); const data = await response.json() as { code?: string; error?: string; confirmationRequired?: boolean }; if (!response.ok) throw new Error(getApiErrorMessage(locale, data, t("auth.register"))); setSuccess(data.confirmationRequired ? t("auth.confirmationHint") : t("auth.registrationComplete")); } catch (reason) { setError(reason instanceof Error ? reason.message : t("auth.register")); } finally { setLoading(false); } }
  const field = (id: keyof Values, label: string, type = "text", optional = false) => <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{label}{optional && <span className="text-muted-foreground"> ({t("auth.optional")})</span>}</label><Input id={id} type={type} value={values[id]} onChange={(event) => update(id, event.target.value)} required={!optional} autoComplete={id === "email" ? "email" : id === "password" ? "new-password" : id === "username" ? "username" : undefined} /></div>;
  return <div className="frida-auth-shell"><Card size="sm" className="frida-auth-card max-w-lg"><AuthCardBrand title={t("auth.register")} /><CardHeader className="pt-5"><CardTitle>{t("auth.createAccount")}</CardTitle><CardDescription>{t("auth.confirmationHint")}</CardDescription></CardHeader><form onSubmit={handleSubmit}><CardContent className="space-y-4">{error && <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}{success && <div role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{success}</div>}<div className="grid grid-cols-2 gap-3">{field("firstname", t("auth.firstName"))}{field("lastname", t("auth.lastName"))}</div>{field("username", t("auth.username"), "text", true)}{field("email", t("auth.email"), "email")}{field("password", t("auth.password"), "password")}{field("registrationCode", t("auth.registrationKey"), "text", true)}{field("company", t("auth.company"), "text", true)}</CardContent><CardFooter className="flex-col gap-3"><Button type="submit" className="h-10 w-full" disabled={loading}>{loading ? t("auth.creatingAccount") : t("auth.createAccount")}</Button><p className="text-xs text-muted-foreground">{t("auth.haveAccount")} <Link href="/login" className="text-foreground hover:underline">{t("auth.signIn")}</Link></p></CardFooter></form></Card></div>;
}
