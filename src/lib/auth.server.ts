import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "moderator" | "trener" | "viewer";

export type ActorInfo = {
  userId: string;
  email: string | null;
  displayName: string | null;
  clubId: string | null;
  roles: AppRole[];
};

/** Verifies a raw bearer token and resolves roles/club from the database. */
export async function resolveActor(bearer: string | null): Promise<ActorInfo | null> {
  if (!bearer) return null;
  const token = bearer.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const anon = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await anon.auth.getUser(token);
  if (error || !data.user) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", data.user.id),
    supabaseAdmin
      .from("profiles")
      .select("display_name, club_id, status")
      .eq("id", data.user.id)
      .maybeSingle(),
  ]);

  if (profile?.status === "blocked") return null;

  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    displayName: profile?.display_name ?? data.user.email ?? null,
    clubId: profile?.club_id ?? null,
    roles: ((roleRows ?? []).map((r) => r.role) as AppRole[]) ?? [],
  };
}

export function canWrite(actor: ActorInfo | null) {
  if (!actor) return false;
  return actor.roles.some((r) => r === "admin" || r === "moderator" || r === "trener");
}

export function isStaff(actor: ActorInfo | null) {
  if (!actor) return false;
  return actor.roles.some((r) => r === "admin" || r === "moderator");
}

export function clientIp(request: Request) {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null
  );
}
