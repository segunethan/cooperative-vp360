import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  type: "request_submitted" | "request_reviewed";
  tenantId?: string;      // required for request_submitted — used to find admin emails
  memberEmail?: string;   // required for request_reviewed — the member is the recipient
  memberName: string;
  cooperativeName: string;
  requestLabel: string;   // e.g. "GopherEdge subscription", "Loan top-up", "GopherHold withdrawal"
  amountLabel: string;    // formatted, e.g. "₦500,000"
  status?: "APPROVED" | "REJECTED"; // only for request_reviewed
}

const emailShell = (heading: string, body: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
          <tr>
            <td style="background:#012d1d;padding:28px 40px;">
              <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Jollify</span>
            </td>
          </tr>
          <tr>
            <td style="background:linear-gradient(90deg,#c1ecd4,#6ee7b7);height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#0a0a0a;letter-spacing:-0.4px;">${heading}</h1>
              ${body}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f0ede8;background:#fafaf9;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">&copy; 2026 Jollify &middot; Cooperative Management Platform</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const payload: NotificationPayload = await req.json();
    const { type, memberName, cooperativeName, requestLabel, amountLabel } = payload;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let recipients: string[] = [];
    let subject: string;
    let html: string;

    if (type === "request_submitted") {
      if (!payload.tenantId) throw new Error("tenantId is required for request_submitted");

      const { data: tenantUsers, error: tenantUsersError } = await supabaseAdmin
        .from("tenant_users")
        .select("user_id")
        .eq("tenant_id", payload.tenantId);
      if (tenantUsersError) throw new Error(tenantUsersError.message);

      const emails = await Promise.all(
        (tenantUsers ?? []).map(async (row) => {
          const { data } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          return data.user?.email ?? null;
        })
      );
      recipients = emails.filter((e): e is string => !!e);
      if (recipients.length === 0) return new Response(JSON.stringify({ ok: true, skipped: "no admin emails" }), { headers: { ...CORS, "Content-Type": "application/json" } });

      subject = `New request awaiting approval — ${requestLabel}`;
      html = emailShell(
        "New request awaiting approval",
        `<p style="margin:0 0 12px;font-size:15px;color:#374151;">
          <strong>${memberName}</strong> submitted a request for <strong>${requestLabel}</strong> (${amountLabel}) at ${cooperativeName}.
        </p>
        <p style="margin:0;font-size:14px;color:#6b7280;">Sign in to your admin console to review and approve.</p>`
      );
    } else {
      if (!payload.memberEmail) throw new Error("memberEmail is required for request_reviewed");
      recipients = [payload.memberEmail];

      const approved = payload.status === "APPROVED";
      subject = approved ? `Your request was approved — ${requestLabel}` : `Update on your request — ${requestLabel}`;
      html = emailShell(
        approved ? "Your request was approved" : "Your request was not approved",
        `<p style="margin:0 0 12px;font-size:15px;color:#374151;">
          Hi ${memberName}, your request for <strong>${requestLabel}</strong> (${amountLabel}) at ${cooperativeName} has been
          <strong style="color:${approved ? "#15803d" : "#b91c1c"};">${approved ? "approved" : "declined"}</strong>.
        </p>
        <p style="margin:0;font-size:14px;color:#6b7280;">Sign in to your member portal for full details.</p>`
      );
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Jollify <noreply@thesegunadebayo.com>", to: recipients, subject, html }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
