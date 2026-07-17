"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import { useRouter } from "next/navigation";

export interface Provider {
  id: string;
  name: string;
  isActive: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface StructuredResults {
  resultsPWLeaks: number;
  resultsEmailLeaks: number;
  resultsEoLSoftware: number;
  resultsOpenPorts: number;
  resultsSPFRecord: boolean;
  hasSPFRecordResult: boolean;
  hasDarknetResults: boolean;
  hasSoftwareResults: boolean;
  hasOpenPortsResults: boolean;
}

export interface DomainCheckResults {
  spf: {
    hasSpf: boolean;
    spfRecord: string | null;
    issues: string[];
  };
  ports: {
    port: number;
    service: string;
    status: "open" | "closed" | "filtered";
  }[];
  leaks: {
    type: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    source: string;
  }[];
  summary: {
    totalChecks: number;
    passed: number;
    warnings: number;
    failed: number;
  };
}

export interface DomainCheckResponse {
  id: string;
  url: string;
  status: string;
  remainingChecks: number;
  maxChecks: number;
  providerCount: number;
  results: DomainCheckResults;
  structuredResults: StructuredResults;
}

export interface WizardState {
  step: 0 | 1 | 2 | 3;
  url: string;
  providerId: string | null;
  categoryId: string | null;
  providers: Provider[];
  categories: Category[];
  results: DomainCheckResults | null;
  structuredResults: StructuredResults | null;
  checkId: string | null;
  loading: boolean;
  error: string | null;
  hasAcceptedDisclaimer: boolean;
  disclaimerVersion: string;
  remainingChecks: number | null;
  maxChecks: number | null;
}

type WizardAction =
  | { type: "SET_STEP"; payload: 0 | 1 | 2 | 3 }
  | { type: "SET_URL"; payload: string }
  | { type: "SET_PROVIDER"; payload: string | null }
  | { type: "SET_CATEGORY"; payload: string | null }
  | { type: "SET_PROVIDERS"; payload: Provider[] }
  | { type: "SET_CATEGORIES"; payload: Category[] }
  | { type: "SET_RESULTS"; payload: { results: DomainCheckResults; structuredResults: StructuredResults; id: string; remainingChecks: number; maxChecks: number } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_DISCLAIMER_ACCEPTED"; payload: { version: string } }
  | { type: "SET_REMAINING_CHECKS"; payload: { remaining: number; max: number } }
  | { type: "RESET" };

const initialState: WizardState = {
  step: 1,
  url: "",
  providerId: null,
  categoryId: null,
  providers: [],
  categories: [],
  results: null,
  structuredResults: null,
  checkId: null,
  loading: false,
  error: null,
  hasAcceptedDisclaimer: false,
  disclaimerVersion: "1.0",
  remainingChecks: null,
  maxChecks: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "SET_URL":
      return { ...state, url: action.payload };
    case "SET_PROVIDER":
      return { ...state, providerId: action.payload };
    case "SET_CATEGORY":
      return { ...state, categoryId: action.payload };
    case "SET_PROVIDERS":
      return { ...state, providers: action.payload };
    case "SET_CATEGORIES":
      return { ...state, categories: action.payload };
    case "SET_RESULTS":
      return {
        ...state,
        results: action.payload.results,
        structuredResults: action.payload.structuredResults,
        checkId: action.payload.id,
        remainingChecks: action.payload.remainingChecks,
        maxChecks: action.payload.maxChecks,
        step: 2,
      };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_DISCLAIMER_ACCEPTED":
      return {
        ...state,
        hasAcceptedDisclaimer: true,
        disclaimerVersion: action.payload.version,
      };
    case "SET_REMAINING_CHECKS":
      return {
        ...state,
        remainingChecks: action.payload.remaining,
        maxChecks: action.payload.max,
      };
    case "RESET":
      return {
        ...initialState,
        providers: state.providers,
        categories: state.categories,
      };
    default:
      return state;
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

  const runDomainCheck = useCallback(async () => {
    if (!state.url) {
      dispatch({ type: "SET_ERROR", payload: "Please enter a URL" });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });

    try {
      const res = await fetch("/api/domain-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: state.url,
          providerId: state.providerId,
          categoryId: state.categoryId,
          hasAcceptedDisclaimer: state.hasAcceptedDisclaimer,
          disclaimerVersion: state.disclaimerVersion,
        }),
      });

      const data: DomainCheckResponse & { error?: string; code?: string; maxChecks?: number; remainingChecks?: number } = await res.json();

      if (!res.ok) {
        if (res.status === 429 && data.code === "CHECK_LIMIT_EXCEEDED") {
          dispatch({
            type: "SET_ERROR",
            payload: data.error || "Domain check limit reached.",
          });
          if (data.maxChecks !== undefined && data.remainingChecks !== undefined) {
            dispatch({
              type: "SET_REMAINING_CHECKS",
              payload: { remaining: data.remainingChecks, max: data.maxChecks },
            });
          }
          return;
        }
        dispatch({ type: "SET_ERROR", payload: data.error || "Domain check failed" });
        return;
      }

      router.push(`/dashboard/domain-check/results/${data.id}`);
    } catch {
      dispatch({ type: "SET_ERROR", payload: "An unexpected error occurred. Please try again." });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [router, state.url, state.providerId, state.categoryId, state.hasAcceptedDisclaimer, state.disclaimerVersion]);

  const resetWizard = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return (
    <WizardContext.Provider value={{ state, dispatch, runDomainCheck, resetWizard }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return context;
}
