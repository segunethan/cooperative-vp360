import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { email, password, cooperativeName, resend } = await req.json();

    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Create user if not resending — skip silently if already exists
    if (!resend) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });
      // "User already registered" is fine — they may be retrying
      if (createError && !createError.message.toLowerCase().includes("already")) {
        throw createError;
      }
    }

    // Generate a fresh OTP for this email
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "signup",
      email,
    });
    if (linkError) throw linkError;

    const otp = linkData.properties.email_otp;
    const firstName = cooperativeName.split(" ")[0];

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your Jollify account</title>
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
            <td style="background:linear-gradient(90deg,#c1ecd4,#6ee7b7);height:3px;font-size:0;">&nbsp;</td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 8px;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6b7280;letter-spacing:0.5px;text-transform:uppercase;">Verify your email</p>
              <h1 style="margin:0 0 14px;font-size:26px;font-weight:800;color:#0a0a0a;letter-spacing:-0.5px;line-height:1.2;">
                Welcome to Jollify, ${firstName}! 🎉
              </h1>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.7;">
                You're almost ready to take <strong style="color:#374151;">${cooperativeName}</strong> digital.
                Enter the 8-digit code below in the app to verify your email and activate your account.
              </p>

              <!-- OTP Box -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px;">
                <tr>
                  <td align="center" style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:28px 24px;">
                    <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#15803d;letter-spacing:2px;text-transform:uppercase;">Your verification code</p>
                    <p style="margin:0;font-size:48px;font-weight:800;color:#012d1d;letter-spacing:12px;font-family:monospace;">${otp}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#9ca3af;line-height:1.6;">
                This code expires in <strong>1 hour</strong>. If you didn't create a Jollify account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- What's next -->
          <tr>
            <td style="padding:20px 40px 32px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#fafaf9;border:1px solid #f0ede8;border-radius:12px;padding:20px 24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">What happens next</p>
                    ${["Enter the code in the Jollify app", "Your cooperative account will be activated instantly", "Start managing members, contributions & loans"].map((step, i) => `
                    <table cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="width:22px;height:22px;background:#012d1d;border-radius:50%;text-align:center;vertical-align:middle;font-size:11px;font-weight:700;color:#ffffff;flex-shrink:0;">${i + 1}</td>
                        <td style="padding-left:10px;font-size:13px;color:#6b7280;">${step}</td>
                      </tr>
                    </table>`).join("")}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 28px;border-top:1px solid #f0ede8;background:#fafaf9;">
              <p style="margin:0 0 4px;font-size:12px;color:#9ca3af;">
                This email was sent to <strong style="color:#6b7280;">${email}</strong> because you registered on Jollify.
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

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jollify <noreply@thesegunadebayo.com>",
        to: [email],
        subject: `${otp} is your Jollify verification code`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(`Email error: ${err}`);
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
