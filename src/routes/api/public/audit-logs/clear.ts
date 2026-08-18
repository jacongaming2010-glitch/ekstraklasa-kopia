import { createFileRoute } from "@tanstack/react-router";

import { isStaff, resolveActor } from "@/lib/auth.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/audit-logs/clear")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const actor = await resolveActor(request.headers.get("authorization"));
        if (!actor) return json({ error: "Wymagane logowanie" }, 401);
        if (!isStaff(actor)) return json({ error: "Brak uprawnień" }, 403);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("audit_logs")
          .delete()
          .not("id", "is", null);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      },
    },
  },
});
