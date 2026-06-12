import { env } from "cloudflare:workers";

type InvitationEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

type EmailResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; errorMessage: string };

type EmailConfig = {
  configured: boolean;
  from: string | null;
  provider: "resend";
  siteUrl: string | null;
};

type ResendResponse = {
  id?: string;
  name?: string;
  message?: string;
};

function envString(name: string) {
  const value = (env as unknown as Record<string, string | undefined>)[name];
  return value?.trim() || null;
}

export function getEmailConfig(): EmailConfig {
  const from = envString("EMAIL_FROM");
  const siteUrl = envString("PUBLIC_SITE_URL") ?? envString("SITE_URL");

  return {
    configured: Boolean(envString("RESEND_API_KEY") && from && siteUrl),
    from,
    provider: "resend",
    siteUrl,
  };
}

export function getPublicSiteUrl() {
  return envString("PUBLIC_SITE_URL") ?? envString("SITE_URL") ?? "";
}

export async function sendInvitationEmail(
  email: InvitationEmail
): Promise<EmailResult> {
  const apiKey = envString("RESEND_API_KEY");
  const from = envString("EMAIL_FROM");

  if (!apiKey || !from) {
    return {
      ok: false,
      errorMessage: "Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as ResendResponse;

    if (!response.ok) {
      return {
        ok: false,
        errorMessage:
          data.message ??
          data.name ??
          `Resend returned HTTP ${response.status}.`,
      };
    }

    return { ok: true, providerMessageId: data.id ?? null };
  } catch (error) {
    return {
      ok: false,
      errorMessage:
        error instanceof Error ? error.message : "Email provider request failed.",
    };
  }
}
