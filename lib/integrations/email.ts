// lib/integrations/email.ts
// Real Email adapter (Resend & EmailJS) with mock fallback

import { AdapterExecutionResult } from "./enrichment";

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface SendEmailOutput {
  messageId: string;
  status: string;
  deliveredTo: string;
  subject: string;
  dispatchedAt: string;
}

export async function sendEmailFollowup(
  input: SendEmailInput,
  mockFallbackUrl?: string
): Promise<AdapterExecutionResult<SendEmailOutput>> {
  const resendKey = process.env.RESEND_API_KEY;
  const emailJsServiceId = process.env.EMAILJS_SERVICE_ID;
  const emailJsTemplateId = process.env.EMAILJS_TEMPLATE_ID;
  const emailJsPublicKey = process.env.EMAILJS_PUBLIC_KEY;
  const emailJsPrivateKey = process.env.EMAILJS_PRIVATE_KEY;

  // 1. RESEND REST API
  if (resendKey) {
    const url = "https://api.resend.com/emails";
    const fromAddress = process.env.RESEND_FROM_EMAIL || "AutoMedic <onboarding@resend.dev>";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [input.to],
          subject: input.subject,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
              <h2 style="color: #38bdf8; margin-top: 0;">⚡ ${input.subject}</h2>
              <p style="font-size: 15px; line-height: 1.6; color: #cbd5e1;">${input.body}</p>
              <hr style="border: 0; border-top: 1px solid #334155; margin: 24px 0;" />
              <p style="font-size: 12px; color: #64748b; margin: 0;">Automated notification dispatched by <strong>AutoMedic</strong> runtime.</p>
            </div>
          `,
        }),
      });

      const headers = Object.fromEntries(res.headers.entries());
      const rawData = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          success: false,
          request: { url, method: "POST", body: { to: input.to, subject: input.subject } },
          response: { status: res.status, headers, body: rawData },
          errorMessage: rawData.message || `Resend API returned status ${res.status}`,
          errorCode: `RESEND_${res.status}`,
          mode: "real",
        };
      }

      const output: SendEmailOutput = {
        messageId: `resend_${rawData.id || Date.now()}`,
        status: "delivered",
        deliveredTo: input.to,
        subject: input.subject,
        dispatchedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: output,
        rawResponse: rawData,
        request: { url, method: "POST", body: { to: input.to, subject: input.subject } },
        response: { status: 200, headers, body: rawData },
        mode: "real",
      };
    } catch (err: unknown) {
      return {
        success: false,
        request: { url, method: "POST", body: { to: input.to, subject: input.subject } },
        errorMessage: err instanceof Error ? err.message : "Network error contacting Resend API",
        errorCode: "RESEND_NETWORK_ERROR",
        mode: "real",
      };
    }
  }

  // 2. EMAILJS INTEGRATION
  if (emailJsServiceId && emailJsTemplateId && emailJsPublicKey) {
    const url = "https://api.emailjs.com/api/v1.0/email/send";
    const originUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: originUrl,
        },
        body: JSON.stringify({
          service_id: emailJsServiceId,
          template_id: emailJsTemplateId,
          user_id: emailJsPublicKey,
          ...(emailJsPrivateKey ? { accessToken: emailJsPrivateKey } : {}),
          template_params: {
            to_email: input.to,
            to: input.to,
            recipient: input.to,
            subject: input.subject,
            message: input.body,
            body: input.body,
          },
        }),
      });

      const headers = Object.fromEntries(res.headers.entries());

      if (res.ok) {
        const output: SendEmailOutput = {
          messageId: `emailjs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          status: "delivered",
          deliveredTo: input.to,
          subject: input.subject,
          dispatchedAt: new Date().toISOString(),
        };

        return {
          success: true,
          data: output,
          rawResponse: { status: "OK", serviceId: emailJsServiceId },
          request: { url, method: "POST", body: { to: input.to, subject: input.subject } },
          response: { status: 200, headers, body: output },
          mode: "real",
        };
      } else {
        const errorText = await res.text().catch(() => "");
        console.warn(`[AutoMedic EmailJS] Real send returned status ${res.status}: ${errorText}`);
      }
    } catch (emailErr) {
      console.warn("[AutoMedic EmailJS] Real send error:", emailErr);
    }
  }

  // 3. FALLBACK TO SIMULATED MOCK EMAIL
  const fallbackUrl = mockFallbackUrl || "http://localhost:3001/api/mock/email";
  try {
    const res = await fetch(fallbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const headers = Object.fromEntries(res.headers.entries());
    const rawData = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        success: false,
        request: { url: fallbackUrl, method: "POST", body: input },
        response: { status: res.status, headers, body: rawData },
        errorMessage: rawData.message || rawData.error || `Email mock returned ${res.status}`,
        errorCode: rawData.errorCode || `HTTP_${res.status}`,
        mode: "mock",
      };
    }

    const output: SendEmailOutput = {
      messageId: rawData.messageId || `mock_msg_${Date.now()}`,
      status: rawData.status || "delivered",
      deliveredTo: rawData.deliveredTo || input.to,
      subject: rawData.subject || input.subject,
      dispatchedAt: rawData.dispatchedAt || new Date().toISOString(),
    };

    return {
      success: true,
      data: output,
      rawResponse: rawData,
      request: { url: fallbackUrl, method: "POST", body: input },
      response: { status: 200, headers, body: rawData },
      mode: "mock",
    };
  } catch (err: unknown) {
    return {
      success: false,
      request: { url: fallbackUrl, method: "POST" },
      errorMessage: err instanceof Error ? err.message : "Failed to reach mock email endpoint",
      errorCode: "MOCK_EMAIL_ERROR",
      mode: "mock",
    };
  }
}
