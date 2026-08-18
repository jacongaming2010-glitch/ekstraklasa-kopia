import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CookieNotice } from "@/components/CookieNotice";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ekstraklasa 2026/27 • Symulator sezonu" },
      {
        name: "description",
        content:
          "Interaktywny symulator sezonu Ekstraklasy 2026/27 – wspólny stan rozgrywki zapisywany w chmurze dla wszystkich uprawnionych użytkowników.",
      },
      { property: "og:title", content: "Ekstraklasa 2026/27 • Symulator sezonu" },
      {
        property: "og:description",
        content:
          "Symuluj sezon Ekstraklasy 2026/27: wyniki, tabela i walka o mistrzostwo — jeden centralny zapis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setEmail(session?.user.email ?? null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="flex h-screen w-full flex-col">
      <h1 className="sr-only">Ekstraklasa 2026/27 — symulator sezonu</h1>
      <iframe
        src="/symulator/index.html"
        title="Symulator Ekstraklasy 2026/27"
        className="w-full flex-1 border-0"
      />
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-background px-4 py-2 text-xs text-muted-foreground">
        <span>{email ? `Zalogowano: ${email}` : "Niezalogowany — zapis wymaga konta"}</span>
        {email ? (
          <Link to="/panel" className="underline">
            Panel
          </Link>
        ) : (
          <Link to="/auth" className="underline">
            Zaloguj się
          </Link>
        )}
        <Link to="/polityka-prywatnosci" className="underline">
          Polityka prywatności
        </Link>
      </footer>
      <CookieNotice />
    </div>
  );
}
