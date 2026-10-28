// app/api/webhooks/lead/route.ts
// Real incoming webhook endpoint for external lead ingestion

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startRun } from "@/lib/engine/executor";

const LeadWebhookSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  company: z.string().min(1, "Company is required"),
  website: z.string().url().optional().or(z.string().optional()),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Verify Webhook Secret (if configured)
    const configuredSecret = process.env.WEBHOOK_SECRET;
    if (configuredSecret) {
      const incomingSecret =
        req.headers.get("x-webhook-secret") ||
        req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

      if (incomingSecret !== configuredSecret) {
        return NextResponse.json(
          {
            error: "Unauthorized: Invalid or missing x-webhook-secret header",
            code: "WEBHOOK_UNAUTHORIZED",
          },
          { status: 401 }
        );
      }
    }

    // 2. Parse & Validate Payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed JSON payload", code: "INVALID_JSON" },
        { status: 400 }
      );
    }

    const parseResult = LeadWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed: " + parseResult.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
          code: "VALIDATION_ERROR",
          details: parseResult.error.issues,
        },
        { status: 422 }
      );
    }

    const { name, email, company, website } = parseResult.data;

    // 3. Trigger AutoMedic Workflow Run
    const runId = await startRun("lead_to_crm", {
      name,
      email,
      company,
      ...(website ? { website } : {}),
      source: "webhook",
    });

    return NextResponse.json(
      {
        success: true,
        message: "Lead received and workflow execution initiated",
        runId,
        status: "running",
        workflow: "lead_to_crm",
      },
      { status: 201 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
