import { NextResponse } from "next/server";
import { validateFix } from "@/lib/engine/validate";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    let overrideFix: Record<string, unknown> | undefined = undefined;
    try {
      const body = await request.json();
      if (body && typeof body === "object" && body.proposedFix) {
        overrideFix = body.proposedFix;
      }
    } catch {
      // Standard call without override fix
    }

    const validationResult = await validateFix(id, overrideFix);
    return NextResponse.json(validationResult);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Fix validation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
