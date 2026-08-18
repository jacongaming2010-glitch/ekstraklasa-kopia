import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile: profile ?? null,
      roles: (roles ?? []).map((r) => r.role as string),
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, email, club_id, status, last_seen_at, created_at")
      .order("created_at", { ascending: false });
    if (error) return { rows: [], error: error.message };
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    return {
      rows: (data ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      })),
      error: null as string | null,
    };
  });

export const listSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("sessions")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(100);
    return { rows: data ?? [], error: error?.message ?? null };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return { rows: data ?? [], error: error?.message ?? null };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "moderator", "trener", "viewer"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    // RLS ("admin manages roles") is the real guard here.
    const del = await context.supabase.from("user_roles").delete().eq("user_id", data.userId);
    if (del.error) return { ok: false, error: del.error.message };
    const ins = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (ins.error) return { ok: false, error: ins.error.message };
    return { ok: true, error: null as string | null };
  });

export const setUserClub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        clubId: z.string().max(64).nullable(),
        status: z.enum(["active", "blocked"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { club_id: string | null; status?: string } = { club_id: data.clubId };
    if (data.status) patch.status = data.status;
    const { error } = await context.supabase.from("profiles").update(patch).eq("id", data.userId);
    return { ok: !error, error: error?.message ?? null };
  });

export const getDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: gs, error: gsErr } = await context.supabase
      .from("game_state")
      .select("revision, updated_at")
      .eq("id", "main")
      .maybeSingle();
    const { count: sessionCount } = await context.supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    const { data: lastLog } = await context.supabase
      .from("audit_logs")
      .select("created_at, action")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return {
      dbOk: !gsErr,
      revision: gs ? Number(gs.revision) : 0,
      lastSaveAt: gs?.updated_at ?? null,
      lastAction: lastLog ?? null,
      activeSessions: sessionCount ?? 0,
    };
  });
