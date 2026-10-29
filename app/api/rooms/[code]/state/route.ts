import { NextResponse } from "next/server";
import { getRoom } from "@/lib/roomStore";
import type { GameState } from "@/lib/types";

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

  const { hostId, state } = body as { hostId?: unknown; state?: unknown };
  if (typeof hostId !== "string" || hostId !== room.hostId) {
    return NextResponse.json({ error: "只有房主可以同步牌桌" }, { status: 403 });
  }
  if (!state || typeof state !== "object") {
    return NextResponse.json({ error: "missing state" }, { status: 400 });
  }

  room.state = state as GameState;
  room.version += 1;
  room.updatedAt = Date.now();

  return NextResponse.json({ ok: true, version: room.version });
}
