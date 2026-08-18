import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/polityka-prywatnosci")({
  head: () => ({
    meta: [
      { title: "Polityka prywatności • Ekstraklasa 2026/27" },
      {
        name: "description",
        content:
          "Zasady przetwarzania danych w symulatorze Ekstraklasy 2026/27: dane konta, adresy IP, logi bezpieczeństwa i cookies.",
      },
      { property: "og:title", content: "Polityka prywatności • Ekstraklasa 2026/27" },
      {
        property: "og:description",
        content: "Jakie dane zapisujemy, w jakim celu i jakie masz prawa.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

const PLACEHOLDER = {
  entity: "[NAZWA PODMIOTU]",
  address: "[ADRES]",
  email: "[EMAIL KONTAKTOWY]",
  updated: "[DATA AKTUALIZACJI]",
};

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Polityka prywatności
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ostatnia aktualizacja: {PLACEHOLDER.updated}
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground">
        <section className="rounded-lg border border-border bg-muted/40 p-4 text-muted-foreground">
          Ten dokument jest wzorem opisującym rzeczywiste mechanizmy działania aplikacji. Nie jest
          poradą prawną. Właściciel aplikacji powinien zweryfikować jego treść pod kątem faktycznego
          sposobu działania serwisu oraz obowiązujących przepisów.
        </section>

        <section>
          <h2 className="text-lg font-semibold">1. Administrator danych</h2>
          <p className="mt-2">
            Administratorem danych jest {PLACEHOLDER.entity}, {PLACEHOLDER.address}. Kontakt w
            sprawach danych osobowych: {PLACEHOLDER.email}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Zakres przetwarzanych danych</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>dane konta: adres e-mail, nazwa wyświetlana, przypisana rola i klub,</li>
            <li>dane techniczne: adres IP, informacja o przeglądarce (user agent), typ urządzenia,</li>
            <li>dane sesji: identyfikator sesji, czas rozpoczęcia i ostatniej aktywności,</li>
            <li>
              historia działań: rodzaj zmiany, wersja stanu rozgrywki, poprzednia i nowa wartość,
              znacznik czasu,
            </li>
            <li>dane rozgrywki wprowadzane w aplikacji (wspólny, centralny stan gry).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Cele przetwarzania</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>działanie aplikacji i zapisywanie wspólnego stanu rozgrywki,</li>
            <li>uwierzytelnianie i kontrola uprawnień,</li>
            <li>synchronizacja danych między użytkownikami w czasie rzeczywistym,</li>
            <li>bezpieczeństwo, wykrywanie nadużyć i prowadzenie logów technicznych,</li>
            <li>rozliczalność zmian (audyt).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Podstawa prawna</h2>
          <p className="mt-2">
            Przetwarzanie odbywa się w celu świadczenia usługi (wykonanie umowy) oraz w prawnie
            uzasadnionym interesie administratora, jakim jest bezpieczeństwo serwisu i rozliczalność
            zmian. Zakres i podstawy należy potwierdzić z uwzględnieniem właściwych przepisów.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Okres przechowywania</h2>
          <p className="mt-2">
            Dane konta są przechowywane do czasu usunięcia konta. Logi techniczne i historia zmian są
            przechowywane przez okres niezbędny do zapewnienia bezpieczeństwa i rozliczalności —
            docelowy okres określa administrator ({PLACEHOLDER.entity}).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Odbiorcy danych</h2>
          <p className="mt-2">
            Dane są przechowywane w chmurowej bazie PostgreSQL wraz z usługami uwierzytelniania i
            synchronizacji (dostawca hostingu bazy danych oraz dostawca hostingu aplikacji), którzy
            działają jako podmioty przetwarzające na zlecenie administratora.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Adresy IP i logi bezpieczeństwa</h2>
          <p className="mt-2">
            Adres IP zapisywany jest wyłącznie jako dana techniczna przy zapisie zmian i przy
            sesjach. Adres IP nie służy do identyfikacji zapisu gry ani nie tworzy odrębnych danych
            dla różnych adresów — wszyscy użytkownicy korzystają z jednego centralnego stanu. Adresy
            IP widoczne są wyłącznie dla uprawnionych administratorów i moderatorów.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Pliki cookies i pamięć przeglądarki</h2>
          <p className="mt-2">
            Aplikacja korzysta wyłącznie z mechanizmów niezbędnych technicznie: przechowywania sesji
            logowania, identyfikatora sesji technicznej, preferencji interfejsu oraz tymczasowej
            kolejki zmian na wypadek utraty połączenia. Nie stosujemy cookies analitycznych,
            marketingowych ani profilujących.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Prawa użytkownika</h2>
          <p className="mt-2">
            Przysługuje Ci prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia
            przetwarzania, przenoszenia danych, sprzeciwu wobec przetwarzania opartego na prawnie
            uzasadnionym interesie oraz prawo wniesienia skargi do organu nadzorczego. Wnioski
            kieruj na adres {PLACEHOLDER.email}.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Kontakt</h2>
          <p className="mt-2">
            {PLACEHOLDER.entity}, {PLACEHOLDER.address}, {PLACEHOLDER.email}.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link to="/" className="text-sm underline">
          ← Powrót do symulatora
        </Link>
      </div>
    </main>
  );
}
