import { NextResponse } from "next/server";
import { getChaos, incrementChaosCounter } from "@/lib/firebase/repo";

export async function POST(request: Request) {
  const requestId = `req_enrich_${Date.now()}`;
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const company = (body.company as string) || "Acme Corp";
  const chaos = await getChaos();
  const mode = chaos.mode;

  const defaultHeaders = {
    "x-request-id": requestId,
    "x-service-version": "v1.2.0",
    "x-chaos-mode": mode,
  };

  switch (mode) {
    case "schema_drift":
      return NextResponse.json(
        {
          company,
          staff_count: 85,
          industry: "Software & AI",
        },
        { status: 200, headers: defaultHeaders }
      );

    case "bad_type":
      return NextResponse.json(
        {
          company,
          employees: "approx 50",
          industry: "Software & AI",
        },
        { status: 200, headers: defaultHeaders }
      );

    case "bad_fix_trap":
      return NextResponse.json(
        {
          company,
          staff_count: 85,
          employee_count_old: 5,
          industry: "Software & AI",
          metadata: {
            legacyWarning: "employee_count_old is deprecated (cached 2018 value). staff_count is the active current headcount.",
          },
        },
        { status: 200, headers: defaultHeaders }
      );

    case "transient_500": {
      const attempt = await incrementChaosCounter("transient_500");
      if (attempt <= 2) {
        return NextResponse.json(
          {
            error: "InternalServerError",
            errorCode: "GATEWAY_TIMEOUT",
            message: "Enrichment upstream microservice gateway timed out (connection reset by peer)",
            statusCode: 500,
            requestId,
            attempt,
            hint: "Transient downstream failure. Retrying with backoff may succeed.",
          },
          {
            status: 500,
            headers: {
              ...defaultHeaders,
              "x-attempt-count": String(attempt),
            },
          }
        );
      }
      return NextResponse.json(
        {
          company,
          employees: 85,
          industry: "Software & AI",
          recoveredOnAttempt: attempt,
        },
        { status: 200, headers: defaultHeaders }
      );
    }

    case "primary_down":
      return NextResponse.json(
        {
          error: "ServiceUnavailable",
          errorCode: "CLUSTER_OFFLINE",
          message: "Primary Enrichment cluster offline for maintenance. Failover endpoint available at /api/mock/enrichment-v2.",
          statusCode: 503,
          requestId,
          recommendedAction: "switch_to_fallback_endpoint",
          fallbackEndpoint: "/api/mock/enrichment-v2",
        },
        {
          status: 503,
          headers: {
            ...defaultHeaders,
            "x-fallback-endpoint": "/api/mock/enrichment-v2",
            "retry-after": "300",
          },
        }
      );

    case "none":
    default:
      return NextResponse.json(
        {
          company,
          employees: 85,
          industry: "Software & AI",
        },
        { status: 200, headers: defaultHeaders }
      );
  }
}
