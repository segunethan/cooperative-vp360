import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { memberName, memberNumber, memberEmail, cooperativeName, cooperativeNumber, redirectTo } =
      await req.json();

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    // Admin client — uses built-in service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate a one-time invite link for the member
    const acceptUrl = redirectTo ?? "https://jollify.app/accept-invite";
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: memberEmail,
      options: { redirectTo: acceptUrl },
    });

    if (linkError) throw new Error(`Invite link error: ${linkError.message}`);

    const inviteLink = linkData.properties.action_link;
    const authUserId = linkData.user.id;

    // Pre-link the auth user to the member record so RLS works on accept
    await supabaseAdmin
      .from("members")
      .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
      .eq("email", memberEmail);

    // ── Email template — Jollify green theme ──────────────────────────────────
    const firstName = memberName.split(" ")[0];
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to ${cooperativeName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">

          <!-- Header -->
          <tr>
            <td style="background:#012d1d;padding:28px 40px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:rgba(255,255,255,0.12);width:38px;height:38px;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:800;color:#c1ecd4;line-height:38px;display:block;">J</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Jollify</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Green accent bar -->
          <tr>
            <td style="background:linear-gradient(90deg,#c1ecd4,#6ee7b7);height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;">You're invited</p>
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;line-height:1.2;">
                Welcome to ${cooperativeName}, ${firstName}!
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
                You have been registered as a cooperative member by your administrator.
                Set up your account to view your contributions, loans, and cooperative updates.
              </p>

              <!-- Member ID card -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#15803d;letter-spacing:1px;text-transform:uppercase;">Your Member ID</p>
                    <p style="margin:0 0 4px;font-size:30px;font-weight:800;color:#012d1d;letter-spacing:1.5px;font-family:monospace;">${memberNumber}</p>
                    ${cooperativeNumber ? `<p style="margin:0;font-size:12px;color:#6b7280;">Cooperative: <strong style="color:#374151;">${cooperativeNumber}</strong></p>` : ""}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="background:#012d1d;border-radius:10px;">
                    <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                      Set up my account →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.6;">
                This link expires in <strong>24 hours</strong>. If you didn't expect this email, you can safely ignore it.
              </p>

              <!-- Divider -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;">
                <tr><td style="border-top:1px solid #f0ede8;font-size:0;">&nbsp;</td></tr>
              </table>

              <p style="margin:0;font-size:12px;color:#9ca3af;word-break:break-all;">
                Or copy this link: <a href="${inviteLink}" style="color:#015c38;">${inviteLink}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid #f0ede8;background:#fafaf9;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                Sent by <strong style="color:#6b7280;">${cooperativeName}</strong> via Jollify Cooperative Platform.
              </p>
              <p style="margin:0;font-size:12px;color:#d1d5db;">
                &copy; 2026 Jollify &middot; Cooperative Management Platform
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jollify <noreply@thesegunadebayo.com>",
        to: [memberEmail],
        subject: `You've been invited to ${cooperativeName} — Set up your account`,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
