import { NextResponse } from "next/server";
import { z } from "zod";

const EmailInputSchema = z.object({
  to: z.string().email("Recipient must be a valid email address"),
  subject: z.string().min(1, "Subject cannot be empty"),
  body: z.string().min(1, "Email body cannot be empty"),
});

export async function POST(request: Request) {
  const requestId = `req_email_${Date.now()}`;
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "BadRequest",
        errorCode: "INVALID_JSON",
        message: "Malformed JSON payload in email dispatch request.",
        statusCode: 400,
        requestId,
      },
      { status: 400 }
    );
  }

  const parsed = EmailInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "UnprocessableEntity",
        errorCode: "INVALID_EMAIL_PAYLOAD",
        message: "Failed to dispatch email: invalid recipient, subject, or body.",
        statusCode: 422,
        requestId,
        issues: parsed.error.issues,
      },
      { status: 422 }
    );
  }

  const { to, subject } = parsed.data;

  return NextResponse.json(
    {
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      status: "sent",
      deliveredTo: to,
      subject,
      dispatchedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "x-service-name": "AutoMedic-Mailer",
      },
    }
  );
}
