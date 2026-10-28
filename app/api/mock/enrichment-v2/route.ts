import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const requestId = `req_enrich_v2_${Date.now()}`;
  let body: Record<string, unknown> = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const company = (body.company as string) || "Acme Corp";

  return NextResponse.json(
    {
      company,
      employees: 85,
      industry: "Software & AI",
      endpointVersion: "v2-fallback",
    },
    {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "x-service-version": "v2.0.0-fallback",
        "x-endpoint-status": "healthy",
      },
    }
  );
}
