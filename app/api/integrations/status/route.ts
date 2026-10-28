// app/api/integrations/status/route.ts
import { NextResponse } from "next/server";
import { getIntegrationsStatus } from "@/lib/integrations/status";

export async function GET() {
  const status = getIntegrationsStatus();
  return NextResponse.json(status);
}
