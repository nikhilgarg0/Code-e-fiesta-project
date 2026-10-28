import { NextResponse } from "next/server";
import { stopDemo } from "@/lib/engine/demo";

export async function POST() {
  try {
    await stopDemo();
    return NextResponse.json({ message: "Demo sequence stopped" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to stop demo";
    return NextResponse.json({ error: message, code: "DEMO_STOP_ERROR" }, { status: 500 });
  }
}
