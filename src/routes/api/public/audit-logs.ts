import { createFileRoute } from "@tanstack/react-router";

import { isStaff, resolveActor } from "@/lib/auth.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/audit-logs")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const actor = await resolveActor(request.headers.get("authorization"));
        if (!actor) return json({ error: "Wymagane logowanie", logs: [] }, 401);

        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 500);
        const clubId = url.searchParams.get("clubId");
        const actionType = url.searchParams.get("actionType");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        if (clubId) query = query.eq("club_id", clubId);
        if (actionType) query = query.eq("action", actionType);
        if (!isStaff(actor)) query = query.eq("user_id", actor.userId);

        const { data, error } = await query;
        if (error) return json({ error: error.message, logs: [] }, 500);

        const logs = (data ?? []).map((row) => {
          const next = (row.new_value ?? {}) as Record<string, unknown>;
          return {
            id: row.id,
            timestamp: row.created_at,
            username: row.actor_name ?? "—",
            role: row.user_id === actor.userId ? actor.roles[0] ?? "viewer" : "user",
            clubName: row.club_id ?? "",
            clubId: row.club_id ?? "",
            actionType: row.action,
            target: row.table_name ?? "game_state",
            oldValue: JSON.stringify(row.old_value ?? null),
            newValue: typeof next["summary"] === "string" ? (next["summary"] as string) : JSON.stringify(next),
            ip: row.ip_address ?? "",
          };
        });

        return json({ logs });
      },
    },
  },
});
