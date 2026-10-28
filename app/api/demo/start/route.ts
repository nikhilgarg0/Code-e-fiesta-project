import { NextResponse } from "next/server";
import { startDemo } from "@/lib/engine/demo";

export async function POST() {
  try {
    const state = await startDemo();
    return NextResponse.json({ message: "Demo sequence initiated", state });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to start demo";
    if (message === "DEMO_ALREADY_RUNNING") {
      return NextResponse.json(
        { error: "A demo sequence is already in progress.", code: "DEMO_ALREADY_RUNNING" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: message, code: "DEMO_START_ERROR" }, { status: 500 });
  }
}
