"use client";

import { useEffect } from "react";
import { GlobeIcon, Loader2Icon } from "lucide-react";
import { getApiErrorMessage, useI18n } from "@/lib/i18n";
import { useWizard } from "@/components/domain-check/wizard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const fieldClass = "h-11 rounded-[var(--frida-radius-default)] border-[var(--frida-input-border)] bg-[var(--frida-surface)] px-3 text-sm shadow-[var(--frida-input-shadow)] focus-visible:border-[var(--frida-primary)] focus-visible:ring-0";

export default function DomainCheckForm() {
  const { state, dispatch, runDomainCheck } = useWizard();
  const { locale, t } = useI18n();

  useEffect(() => {
    if (state.providers.length > 0 || !state.optionsLoading) return;
    const controller = new AbortController();
    async function loadOptions() {
      try {
        const response = await fetch("/api/domain-check/options", { cache: "no-store", signal: controller.signal });
        const data = await response.json() as { providers?: unknown[]; categories?: unknown[]; remainingChecks?: number; maxChecks?: number; disclaimerVersion?: string; code?: string; error?: string };
        if (!response.ok || !Array.isArray(data.providers) || !Array.isArray(data.categories)) throw new Error(getApiErrorMessage(locale, data, t("domain.optionsError")));
        dispatch({
          type: "SET_OPTIONS",
          payload: {
            providers: data.providers as never,
            categories: data.categories as never,
            remainingChecks: data.remainingChecks ?? 0,
            maxChecks: data.maxChecks ?? 0,
            disclaimerVersion: data.disclaimerVersion ?? "1.0",
          },
        });
      } catch (error) {
        if (!controller.signal.aborted) {
          dispatch({ type: "SET_ERROR", payload: error instanceof Error ? error.message : t("domain.optionsError") });
          dispatch({ type: "SET_OPTIONS_LOADING", payload: false });
        }
      }
    }
    void loadOptions();
    return () => controller.abort();
  }, [dispatch, locale, state.optionsLoading, state.providers.length, t]);

  const configuredProviders = state.providers.filter((provider) => provider.isConfigured);
  const canSubmit = Boolean(state.url.trim() && state.providerId && state.categoryId && state.hasAcceptedDisclaimer && configuredProviders.length && (state.remainingChecks ?? 1) > 0);

  return (
    <Card className="mx-auto w-full max-w-2xl rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-2 shadow-none ring-1 ring-[var(--frida-border)] sm:p-6">
      <CardHeader className="px-4 pt-5 text-center sm:px-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] text-white"><GlobeIcon className="size-6" /></div>
        <CardTitle className="pt-2 text-2xl text-[var(--frida-header-text)]">{t("domain.title")}</CardTitle>
        <CardDescription>{t("domain.subtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={(event) => { event.preventDefault(); void runDomainCheck(); }}>
        <CardContent className="space-y-5 px-4 sm:px-6">
          {state.error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div>}
          {state.optionsLoading ? <div className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">{t("common.loading")}</div> : (
            <>
              <div className="space-y-2">
                <label htmlFor="domain-url" className="text-sm font-semibold">{t("domain.url")}</label>
                <Input id="domain-url" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={t("domain.urlHint")} value={state.url} onChange={(event) => dispatch({ type: "SET_URL", payload: event.target.value })} className={fieldClass} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="domain-provider" className="text-sm font-semibold">{t("common.provider")}</label>
                  <select id="domain-provider" value={state.providerId} onChange={(event) => dispatch({ type: "SET_PROVIDER", payload: event.target.value })} className={`w-full ${fieldClass}`} required>
                    <option value="" disabled>{t("domain.selectProvider")}</option>
                    {state.providers.map((provider) => <option key={provider.id} value={provider.id} disabled={!provider.isConfigured}>{provider.name}{provider.isConfigured ? "" : ` — ${t("common.notConfigured")}`}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="domain-category" className="text-sm font-semibold">{t("common.category")}</label>
                  <select id="domain-category" value={state.categoryId} onChange={(event) => dispatch({ type: "SET_CATEGORY", payload: event.target.value })} className={`w-full ${fieldClass}`} required>
                    <option value="" disabled>{t("domain.selectCategory")}</option>
                    {state.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-[var(--frida-input-border)] bg-[var(--frida-app-background)] p-3 text-sm text-muted-foreground">
                {t("domain.quota", { remaining: state.remainingChecks ?? 0, maximum: state.maxChecks ?? 0 })}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--frida-input-border)] bg-[var(--frida-app-background)] p-4 text-xs leading-relaxed text-muted-foreground">
                <input type="checkbox" checked={state.hasAcceptedDisclaimer} onChange={(event) => dispatch({ type: "SET_DISCLAIMER_ACCEPTED", payload: event.target.checked })} className="mt-0.5 size-4 shrink-0 accent-[var(--frida-primary)]" />
                <span>{t("domain.disclaimer")}</span>
              </label>
            </>
          )}
        </CardContent>
        <CardFooter className="px-4 pb-5 sm:px-6">
          <Button type="submit" className="h-11 w-full" disabled={!canSubmit || state.loading || state.optionsLoading}>
            {state.loading ? <><Loader2Icon className="size-4 animate-spin" />{t("domain.starting")}</> : t("domain.start")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
