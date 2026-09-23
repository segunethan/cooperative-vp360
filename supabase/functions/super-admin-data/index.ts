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

  // ── Review a cooperative's KYB submission (approve / reject) ──────────────
  if (action === "review_kyb") {
    const { approve, rejectionReason } = body as { approve?: boolean; rejectionReason?: string };
    if (!tenantId || typeof approve !== "boolean") return err("tenantId and approve required");

    const { data: tenant, error: fetchError } = await admin
      .from("tenants")
      .update({
        status: approve ? "ACTIVE" : "KYB_REJECTED",
        kyb_rejection_reason: approve ? null : (rejectionReason ?? null),
        kyb_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select()
      .single();

    if (fetchError) return err(fetchError.message, 500);

    // Email every admin on the cooperative — best-effort, doesn't block the response
    try {
      const { data: tenantUsers } = await admin.from("tenant_users").select("user_id").eq("tenant_id", tenantId);
      const emails = (
        await Promise.all(
          (tenantUsers ?? []).map(async (row: { user_id: string }) => {
            const { data } = await admin.auth.admin.getUserById(row.user_id);
            return data.user?.email ?? null;
          })
        )
      ).filter((e): e is string => !!e);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey && emails.length > 0) {
        const heading = approve ? "Your cooperative is verified" : "Business verification not approved";
        const body_html = approve
          ? `<p style="margin:0 0 12px;font-size:15px;color:#374151;">Hi ${tenant.name}, your business verification is approved. You can now invite members and start accepting contributions.</p>`
          : `<p style="margin:0 0 12px;font-size:15px;color:#374151;">Hi ${tenant.name}, your business verification was not approved.</p>
             ${rejectionReason ? `<p style="margin:0 0 12px;font-size:14px;color:#374151;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;"><strong>Reason:</strong> ${rejectionReason}</p>` : ""}
             <p style="margin:0;font-size:14px;color:#374151;">Sign in to update your details and resubmit.</p>`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Jollify <noreply@thesegunadebayo.com>",
            to: emails,
            subject: approve ? "You're verified — start inviting members" : "Update on your business verification",
            html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;"><tr><td style="background:#012d1d;padding:28px 40px;"><span style="font-size:20px;font-weight:700;color:#ffffff;">Jollify</span></td></tr><tr><td style="background:linear-gradient(90deg,#c1ecd4,#6ee7b7);height:3px;font-size:0;">&nbsp;</td></tr><tr><td style="padding:40px 40px 32px;"><h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0a0a0a;">${heading}</h1>${body_html}</td></tr></table></td></tr></table></body></html>`,
          }),
        });
      }
    } catch {
      // notification failure shouldn't block the review action
    }

    return ok(tenant);
  }

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
