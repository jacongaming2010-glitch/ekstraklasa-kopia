import { createFileRoute } from "@tanstack/react-router";

import { canWrite, clientIp, resolveActor } from "@/lib/auth.server";

const ROW_ID = "main";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function diffSummary(prev: unknown, next: unknown) {
  if (!prev || typeof prev !== "object" || !next || typeof next !== "object") {
    return { changed: [] as string[], summary: "stan utworzony" };
  }
  const a = prev as Record<string, unknown>;
  const b = next as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (k === "revision" || k === "role" || k === "userClubId") continue;
    try {
      if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) changed.push(k);
    } catch {
      changed.push(k);
    }
  }
  return {
    changed,
    summary: changed.length ? `zmieniono: ${changed.join(", ")}` : "brak zmian merytorycznych",
  };
}

export const Route = createFileRoute("/api/public/state")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("game_state")
          .select("revision, state, updated_at")
          .eq("id", ROW_ID)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        if (!data) return json({ revision: 0, state: null });
        return json({
          revision: Number(data.revision),
          state: data.state,
          updatedAt: data.updated_at,
        });
      },
      PUT: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as {
          revision?: number;
          state?: unknown;
          actor?: { role?: string; club?: string; name?: string; sessionId?: string };
          kind?: string;
        } | null;
        if (!body || typeof body.state !== "object" || body.state === null) {
          return json({ error: "invalid body" }, 400);
        }

        // Authorization is enforced server-side; the frontend is never trusted.
        const actor = await resolveActor(request.headers.get("authorization"));
        if (!actor) return json({ error: "Wymagane logowanie", code: "unauthenticated" }, 401);
        if (!canWrite(actor)) {
          return json({ error: "Brak uprawnień do zapisu", code: "forbidden" }, 403);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: current, error: readError } = await supabaseAdmin
          .from("game_state")
          .select("revision, state")
          .eq("id", ROW_ID)
          .maybeSingle();
        if (readError) return json({ error: readError.message }, 500);

        const currentRevision = current ? Number(current.revision) : 0;
        const clientRevision = Number(body.revision ?? 0);

        // Optimistic concurrency: refuse to blindly overwrite a newer revision.
        if (current && clientRevision !== currentRevision) {
          return json(
            {
              conflict: true,
              revision: currentRevision,
              state: current.state,
              message: "Wersja nieaktualna — pobierz najnowszy stan.",
            },
            409,
          );
        }

        const nextRevision = currentRevision + 1;
        const { error } = await supabaseAdmin.from("game_state").upsert({
          id: ROW_ID,
          revision: nextRevision,
          state: body.state as never,
          updated_at: new Date().toISOString(),
          updated_by: actor.userId,
        });
        if (error) return json({ error: error.message }, 500);

        const diff = diffSummary(current?.state ?? null, body.state);
        const ip = clientIp(request);
        const ua = request.headers.get("user-agent");
        const sessionKey = body.actor?.sessionId ?? null;

        await supabaseAdmin.from("audit_logs").insert({
          user_id: actor.userId,
          actor_name: actor.displayName,
          session_id: sessionKey,
          action: body.kind ?? diff.changed[0] ?? "state_update",
          table_name: "game_state",
          record_id: ROW_ID,
          club_id: actor.clubId ?? body.actor?.club ?? null,
          old_value: { revision: currentRevision },
          new_value: { revision: nextRevision, changed: diff.changed, summary: diff.summary },
          ip_address: ip,
          user_agent: ua,
        });

        if (sessionKey) {
          await supabaseAdmin.from("sessions").upsert(
            {
              session_key: sessionKey,
              user_id: actor.userId,
              ip_address: ip,
              user_agent: ua,
              device: ua && /Mobi|Android/i.test(ua) ? "mobile" : "desktop",
              status: "active",
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "session_key" },
          );
          await supabaseAdmin
            .from("profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", actor.userId);
        }

        return json({ revision: nextRevision, savedAt: new Date().toISOString() });
      },
    },
  },
});
