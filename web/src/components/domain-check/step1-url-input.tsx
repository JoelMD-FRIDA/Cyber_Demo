"use client";

import { useEffect } from "react";
import { useWizard } from "@/components/domain-check/wizard-context";
import { DisclaimerCheckbox, DISCLAIMER_VERSION } from "@/components/domain-check/disclaimer-checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { GlobeIcon, Loader2Icon } from "lucide-react";

const transparentCardClass =
  "mx-auto w-full max-w-2xl rounded-[var(--frida-card-transparent-radius)] border border-[var(--frida-transparent-card-border-color)] bg-[var(--frida-surface)] p-6 text-[var(--frida-header-text)] shadow-none ring-0 sm:p-12";

const fieldClass =
  "h-11 rounded-[var(--frida-radius-default)] border-[var(--frida-input-border)] bg-[var(--frida-surface)] px-2 py-2 text-[14px] shadow-[var(--frida-input-shadow)] placeholder:text-[var(--muted-foreground)] focus-visible:border-[var(--frida-primary)] focus-visible:ring-0";

const primaryButtonClass =
  "h-11 rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] px-6 text-[14px] font-semibold text-white shadow-none hover:bg-[var(--frida-gradient-start)] focus-visible:border-[var(--frida-primary)] focus-visible:ring-2 focus-visible:ring-[var(--frida-primary)]";

export default function Step1UrlInput() {
  const { state, dispatch, runDomainCheck } = useWizard();

  useEffect(() => {
    async function fetchOptions() {
      try {
        const [providersRes, categoriesRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/categories"),
        ]);

        if (providersRes.ok) {
          const providersData = await providersRes.json();
          dispatch({
            type: "SET_PROVIDERS",
            payload: providersData.providers ?? [],
          });
        }

        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json();
          dispatch({
            type: "SET_CATEGORIES",
            payload: categoriesData.categories ?? [],
          });
        }
      } catch {
        dispatch({
          type: "SET_ERROR",
          payload: "Failed to load form options. Please try again.",
        });
      }
    }

    if (state.providers.length === 0) {
      fetchOptions();
    }
  }, [dispatch, state.providers.length]);

  const isFormValid =
    state.url.trim().length > 0 &&
    state.providerId !== null &&
    state.categoryId !== null;

  const canSubmit = isFormValid && state.hasAcceptedDisclaimer;

  function handleSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (canSubmit) {
      runDomainCheck();
    }
  }

  return (
    <Card size="sm" className={transparentCardClass}>
      <CardHeader className="px-0 text-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-[var(--frida-font-size-large)] font-bold text-[var(--frida-primary)]">
            Step 1/2
          </span>
          <div className="flex size-12 items-center justify-center rounded-full bg-[var(--frida-primary)] text-white">
            <GlobeIcon className="size-6" />
          </div>
          <CardTitle className="text-[var(--frida-font-size-h1)] font-semibold leading-tight text-[var(--frida-header-text)]">
            Deine Sicherheitsprüfung für
          </CardTitle>
        </div>
        <CardDescription className="mx-auto max-w-md text-[14px] text-[var(--muted-foreground)]">
          Bitte hier die Website eingeben und die gewünschte Scan-Konfiguration
          auswählen.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6 px-0 pt-4">
          {state.error && (
            <div className="rounded-[var(--frida-radius-default)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="url"
              className="text-[14px] font-semibold text-[var(--frida-header-text)]"
            >
              Bitte hier die Website eingeben
            </label>
            <Input
              id="url"
              type="text"
              placeholder="https://example.com"
              value={state.url}
              onChange={(e) =>
                dispatch({ type: "SET_URL", payload: e.target.value })
              }
              required
              autoFocus
              className={fieldClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="provider"
                className="text-[14px] font-semibold text-[var(--frida-header-text)]"
              >
                Anbieter
              </label>
              <select
                id="provider"
                value={state.providerId ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_PROVIDER",
                    payload: e.target.value || null,
                  })
                }
                className={`flex w-full min-w-0 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive ${fieldClass}`}
                required
              >
                <option value="" disabled>
                  Select a provider
                </option>
                {state.providers
                  .filter((p) => p.isActive)
                  .map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="category"
                className="text-[14px] font-semibold text-[var(--frida-header-text)]"
              >
                Kategorie
              </label>
              <select
                id="category"
                value={state.categoryId ?? ""}
                onChange={(e) =>
                  dispatch({
                    type: "SET_CATEGORY",
                    payload: e.target.value || null,
                  })
                }
                className={`flex w-full min-w-0 transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive ${fieldClass}`}
                required
              >
                <option value="" disabled>
                  Select a category
                </option>
                {state.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DisclaimerCheckbox
            accepted={state.hasAcceptedDisclaimer}
            onAcceptChange={() =>
              dispatch({
                type: "SET_DISCLAIMER_ACCEPTED",
                payload: { version: DISCLAIMER_VERSION },
              })
            }
          />
        </CardContent>
        <CardFooter className="border-0 bg-transparent px-0 pt-6 pb-0">
          <Button
            type="submit"
            className={`w-full ${primaryButtonClass}`}
            disabled={!canSubmit || state.loading}
          >
            {state.loading ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Checking domain...
              </>
            ) : (
              "Check Domain"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
