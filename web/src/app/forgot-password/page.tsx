"use client";

import { useState, type SyntheticEvent } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AuthCardBrand } from "@/components/layout/auth-card-brand";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() { const { t } = useI18n(); const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [loading, setLoading] = useState(false); async function submit(event: SyntheticEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(""); setSuccess(""); const { error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/reset-password` }); if (resetError) setError(t("auth.recoveryRequestFailed")); else setSuccess(t("auth.confirmationHint")); setLoading(false); } return <div className="frida-auth-shell"><Card size="sm" className="frida-auth-card"><AuthCardBrand title={t("auth.recoveryTitle")} /><CardHeader className="pt-5"><CardTitle>{t("auth.recoveryTitle")}</CardTitle><CardDescription>{t("auth.recoveryHint")}</CardDescription></CardHeader><form onSubmit={submit}><CardContent className="space-y-4">{error && <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}{success && <div role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">{success}</div>}<div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">{t("auth.email")}</label><Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></div></CardContent><CardFooter className="flex-col gap-3"><Button type="submit" className="h-10 w-full" disabled={loading}>{loading ? t("auth.sendingRecovery") : t("auth.sendRecovery")}</Button><p className="text-xs text-muted-foreground"><Link href="/login" className="text-foreground hover:underline">{t("auth.signIn")}</Link></p></CardFooter></form></Card></div>; }
