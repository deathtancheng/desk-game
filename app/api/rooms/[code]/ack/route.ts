import { NextResponse } from "next/server";
import { getRoom } from "@/lib/roomStore";

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

  const { hostId, actionId } = body as { hostId?: unknown; actionId?: unknown };
  if (typeof hostId !== "string" || hostId !== room.hostId) {
    return NextResponse.json({ error: "只有房主可以确认动作" }, { status: 403 });
  }
  if (typeof actionId !== "string") {
    return NextResponse.json({ error: "missing actionId" }, { status: 400 });
  }

  room.pending = room.pending.filter((item) => item.id !== actionId);
  room.updatedAt = Date.now();

  return NextResponse.json({ ok: true });
}
