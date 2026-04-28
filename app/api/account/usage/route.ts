import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type UsageRequest = {
  userId?: string;
};

type UsageEvent = {
  billable_seconds: number | null;
};

export async function POST(req: Request) {
  const { userId } = (await req.json()) as UsageRequest;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const { data: subscription } = await supabaseAdmin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  const { data: usageEvents } = await supabaseAdmin
    .from("usage_events")
    .select("billable_seconds")
    .eq("user_id", userId)
    .returns<UsageEvent[]>();

  const totalUsedSeconds =
    usageEvents?.reduce((sum, e) => sum + (e.billable_seconds || 0), 0) || 0;

  return NextResponse.json({
    subscription,
    totalUsedSeconds,
  });
}
