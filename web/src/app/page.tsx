"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GlobeIcon,
  ShieldIcon,
  SearchIcon,
  BarChart3Icon,
  ArrowRightIcon,
  CheckCircleIcon,
  LogInIcon,
  UserPlusIcon,
  LayoutDashboardIcon,
  ArrowUpIcon,
} from "lucide-react";

type UserState = {
  authenticated: boolean;
  role?: string;
  firstname?: string;
  lastname?: string;
};

const features = [
  {
    icon: SearchIcon,
    title: "Domain-Recherche",
    description:
      "Prüfen Sie, ob eine Domain bereits als Phishing-Seite oder für betrügerische Aktivitäten gemeldet wurde.",
  },
  {
    icon: ShieldIcon,
    title: "Sicherheitsprüfung",
    description:
      "Erhalten Sie detaillierte Sicherheitsbewertungen und Risikobewertungen für geprüfte Domains.",
  },
  {
    icon: BarChart3Icon,
    title: "Berichte & Analysen",
    description:
      "Profitieren Sie von umfassenden Berichten und Analysen zu identifizierten Bedrohungen.",
  },
  {
    icon: GlobeIcon,
    title: "Multi-Provider",
    description:
      "Nutzen Sie mehrere Datenquellen und Provider für eine umfassende Bedrohungserkennung.",
  },
];

const steps = [
  {
    step: "01",
    title: "Registrieren",
    description:
      "Erstellen Sie ein kostenloses Konto mit Ihrer geschäftlichen E-Mail-Adresse.",
  },
  {
    step: "02",
    title: "Domain prüfen",
    description:
      "Geben Sie eine Domain ein und starten Sie die Prüfung auf verdächtige Aktivitäten.",
  },
  {
    step: "03",
    title: "Ergebnisse erhalten",
    description:
      "Erhalten Sie einen detaillierten Bericht mit Risikobewertung und Handlungsempfehlungen.",
  },
];

export default function Home() {
  const [user, setUser] = useState<UserState>({ authenticated: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) throw new Error("Not authenticated");
        return res.json();
      })
      .then((data) => {
        setUser({
          authenticated: true,
          role: data.role,
          firstname: data.firstname,
          lastname: data.lastname,
        });
      })
      .catch(() => {
        setUser({ authenticated: false });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user.authenticated) {
    return <AuthenticatedHome user={user} />;
  }

  return <AnonymousHome />;
}

function AnonymousHome() {
  return (
    <div className="bg-[var(--frida-app-bg)]">
      <ScrollToTop />
      <section className="relative isolate overflow-hidden bg-[image:var(--frida-gradient-background)] px-[var(--frida-space-medium)] py-[var(--frida-space-large)] text-[var(--frida-surface)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="frida-line-motif -z-10 opacity-70" />

        <div className="mx-auto flex min-h-[calc(100vh_-_var(--frida-topbar-height)_-_var(--frida-space-largest))] max-w-6xl items-center justify-center">
          <Card className="w-full max-w-3xl animate-fadeUp rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-[var(--frida-space-large)] text-center text-[var(--frida-text)] ring-0 sm:p-[var(--frida-space-largest)]">
            <CardContent className="flex flex-col items-center px-0">
              <Image
                src="/frida-icon.png"
                alt="FRIDA Logo"
                width={96}
                height={96}
                className="mb-[var(--frida-space-large)] size-24"
                unoptimized
                priority
              />

              <Badge
                variant="outline"
                className="mb-[var(--frida-space-medium)] border-[var(--frida-primary)] px-[var(--frida-space-small)] py-[var(--frida-space-smaller)] text-[var(--frida-primary)]"
              >
                FRIDA Cybersecurity Domain Checker
              </Badge>

              <h1 className="max-w-2xl text-balance text-[var(--frida-font-size-h1)] font-semibold leading-[var(--frida-line-height-base)] tracking-tight text-[var(--frida-text)]">
                Domain-Sicherheit auf einem neuen Level
              </h1>

              <p className="mt-[var(--frida-space-medium)] max-w-2xl text-balance text-[var(--frida-font-size-large)] leading-[var(--frida-line-height-base)] text-[var(--frida-detail)]">
                Das FRIDA Domain Check Tool ermöglicht es Versicherungsunternehmen,
                verdächtige Domains auf Phishing und betrügerische Aktivitäten zu
                prüfen — schnell, zuverlässig und DSGVO-konform.
              </p>

          <div className="mt-[var(--frida-space-large)] flex w-full flex-col items-stretch gap-[var(--frida-space-medium)] sm:w-auto sm:flex-row sm:justify-center">
                <Link href="/register" className="sm:min-w-48">
                  <Button className="h-11 w-full gap-[var(--frida-space-small)] rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] px-[var(--frida-space-large)] text-[var(--frida-surface)] hover:bg-[var(--frida-brand-hover)]">
                    <UserPlusIcon className="size-5" />
                    Kostenlos registrieren
                  </Button>
                </Link>
                <Link href="/login" className="sm:min-w-48">
                  <Button
                    variant="outline"
                    className="h-11 w-full gap-[var(--frida-space-small)] rounded-[var(--frida-radius-default)] border-[var(--frida-primary)] px-[var(--frida-space-large)] text-[var(--frida-primary)] hover:bg-transparent hover:text-[var(--frida-primary)]"
                  >
                    <LogInIcon className="size-5" />
                    Anmelden
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="px-[var(--frida-space-medium)] py-[var(--frida-space-large)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-[var(--frida-space-largest)] text-center">
            <h2 className="text-[var(--frida-font-size-h2)] font-semibold leading-[var(--frida-line-height-base)] tracking-tight text-[var(--frida-text)]">
              Funktionen
            </h2>
            <p className="mt-[var(--frida-space-small)] text-[var(--frida-font-size-large)] text-[var(--frida-detail)]">
              Alles, was Sie für die Domain-Überprüfung benötigen
            </p>
          </div>

          <div className="grid gap-[var(--frida-space-large)] sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.title}
                  className="group animate-fadeUp rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-[var(--frida-space-large)] ring-1 ring-[var(--frida-border)] transition-colors hover:ring-[var(--frida-primary)]"
                  style={{ animationDelay: `${(i + 1) * 0.1}s` }}
                >
                  <CardHeader className="px-0">
                    <div className="mb-[var(--frida-space-small)] flex size-10 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] text-[var(--frida-surface)] transition-colors group-hover:bg-[var(--frida-brand-hover)]">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-[var(--frida-font-size-h4)] font-semibold text-[var(--frida-text)]">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-0">
                    <p className="text-[var(--frida-font-size-default)] leading-[var(--frida-line-height-base)] text-[var(--frida-detail)]">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[var(--frida-border)] bg-[var(--frida-surface)] px-[var(--frida-space-medium)] py-[var(--frida-space-large)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="mx-auto max-w-6xl">
          <div className="mb-[var(--frida-space-largest)] text-center">
            <h2 className="text-[var(--frida-font-size-h2)] font-semibold leading-[var(--frida-line-height-base)] tracking-tight text-[var(--frida-text)]">
              So funktioniert es
            </h2>
            <p className="mt-[var(--frida-space-small)] text-[var(--frida-font-size-large)] text-[var(--frida-detail)]">
              In drei einfachen Schritten zur Domain-Überprüfung
            </p>
          </div>

          <div className="grid gap-[var(--frida-space-large)] md:grid-cols-3">
            {steps.map((item, i) => (
              <div
                key={item.step}
                className="animate-fadeUp rounded-[var(--frida-card-transparent-radius)] border border-[var(--frida-transparent-card-border-color)] p-[var(--frida-space-large)] text-center"
                style={{ animationDelay: `${(i + 1) * 0.1}s` }}
              >
                <div className="mx-auto flex size-12 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] text-[var(--frida-font-size-large)] font-semibold text-[var(--frida-surface)]">
                  {item.step}
                </div>
                <h3 className="mt-[var(--frida-space-medium)] text-[var(--frida-font-size-h4)] font-semibold text-[var(--frida-text)]">
                  {item.title}
                </h3>
                <p className="mt-[var(--frida-space-small)] text-[var(--frida-font-size-default)] leading-[var(--frida-line-height-base)] text-[var(--frida-detail)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative isolate overflow-hidden bg-[image:var(--frida-gradient-background)] px-[var(--frida-space-medium)] py-[var(--frida-space-large)] text-[var(--frida-surface)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="frida-line-motif -z-10 opacity-60" />
        <div className="mx-auto animate-fadeUp max-w-4xl text-center">
          <h2 className="text-[var(--frida-font-size-h2)] font-semibold leading-[var(--frida-line-height-base)] tracking-tight">
            Bereit loszulegen?
          </h2>
          <p className="mt-[var(--frida-space-small)] text-[var(--frida-font-size-large)] text-[var(--frida-surface)]">
            Registrieren Sie sich noch heute und nutzen Sie das FRIDA Domain
            Check Tool kostenlos.
          </p>
        </div>
      </section>
    </div>
  );
}

function AuthenticatedHome({ user }: { user: UserState }) {
  const isAdmin = user.role === "admin";
  const displayName = user.firstname
    ? `${user.firstname} ${user.lastname ?? ""}`.trim()
    : "User";

  return (
    <div className="bg-[var(--frida-app-bg)]">
      <ScrollToTop />
      <section className="bg-[image:var(--frida-gradient-background)] px-[var(--frida-space-medium)] py-[var(--frida-space-large)] text-[var(--frida-surface)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="mx-auto max-w-6xl">
          <Card className="rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-[var(--frida-space-large)] text-[var(--frida-text)] ring-0 sm:p-[var(--frida-space-largest)]">
            <CardContent className="px-0">
              <Image
                src="/frida-icon.png"
                alt="FRIDA"
                width={96}
                height={96}
                className="mb-[var(--frida-space-large)] size-24"
                unoptimized
                priority
              />
              <h1 className="text-[var(--frida-font-size-h1)] font-semibold leading-[var(--frida-line-height-base)] tracking-tight">
                Willkommen, {displayName}
              </h1>
              <p className="mt-[var(--frida-space-small)] max-w-2xl text-[var(--frida-font-size-large)] leading-[var(--frida-line-height-base)] text-[var(--frida-detail)]">
                {isAdmin
                  ? "Backend-Administration des FRIDA Cybersecurity Domain Checkers"
                  : "Domain verification and management platform"}
              </p>
            </CardContent>
          </Card>

          <div className="mt-[var(--frida-space-large)] grid gap-[var(--frida-space-medium)] sm:grid-cols-2 lg:grid-cols-3">
            <Link href="/dashboard/domain-check">
              <Card className="group cursor-pointer rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] transition-colors ring-1 ring-[var(--frida-border)] hover:ring-[var(--frida-primary)]">
                <CardContent className="flex items-center gap-[var(--frida-space-medium)] px-[var(--frida-space-large)] py-[var(--frida-space-large)]">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] text-[var(--frida-surface)]">
                    <SearchIcon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--frida-text)]">Domain-Check</p>
                    <p className="text-[var(--frida-font-size-small)] text-[var(--frida-detail)]">
                      Neue Domain prüfen
                    </p>
                  </div>
                  <ArrowRightIcon className="size-4 text-[var(--frida-detail)] transition-colors group-hover:text-[var(--frida-primary)]" />
                </CardContent>
              </Card>
            </Link>

            <Link href="/profile">
              <Card className="group cursor-pointer rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] transition-colors ring-1 ring-[var(--frida-border)] hover:ring-[var(--frida-primary)]">
                <CardContent className="flex items-center gap-[var(--frida-space-medium)] px-[var(--frida-space-large)] py-[var(--frida-space-large)]">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] text-[var(--frida-surface)]">
                    <CheckCircleIcon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[var(--frida-text)]">Profil</p>
                    <p className="text-[var(--frida-font-size-small)] text-[var(--frida-detail)]">
                      Einstellungen verwalten
                    </p>
                  </div>
                  <ArrowRightIcon className="size-4 text-[var(--frida-detail)] transition-colors group-hover:text-[var(--frida-primary)]" />
                </CardContent>
              </Card>
            </Link>

            {isAdmin && (
              <Link href="/admin">
                <Card className="group cursor-pointer rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] transition-colors ring-1 ring-[var(--frida-border)] hover:ring-[var(--frida-primary)]">
                  <CardContent className="flex items-center gap-[var(--frida-space-medium)] px-[var(--frida-space-large)] py-[var(--frida-space-large)]">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[var(--frida-radius-default)] bg-[var(--frida-primary)] text-[var(--frida-surface)]">
                      <LayoutDashboardIcon className="size-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--frida-text)]">Administration</p>
                      <p className="text-[var(--frida-font-size-small)] text-[var(--frida-detail)]">
                        System verwalten
                      </p>
                    </div>
                    <ArrowRightIcon className="size-4 text-[var(--frida-detail)] transition-colors group-hover:text-[var(--frida-primary)]" />
                  </CardContent>
                </Card>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="px-[var(--frida-space-medium)] py-[var(--frida-space-large)] sm:px-[var(--frida-space-large)] sm:py-[var(--frida-space-largest)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-[var(--frida-space-large)] md:grid-cols-2">
            <Card className="rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-[var(--frida-space-large)] ring-1 ring-[var(--frida-border)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-[var(--frida-space-small)] text-[var(--frida-font-size-h4)] font-semibold text-[var(--frida-text)]">
                  <ShieldIcon className="size-4" />
                  Über FRIDA Domain Check
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--frida-font-size-default)] leading-[var(--frida-line-height-base)] text-[var(--frida-detail)]">
                  Das FRIDA Domain Check Tool ermöglicht es
                  Versicherungsunternehmen, verdächtige Domains auf Phishing und
                  betrügerische Aktivitäten zu prüfen. Die im Rahmen des Scans
                  verarbeiteten Daten und Ergebnisse werden nicht gespeichert.
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-[var(--frida-card-radius)] bg-[var(--frida-surface)] p-[var(--frida-space-large)] ring-1 ring-[var(--frida-border)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-[var(--frida-space-small)] text-[var(--frida-font-size-h4)] font-semibold text-[var(--frida-text)]">
                  <GlobeIcon className="size-4" />
                  Quick-Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-[var(--frida-space-small)] text-[var(--frida-font-size-default)] text-[var(--frida-detail)]">
                  <li className="flex items-start gap-[var(--frida-space-small)]">
                    <CheckCircleIcon className="mt-[var(--frida-space-smaller)] size-4 shrink-0 text-[var(--frida-primary)]" />
                    <span>Mehrere Datenquellen für maximale Abdeckung</span>
                  </li>
                  <li className="flex items-start gap-[var(--frida-space-small)]">
                    <CheckCircleIcon className="mt-[var(--frida-space-smaller)] size-4 shrink-0 text-[var(--frida-primary)]" />
                    <span>DSGVO-konforme Datenverarbeitung</span>
                  </li>
                  <li className="flex items-start gap-[var(--frida-space-small)]">
                    <CheckCircleIcon className="mt-[var(--frida-space-smaller)] size-4 shrink-0 text-[var(--frida-primary)]" />
                    <span>Detaillierte Risikobewertungen in Echtzeit</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return visible ? (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 flex size-10 items-center justify-center rounded-full bg-[var(--frida-primary)] text-white shadow-lg transition-transform hover:scale-110"
      aria-label="Nach oben"
    >
      <ArrowUpIcon className="size-5" />
    </button>
  ) : null;
}
