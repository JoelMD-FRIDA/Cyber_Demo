"use client";

import { createContext, useCallback, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useI18n, translateApiError } from "@/lib/i18n";

export interface Provider {
  id: string;
  key: string;
  name: string;
  inputType: "domain" | "contact";
  isActive: boolean;
  isConfigured: boolean;
  description?: string | null;
  assetPath?: string | null;
}

export interface Category {
  id: string;
  key: string;
  name: string;
  description?: string | null;
}

export interface WizardState {
  url: string;
  providerId: string;
  categoryId: string;
  providers: Provider[];
  categories: Category[];
  loading: boolean;
  optionsLoading: boolean;
  error: string | null;
  hasAcceptedDisclaimer: boolean;
  disclaimerVersion: string;
  remainingChecks: number | null;
  maxChecks: number | null;
}

type WizardAction =
  | { type: "SET_URL"; payload: string }
  | { type: "SET_PROVIDER"; payload: string }
  | { type: "SET_CATEGORY"; payload: string }
  | { type: "SET_OPTIONS"; payload: { providers: Provider[]; categories: Category[]; remainingChecks: number; maxChecks: number; disclaimerVersion: string } }
  | { type: "SET_OPTIONS_LOADING"; payload: boolean }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DISCLAIMER_ACCEPTED"; payload: boolean }
  | { type: "SET_QUOTA"; payload: { remaining: number; maximum: number } }
  | { type: "RESET" };

const initialState: WizardState = {
  url: "",
  providerId: "",
  categoryId: "",
  providers: [],
  categories: [],
  loading: false,
  optionsLoading: true,
  error: null,
  hasAcceptedDisclaimer: false,
  disclaimerVersion: "1.0",
  remainingChecks: null,
  maxChecks: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_URL": return { ...state, url: action.payload, error: null };
    case "SET_PROVIDER": return { ...state, providerId: action.payload, error: null };
    case "SET_CATEGORY": return { ...state, categoryId: action.payload, error: null };
    case "SET_OPTIONS": return {
      ...state,
      providers: action.payload.providers,
      categories: action.payload.categories,
      providerId: state.providerId || action.payload.providers.find((provider) => provider.isConfigured)?.id || action.payload.providers[0]?.id || "",
      categoryId: state.categoryId || action.payload.categories[0]?.id || "",
      remainingChecks: action.payload.remainingChecks,
      maxChecks: action.payload.maxChecks,
      disclaimerVersion: action.payload.disclaimerVersion,
      optionsLoading: false,
    };
    case "SET_OPTIONS_LOADING": return { ...state, optionsLoading: action.payload };
    case "SET_LOADING": return { ...state, loading: action.payload };
    case "SET_ERROR": return { ...state, error: action.payload };
    case "SET_DISCLAIMER_ACCEPTED": return { ...state, hasAcceptedDisclaimer: action.payload };
    case "SET_QUOTA": return { ...state, remainingChecks: action.payload.remaining, maxChecks: action.payload.maximum };
    case "RESET": return { ...initialState, providers: state.providers, categories: state.categories, providerId: state.providerId, categoryId: state.categoryId, disclaimerVersion: state.disclaimerVersion, remainingChecks: state.remainingChecks, maxChecks: state.maxChecks, optionsLoading: false };
    default: return state;
  }
}

interface WizardContextValue {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
  runDomainCheck: () => Promise<void>;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const router = useRouter();
  const { locale, t } = useI18n();

  const runDomainCheck = useCallback(async () => {
    if (!state.url.trim() || !state.providerId || !state.hasAcceptedDisclaimer) {
      dispatch({ type: "SET_ERROR", payload: t("domain.optionsError") });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const response = await fetch("/api/domain-check", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          url: state.url,
          providerId: state.providerId,
          categoryId: state.categoryId || undefined,
          hasAcceptedDisclaimer: state.hasAcceptedDisclaimer,
          disclaimerVersion: state.disclaimerVersion,
        }),
      });
      const data = await response.json() as { check?: { id: string }; code?: string; error?: string; remainingChecks?: number; maxChecks?: number };
      if (!response.ok || !data.check) {
        dispatch({ type: "SET_ERROR", payload: translateApiError(locale, data.code, data.error ?? t("domain.loadError")) });
        if (typeof data.remainingChecks === "number" && typeof data.maxChecks === "number") {
          dispatch({ type: "SET_QUOTA", payload: { remaining: data.remainingChecks, maximum: data.maxChecks } });
        }
        return;
      }
      router.push(`/dashboard/domain-check/results/${data.check.id}`);
    } catch {
      dispatch({ type: "SET_ERROR", payload: t("domain.loadError") });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [locale, router, state.categoryId, state.disclaimerVersion, state.hasAcceptedDisclaimer, state.providerId, state.url, t]);

  const resetWizard = useCallback(() => dispatch({ type: "RESET" }), []);
  return <WizardContext.Provider value={{ state, dispatch, runDomainCheck, resetWizard }}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) throw new Error("useWizard must be used within a WizardProvider");
  return context;
}
