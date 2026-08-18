import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Logowanie • Ekstraklasa 2026/27" },
      {
        name: "description",
        content:
          "Zaloguj się do centralnego symulatora Ekstraklasy 2026/27 — wspólny zapis w chmurze dla wszystkich uprawnionych użytkowników.",
      },
      { property: "og:title", content: "Logowanie • Ekstraklasa 2026/27" },
      {
        property: "og:description",
        content: "Konta, role i wspólny stan rozgrywki w chmurze.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/", replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name },
          },
        });
        if (error) throw error;
        setMsg(
          "Konto utworzone. Domyślna rola to podgląd — administrator musi nadać uprawnienia do edycji.",
        );
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Nie udało się zalogować.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">
          {mode === "login" ? "Logowanie" : "Rejestracja"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wspólny stan rozgrywki jest przechowywany w chmurze i wymaga konta.
        </p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          {mode === "register" && (
            <input
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Nazwa wyświetlana"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          )}
          <input
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Hasło"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Chwileczkę…" : mode === "login" ? "Zaloguj się" : "Załóż konto"}
          </button>
        </form>
        {msg && <p className="mt-3 text-sm text-muted-foreground">{msg}</p>}
        <button
          onClick={() => setMode(mode === "login" ? "register" : "login")}
          className="mt-4 text-sm text-muted-foreground underline"
        >
          {mode === "login" ? "Nie masz konta? Zarejestruj się" : "Masz konto? Zaloguj się"}
        </button>
        <div className="mt-6 text-xs text-muted-foreground">
          <Link to="/polityka-prywatnosci" className="underline">
            Polityka prywatności
          </Link>
        </div>
      </div>
    </main>
  );
}
