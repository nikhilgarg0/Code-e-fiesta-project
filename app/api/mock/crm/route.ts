import { NextResponse } from "next/server";
import { getChaos, incrementChaosCounter } from "@/lib/firebase/repo";
import { z } from "zod";

const CrmInputSchema = z.object({
  full_name: z.string().min(1, "full_name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().min(1, "company is required"),
  employees: z.number().int().nonnegative("employees must be a non-negative number"),
});

export async function POST(request: Request) {
  const requestId = `req_crm_${Date.now()}`;
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "BadRequest",
        errorCode: "INVALID_JSON",
        message: "Malformed JSON payload received by CRM service.",
        statusCode: 400,
        requestId,
      },
      { status: 400 }
    );
  }

  const chaos = await getChaos();
  const mode = chaos.mode;

  // Handle rate_limit chaos mode
  if (mode === "rate_limit") {
    const attempt = await incrementChaosCounter("rate_limit");
    if (attempt <= 2) {
      return NextResponse.json(
        {
          error: "RateLimitExceeded",
          errorCode: "TOO_MANY_REQUESTS",
          message: "CRM API rate limit exceeded for client token. Please back off before retrying.",
          statusCode: 429,
          requestId,
          attempt,
          retryAfterSeconds: 1,
          hint: "Rate limit refreshes in 1 second. Use retry_with_backoff.",
        },
        {
          status: 429,
          headers: {
            "x-request-id": requestId,
            "retry-after": "1",
            "x-rate-limit-limit": "100",
            "x-rate-limit-remaining": "0",
            "x-attempt-count": String(attempt),
          },
        }
      );
    }
  }

  // Validate CRM schema
  const parsed = CrmInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "UnprocessableEntity",
        errorCode: "SCHEMA_VALIDATION_FAILED",
        message: "CRM rejected lead: schema validation error on required fields.",
        statusCode: 422,
        requestId,
        issues: parsed.error.issues,
      },
      {
        status: 422,
        headers: {
          "x-request-id": requestId,
          "x-service-name": "AutoMedic-CRM",
        },
      }
    );
  }

  const { full_name, email, company, employees } = parsed.data;

  return NextResponse.json(
    {
      crmId: `crm_lead_${Date.now()}`,
      status: "created",
      lead: {
        full_name,
        email,
        company,
        employees,
      },
      createdAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "x-service-name": "AutoMedic-CRM",
      },
    }
  );
}
