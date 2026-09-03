"use client";

import { useEffect } from "react";
import { CheckIcon, GlobeIcon, Loader2Icon } from "lucide-react";
import { getApiErrorMessage, useI18n } from "@/lib/i18n";
import { useWizard } from "@/components/domain-check/wizard-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const fieldClass = "h-11 rounded-[var(--frida-radius-default)] border-[var(--frida-input-border)] bg-[var(--frida-surface)] px-3 text-sm shadow-[var(--frida-input-shadow)] focus-visible:border-[var(--frida-primary)] focus-visible:ring-0";
const providerLogoSources: Record<string, string> = {
  cysmo: "https://www.cysmo.de/fileadmin/public/Redaktion/Bilder/Logos/cysmo_logo_rgb_neg.svg",
  panta: "https://static.wixstatic.com/media/7a6893_ea84018a2d5146609f9a986787aac59b~mv2.png/v1/fill/w_220,h_220,al_c,q_90,usm_0.66_1.00_0.01,enc_auto/Panta-Logo-Edited-White-NoText.png",
};

function ProviderCard({
  provider,
  selected,
  onSelect,
  configuredLabel,
  unavailableLabel,
}: {
  provider: { id: string; key: string; name: string; isConfigured: boolean; assetPath?: string | null };
  selected: boolean;
  onSelect: () => void;
  configuredLabel: string;
  unavailableLabel: string;
}) {
  const logoSrc = provider.assetPath || providerLogoSources[provider.key];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!provider.isConfigured}
      onClick={onSelect}
      className={cn(
        "flex min-h-24 items-center gap-3 rounded-[var(--frida-radius-default)] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--frida-primary)]",
        selected
          ? "border-[var(--frida-primary)] bg-[var(--frida-primary)]/5 ring-1 ring-[var(--frida-primary)]"
          : "border-[var(--frida-input-border)] bg-[var(--frida-surface)] hover:border-[var(--frida-primary)]/60 hover:bg-[var(--frida-app-background)]",
        !provider.isConfigured && "cursor-not-allowed opacity-55 hover:border-[var(--frida-input-border)] hover:bg-[var(--frida-surface)]",
      )}
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[#10233f] p-2.5">
        {logoSrc ? <img src={logoSrc} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-lg font-bold text-white">{provider.name.slice(0, 1)}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--frida-header-text)]">{provider.name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{provider.isConfigured ? configuredLabel : unavailableLabel}</span>
      </span>
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-[var(--frida-primary)] bg-[var(--frida-primary)] text-white" : "border-[var(--frida-border-default)]")}>
        {selected && <CheckIcon className="size-3.5" aria-hidden="true" />}
      </span>
    </button>
  );
}

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
  const selectedProvider = state.providers.find((provider) => provider.id === state.providerId);
  const visibleProviders = state.providers.filter((provider) => provider.key === "cysmo" || provider.key === "panta");
  const isContactProvider = selectedProvider?.inputType === "contact";
  const canSubmit = Boolean(state.url.trim() && selectedProvider?.isConfigured && state.hasAcceptedDisclaimer && configuredProviders.length && (state.remainingChecks ?? 1) > 0);

  return (
    <Card className="mx-auto w-full max-w-2xl rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-2 shadow-none ring-1 ring-[var(--frida-border)] sm:p-6">
      <CardHeader className="px-4 pt-5 text-center sm:px-6">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] text-white"><GlobeIcon className="size-6" /></div>
        <CardTitle className="pt-2 text-2xl text-[var(--frida-header-text)]">{t("domain.title")}</CardTitle>
        <CardDescription>{t("domain.subtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={(event) => { event.preventDefault(); void runDomainCheck(); }}>
        <CardContent className="space-y-5 px-4 pb-2 sm:px-6">
          {state.error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</div>}
          {state.optionsLoading ? <div className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">{t("common.loading")}</div> : (
            <>
              <div className="space-y-2">
                <label htmlFor="domain-url" className="text-sm font-semibold">{isContactProvider ? t("domain.contact") : t("domain.url")}</label>
                <Input id="domain-url" type="text" inputMode={isContactProvider ? "email" : "url"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder={isContactProvider ? t("domain.contactHint") : t("domain.urlHint")} value={state.url} onChange={(event) => dispatch({ type: "SET_URL", payload: event.target.value })} className={fieldClass} required />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">{t("common.provider")}</legend>
                <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("common.provider")}>
                  {visibleProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      selected={state.providerId === provider.id}
                      onSelect={() => dispatch({ type: "SET_PROVIDER", payload: provider.id })}
                      configuredLabel={t("common.configured")}
                      unavailableLabel={t("common.notConfigured")}
                    />
                  ))}
                </div>
              </fieldset>
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
        <CardFooter className="px-4 pb-5 pt-5 sm:px-6">
          <Button type="submit" className="h-11 w-full" disabled={!canSubmit || state.loading || state.optionsLoading}>
            {state.loading ? <><Loader2Icon className="size-4 animate-spin" />{t("domain.starting")}</> : t("domain.start")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
