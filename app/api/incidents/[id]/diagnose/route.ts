import { NextResponse } from "next/server";
import { diagnoseIncident } from "@/lib/engine/diagnose";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const diagnosis = await diagnoseIncident(id);
    return NextResponse.json(diagnosis);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Incident diagnosis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
