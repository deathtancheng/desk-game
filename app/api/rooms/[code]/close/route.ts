import { NextResponse } from "next/server";
import { getRoom, removeRoom } from "@/lib/roomStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const room = getRoom(code);
  if (!room) {
    return NextResponse.json({ error: "房间不存在或已过期" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const hostId = (body as { hostId?: unknown }).hostId;
  if (typeof hostId !== "string" || hostId !== room.hostId) {
    return NextResponse.json({ error: "只有房主可以结束房间" }, { status: 403 });
  }

  removeRoom(code, hostId);
  return NextResponse.json({ ok: true });
}
