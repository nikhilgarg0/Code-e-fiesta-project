import { NextResponse } from "next/server";
import { getIncident } from "@/lib/firebase/repo";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const incident = await getIncident(id);

    if (!incident) {
      return NextResponse.json({ error: `Incident '${id}' not found.` }, { status: 404 });
    }

    return NextResponse.json(incident);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to retrieve incident";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
