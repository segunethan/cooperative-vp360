import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ok = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { ...CORS, "Content-Type": "application/json" } });

const err = (msg: string, status = 400) =>
  new Response(JSON.stringify({ error: msg }), { status, headers: { ...CORS, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err("Missing authorization", 401);

  // Verify caller is a real super admin via their session token
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: superAdminRow } = await supabaseUser
    .from("super_admins")
    .select("user_id")
    .maybeSingle();

  if (!superAdminRow) return err("Forbidden", 403);

  // All data queries use the service role to bypass RLS
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const body = await req.json();
  const { action, tenantId, status } = body;

  // ── List all cooperatives ──────────────────────────────────────────────────
  if (action === "list") {
    const { data: tenants, error } = await admin
      .from("tenants")
      .select("*, members(count), tenant_users(count)")
      .order("created_at", { ascending: false });

    if (error) return err(error.message, 500);

    // Flatten counts
    const result = (tenants ?? []).map((t: Record<string, unknown>) => ({
      ...t,
      member_count: Array.isArray(t.members) ? (t.members[0] as Record<string, number>)?.count ?? 0 : 0,
      admin_count: Array.isArray(t.tenant_users) ? (t.tenant_users[0] as Record<string, number>)?.count ?? 0 : 0,
      members: undefined,
      tenant_users: undefined,
    }));

    return ok(result);
  }

  // ── Get members (all, or scoped to a cooperative) ─────────────────────────
  if (action === "members") {
    let query = admin
      .from("members")
      .select("id, full_name, email, phone, status, created_at, member_number, tenant_id, tenants(name)")
      .order("created_at", { ascending: false });

    if (tenantId) query = query.eq("tenant_id", tenantId);

    const { data, error } = await query;
    if (error) return err(error.message, 500);
    return ok(data ?? []);
  }

  // ── Set tenant status (suspend / activate) ────────────────────────────────
  if (action === "set_status") {
    if (!tenantId || !status) return err("tenantId and status required");
    const { data, error } = await admin
      .from("tenants")
      .update({ status })
      .eq("id", tenantId)
      .select()
      .single();

    if (error) return err(error.message, 500);
    return ok(data);
  }

  // ── Set member status (revoke / activate member) ───────────────────────────
  if (action === "set_member_status") {
    const { memberId } = body as { memberId?: string };
    if (!memberId || !status) return err("memberId and status required");
    const { data, error } = await admin
      .from("members")
      .update({ status })
      .eq("id", memberId)
      .select()
      .single();

    if (error) return err(error.message, 500);
    return ok(data);
  }

  return err("Unknown action");
});
