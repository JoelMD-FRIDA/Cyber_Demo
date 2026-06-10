import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Datenschutz — Frida DomainCheck",
  description: "Datenschutzerklärung für die Nutzung dieses Tools",
};

export default function DatenschutzPage() {
  return (
    <main className="frida-legal-page">
      <div className="frida-legal-card">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-semibold text-[var(--frida-gradient-start)] transition-colors hover:text-[var(--frida-primary)]"
        >
          &larr; Zurück zur Startseite
        </Link>

        <h1 className="mb-2 text-3xl font-bold tracking-tight">Datenschutz</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Informationen zur Verarbeitung personenbezogener Daten
        </p>

      <div className="space-y-8">
        {/* Privacy notice for tool usage — source: Mendix DataPrivacy XML */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Datenschutzhinweis für die Nutzung der Sandbox
          </h2>
          <div className="rounded-[var(--frida-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-muted-surface)]/40 p-5 text-pretty leading-relaxed text-foreground/85 shadow-[var(--frida-input-shadow)]">
            <p>
              Im Rahmen der Nutzung dieses Tools werden deine personenbezogenen
              Daten (E-Mail-Adresse, Name und Unternehmensname) ausschließlich
              für die Bereitstellung und Nutzung der Sandbox gespeichert.
            </p>
            <p className="mt-4">
              Eine Weitergabe deiner Daten an Dritte oder die Nutzung zu
              Werbezwecken erfolgt nicht. Wir behalten uns vor, dich im Anschluss
              zur Nutzung der Sandbox für eine kurze Befragung oder Feedback zu
              kontaktieren.
            </p>
            <p className="mt-4">
              Die im Rahmen des Scans verarbeiteten Daten und Ergebnisse werden
              nicht gespeichert. Es erfolgt keine Weitergabe an Dritte.
            </p>
          </div>
        </section>

        {/* Scope of data processing */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Verantwortlicher
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            FRIDA e. V.
            <br />
            c/o InsurLab Germany
            <br />
            Hohenzollernring 85–87
            <br />
            50672 Köln
          </p>
          <p className="mt-2 text-pretty leading-relaxed text-foreground/85">
            E-Mail:{" "}
            <a
              href="mailto:info@freeinsurancedata.de"
              className="underline underline-offset-2 hover:text-primary transition-colors"
            >
              info@freeinsurancedata.de
            </a>
          </p>
        </section>

        {/* Purpose and legal basis */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Zweck und Rechtsgrundlage der Verarbeitung
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            Die Verarbeitung deiner personenbezogenen Daten erfolgt zum Zweck der
            Bereitstellung des Domain-Check-Tools (Sandbox) sowie der damit
            verbundenen Nutzerverwaltung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
            DSGVO (Vertragserfüllung) sowie Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an der Bereitstellung des Dienstes).
          </p>
        </section>

        {/* Data retention */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Speicherdauer
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            Deine personenbezogenen Daten werden nur so lange gespeichert, wie es
            für die Bereitstellung des Tools erforderlich ist oder gesetzliche
            Aufbewahrungspflichten bestehen. Nach Beendigung der Nutzung werden
            die Daten gelöscht, sofern keine gesetzlichen Aufbewahrungspflichten
            entgegenstehen.
          </p>
        </section>

        {/* Your rights */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Deine Rechte
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            Dir stehen folgende Rechte hinsichtlich der dich betreffenden
            personenbezogenen Daten zu:
          </p>
          <ul className="mt-2 list-disc pl-6 space-y-1 text-foreground/85">
            <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO)</li>
            <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Widerspruchsrecht (Art. 21 DSGVO)</li>
          </ul>
          <p className="mt-3 text-pretty leading-relaxed text-foreground/85">
            Zur Ausübung deiner Rechte wende dich bitte an die oben genannte
            E-Mail-Adresse. Du hast zudem das Recht, Beschwerde bei der
            zuständigen Datenschutzaufsichtsbehörde einzulegen.
          </p>
        </section>

        {/* Log data */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">
            Protokolldaten
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            Wie allgemein üblich, werden Zugriffe auf unseren HTTP-Server
            protokolliert. Die Protokolle beinhalten jeweils Datum und Zeit, die
            Bezeichnung (URL) der von einem Nutzer angeforderten Seite und die
            IP-Adresse des Rechners, von dem aus die Seite abgerufen wird. Diese
            Daten werden nicht zu Werbezwecken verwendet und nicht an Dritte
            weitergegeben.
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="mb-3 text-xl font-semibold">Kontakt</h2>
          <p className="text-pretty leading-relaxed text-foreground/85">
            Bei Fragen zur Verarbeitung deiner personenbezogenen Daten oder zu
            diesem Datenschutzhinweis kannst du uns jederzeit unter der oben
            genannten E-Mail-Adresse kontaktieren.
          </p>
        </section>
      </div>

      <p className="mt-12 border-t pt-6 text-xs text-muted-foreground/70">
        &copy; FRIDA e.V. Alle Rechte vorbehalten. |{" "}
        <Link
          href="/impressum"
          className="underline underline-offset-2 hover:text-primary transition-colors"
        >
          Impressum
        </Link>
      </p>
      </div>
    </main>
  );
}
