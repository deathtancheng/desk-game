import { NextResponse } from "next/server";
import { getRoom, toView } from "@/lib/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "房间不存在或已过期" }, { status: 404 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId");
  return NextResponse.json(toView(room, clientId === room.hostId));
}
