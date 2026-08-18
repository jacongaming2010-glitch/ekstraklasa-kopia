import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  getDiagnostics,
  getMe,
  listAuditLogs,
  listSessions,
  listUsers,
  setUserClub,
  setUserRole,
} from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel administratora • Ekstraklasa 2026/27" },
      {
        name: "description",
        content:
          "Panel administracyjny symulatora: użytkownicy, role, sesje, historia zmian i diagnostyka backendu.",
      },
      { property: "og:title", content: "Panel administratora • Ekstraklasa 2026/27" },
      { property: "og:description", content: "Zarządzanie kontami, rolami i historią zmian." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Panel,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Nie udało się wczytać panelu: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Nie znaleziono.</div>,
});

function fmt(d: string | null | undefined) {
  return d ? new Date(d).toLocaleString("pl-PL") : "—";
}

function Panel() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const users = useQuery({ queryKey: ["users"], queryFn: () => listUsers() });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => listSessions() });
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => listAuditLogs(), refetchInterval: 5000 });
  const diag = useQuery({ queryKey: ["diag"], queryFn: () => getDiagnostics(), refetchInterval: 5000 });

  const roleFn = useServerFn(setUserRole);
  const clubFn = useServerFn(setUserClub);

  const roles = me.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isStaff = isAdmin || roles.includes("moderator");

  if (me.isLoading) return <div className="p-8 text-sm text-muted-foreground">Wczytywanie…</div>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Panel administratora</h1>
          <p className="text-sm text-muted-foreground">
            Zalogowano jako {me.data?.profile?.display_name ?? me.data?.profile?.email} · rola:{" "}
            {roles.join(", ") || "brak"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/" className="rounded-md border border-input px-3 py-1.5 text-sm">
            Symulator
          </Link>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth", replace: true });
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm"
          >
            Wyloguj
          </button>
        </div>
      </header>

      {!isStaff && (
        <p className="mt-8 rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Twoja rola nie daje dostępu do danych administracyjnych. Widoczne są tylko informacje o
          Twoim koncie.
        </p>
      )}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Baza danych" value={diag.data?.dbOk ? "OK" : "Błąd"} />
        <Card label="Wersja stanu" value={String(diag.data?.revision ?? "—")} />
        <Card label="Ostatni zapis" value={fmt(diag.data?.lastSaveAt)} />
        <Card label="Aktywne sesje" value={String(diag.data?.activeSessions ?? 0)} />
      </section>

      {isStaff && (
        <>
          <Section title="Użytkownicy">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Użytkownik</th>
                  <th>Rola</th>
                  <th>Klub</th>
                  <th>Status</th>
                  <th>Ostatnia aktywność</th>
                </tr>
              </thead>
              <tbody>
                {(users.data?.rows ?? []).map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="py-2">{u.display_name ?? u.email}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          defaultValue={u.roles[0] ?? "viewer"}
                          onChange={async (e) => {
                            await roleFn({
                              data: { userId: u.id, role: e.target.value as "admin" },
                            });
                            users.refetch();
                          }}
                          className="rounded border border-input bg-background px-2 py-1"
                        >
                          <option value="admin">admin</option>
                          <option value="moderator">moderator</option>
                          <option value="trener">trener</option>
                          <option value="viewer">viewer</option>
                        </select>
                      ) : (
                        (u.roles.join(", ") || "viewer")
                      )}
                    </td>
                    <td>
                      {isAdmin ? (
                        <input
                          defaultValue={u.club_id ?? ""}
                          placeholder="np. leg"
                          onBlur={async (e) => {
                            await clubFn({
                              data: { userId: u.id, clubId: e.target.value || null },
                            });
                            users.refetch();
                          }}
                          className="w-24 rounded border border-input bg-background px-2 py-1"
                        />
                      ) : (
                        (u.club_id ?? "—")
                      )}
                    </td>
                    <td>{u.status}</td>
                    <td>{fmt(u.last_seen_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Sesje">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Sesja</th>
                  <th>Start</th>
                  <th>Ostatnia aktywność</th>
                  <th>Urządzenie</th>
                  {isAdmin && <th>IP</th>}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(sessions.data?.rows ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2 font-mono text-xs">{s.session_key.slice(0, 12)}…</td>
                    <td>{fmt(s.started_at)}</td>
                    <td>{fmt(s.last_seen_at)}</td>
                    <td>{s.device ?? "—"}</td>
                    {isAdmin && <td className="font-mono text-xs">{s.ip_address ?? "—"}</td>}
                    <td>{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Historia zmian">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">Kiedy</th>
                  <th>Kto</th>
                  <th>Akcja</th>
                  <th>Klub</th>
                  <th>Zmiana</th>
                  {isAdmin && <th>IP</th>}
                </tr>
              </thead>
              <tbody>
                {(logs.data?.rows ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-border align-top">
                    <td className="py-2 whitespace-nowrap">{fmt(l.created_at)}</td>
                    <td>{l.actor_name ?? "—"}</td>
                    <td>{l.action}</td>
                    <td>{l.club_id ?? "—"}</td>
                    <td className="max-w-md text-xs text-muted-foreground">
                      {(l.new_value as { summary?: string } | null)?.summary ?? "—"}
                    </td>
                    {isAdmin && <td className="font-mono text-xs">{l.ip_address ?? "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold text-foreground">{title}</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card p-3">{children}</div>
    </section>
  );
}
