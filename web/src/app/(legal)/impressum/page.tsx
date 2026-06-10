import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Impressum — Frida DomainCheck",
  description: "Rechtliche Angaben zum Betreiber dieser Website",
};

export default function ImpressumPage() {
  return (
    <main className="frida-legal-page">
      <div className="frida-legal-card">
        <Link
          href="/"
          className="mb-8 inline-flex items-center text-sm font-semibold text-[var(--frida-gradient-start)] transition-colors hover:text-[var(--frida-primary)]"
        >
          &larr; Zurück zur Startseite
        </Link>

        <h1 className="mb-2 text-3xl font-bold tracking-tight">Impressum</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Angaben gemäß § 5 TMG
        </p>

      <section className="space-y-8">
        {/* Organization */}
        <div>
          <h2 className="mb-3 text-xl font-semibold">Betreiber der Website</h2>
          <p className="text-pretty leading-relaxed text-foreground/90">
            FRIDA e. V.
            <br />
            c/o InsurLab Germany
            <br />
            Hohenzollernring 85–87
            <br />
            50672 Köln
          </p>
          <p className="mt-2 text-pretty leading-relaxed text-foreground/90">
            E-Mail:{" "}
            <a
              href="mailto:info@freeinsurancedata.de"
              className="underline underline-offset-2 hover:text-primary transition-colors"
            >
              info@freeinsurancedata.de
            </a>
          </p>
        </div>

        {/* Board */}
        <div>
          <h2 className="mb-3 text-xl font-semibold">
            Gemeinschaftlich vertretungsberechtigt
          </h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium">1. Vorsitzender:</h3>
              <p className="text-pretty leading-relaxed text-foreground/90">
                Julius Kretz
                <br />
                c/o ALTE LEIPZIGER Lebensversicherung a.G.
                <br />
                Alte Leipziger-Platz 1
                <br />
                61440 Oberursel
                <br />
                E-Mail:{" "}
                <a
                  href="mailto:julius.kretz@alte-leipziger.de"
                  className="underline underline-offset-2 hover:text-primary transition-colors"
                >
                  julius.kretz@alte-leipziger.de
                </a>
              </p>
            </div>

            <div>
              <h3 className="font-medium">2. Vorsitzender:</h3>
              <p className="text-pretty leading-relaxed text-foreground/90">
                Slobodan Pantelic
                <br />
                c/o HDI Vertriebs AG
                <br />
                HDI-Platz 1
                <br />
                30659 Hannover
                <br />
                E-Mail:{" "}
                <a
                  href="mailto:Slobodan.Pantelic@talanx.com"
                  className="underline underline-offset-2 hover:text-primary transition-colors"
                >
                  Slobodan.Pantelic@talanx.com
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Register */}
        <div className="rounded-[var(--frida-card-radius)] border border-[var(--frida-border-default)] bg-[var(--frida-muted-surface)]/40 p-5 shadow-[var(--frida-input-shadow)]">
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/70">Registergericht:</dt>
              <dd className="text-foreground/90">Amtsgericht Köln</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/70">Registernummer:</dt>
              <dd className="text-foreground/90">VR 20919</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/70">Steuernummer:</dt>
              <dd className="text-foreground/90">218/5755/1417</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-foreground/70">Umsatzsteuer-ID:</dt>
              <dd className="text-foreground/90">DE359711339</dd>
            </div>
          </dl>
        </div>

        {/* Editorial Responsibility */}
        <div>
          <h2 className="mb-3 text-xl font-semibold">
            Rechtliche Verantwortung i. S. des MStV (§ 18 Abs. 2)
          </h2>
          <p className="text-pretty leading-relaxed text-foreground/90">
            Julius Kretz
            <br />
            c/o Alte Leipziger Lebensversicherung a.G.
            <br />
            Alte Leipziger-Platz 1
            <br />
            61440 Oberursel
            <br />
            E-Mail:{" "}
            <a
              href="mailto:julius.kretz@alte-leipziger.de"
              className="underline underline-offset-2 hover:text-primary transition-colors"
            >
              julius.kretz@alte-leipziger.de
            </a>
          </p>
        </div>
      </section>

      {/* Disclaimer */}
      <section className="mt-12 space-y-6 border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight">Haftungsausschluss</h2>
        <p className="text-sm text-muted-foreground">
          Rechtliche Hinweise zu unserem Onlineangebot (Disclaimer)
        </p>

        <div className="space-y-6">
          <article>
            <h3 className="mb-2 text-lg font-semibold">
              1. Inhalt des Onlineangebotes
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              FRIDA e. V. übernimmt keinerlei Gewähr für die Aktualität,
              Korrektheit, Vollständigkeit oder Qualität der bereitgestellten
              Informationen. Haftungsansprüche gegen FRIDA e. V., die sich auf
              Schäden materieller oder ideeller Art beziehen, welche durch die
              Nutzung oder Nichtnutzung der dargebotenen Informationen bzw. durch
              die Nutzung fehlerhafter und unvollständiger Informationen verursacht
              wurden, sind grundsätzlich ausgeschlossen, sofern seitens von FRIDA
              e. V. kein nachweislich vorsätzliches oder grob fahrlässiges
              Verschulden vorliegt.
            </p>
            <p className="mt-2 text-pretty leading-relaxed text-foreground/85">
              Alle Angebote sind freibleibend und unverbindlich. FRIDA e. V.
              behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte
              Angebot ohne gesonderte Ankündigung zu verändern, zu ergänzen, zu
              löschen oder die Veröffentlichung zeitweise oder endgültig
              einzustellen.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">
              2. Verweise und Links
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              Sofern auf Verweisziele (&ldquo;Links&rdquo;) direkt oder indirekt
              verwiesen wird, die außerhalb des Verantwortungsbereiches der FRIDA
              e. V. liegen, haftet dieser nur dann, wenn er von den Inhalten
              Kenntnis hat und es ihm technisch möglich und zumutbar wäre, die
              Nutzung im Falle rechtswidriger Inhalte zu verhindern. Für
              darüberhinausgehende Inhalte und insbesondere für Schäden, die aus
              der Nutzung oder Nichtnutzung solcherart dargebotener Informationen
              entstehen, haftet allein der Anbieter dieser Seiten, nicht
              derjenige, der über Links auf die jeweilige Veröffentlichung
              lediglich verweist. Diese Einschränkung gilt gleichermaßen auch für
              Fremdeinträge in von der FRIDA e. V. eingerichteten Gästebüchern,
              Diskussionsforen und Mailinglisten.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">
              3. Urheberrecht und Haftung
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              Inhalt und Gestaltung der Portalseiten der FRIDA e. V. sind
              urheberrechtlich geschützt und dürfen ausschließlich und nach
              Belieben der FRIDA e. V. von autorisierten Personen geändert oder
              ergänzt werden. Die Vervielfältigung der enthaltenen Daten und
              Informationen bedarf der vorherigen schriftlichen Zustimmung der
              FRIDA e.V. Die auf den Portalseiten zur Verfügung gestellten
              Informationen werden unter Beachtung größter Sorgfalt laufend
              aktualisiert und ergänzt. Dennoch kann keine Garantie für die
              Richtigkeit und Vollständigkeit der angegebenen Daten übernommen
              werden, da eine zwischenzeitlich eingetretene Änderung nicht
              gänzlich auszuschließen ist. Dies gilt ebenso für sämtliche
              Webseiten Dritter, auf die durch einen Hyperlink verwiesen wird.
              Dort enthaltene Informationen stehen im alleinigen
              Verantwortungsbereich ihres Herstellers bzw. Verwenders. FRIDA e.
              V. schließt demnach jegliche Haftung im oben genannten Zusammenhang
              aus.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">
              4. Verbindung zu anderen Servern
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              Diese Website enthält Verbindungen zu Servern, die von anderen
              Unternehmen gepflegt werden und deren Inhalte der FRIDA e. V. nicht
              bekannt sind. FRIDA e. V. übernimmt darüber hinaus hinsichtlich der
              Richtigkeit oder der Quelle der auf diesen Servern gefundenen
              Informationen bzw. hinsichtlich des Inhalts einer Datei, die der
              Anwender eventuell von der Website dritter Parteien downloaden
              möchte, keine Gewähr.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">
              5. Technische Ausfälle
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              FRIDA e. V. haftet nicht für technische Ausfälle sowie für
              Ausfälle, die außerhalb des Einflussbereiches der FRIDA e. V.
              liegen.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">6. Protokolle</h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              Wie allgemein üblich, werden Zugriffe auf unseren HTTP-Server
              protokolliert. Die Protokolle beinhalten jeweils Datum und Zeit, die
              Bezeichnung (URL) der von einem Nutzer angeforderten Seite und die
              Bezeichnung (IP-Nummer) des Rechners, von dem aus die Seite
              abgerufen wird.
            </p>
          </article>

          <article>
            <h3 className="mb-2 text-lg font-semibold">
              7. Datenschutz & personenbezogene Daten
            </h3>
            <p className="text-pretty leading-relaxed text-foreground/85">
              Informationen zur Verarbeitung von personenbezogenen Daten finden
              Sie in unserem{" "}
              <Link
                href="/datenschutz"
                className="underline underline-offset-2 hover:text-primary transition-colors"
              >
                Datenschutzhinweis
              </Link>
              .
            </p>
          </article>
        </div>

        <p className="pt-4 text-xs text-muted-foreground/70">
          &copy; FRIDA e.V. Alle Rechte vorbehalten.
        </p>
      </section>
      </div>
    </main>
  );
}
