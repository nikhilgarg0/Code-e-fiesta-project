import { NextResponse } from "next/server";
import { skipDemoStep } from "@/lib/engine/demo";

export async function POST() {
  try {
    await skipDemoStep();
    return NextResponse.json({ message: "Demo step skipped" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to skip step";
    return NextResponse.json({ error: message, code: "DEMO_SKIP_ERROR" }, { status: 500 });
  }
}
